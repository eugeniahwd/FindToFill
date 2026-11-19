/**
 * src/lib/chatbot/llm/fakeLlmClient.ts
 *
 * FakeLLMClient (docs/AI_TRACK.md §12), offline and deterministic:
 * - scripted: returns the given steps in order (tests).
 * - policy: a well-behaved model. It calls the right tools in order for each quick message and
 *   answers from the tool results only. Fake mode and the eval run on it.
 * - adversarial: misbehaves on purpose (invented ids or numbers, false claims, endless tool
 *   calls, disallowed tools, plain text instead of JSON, slowness, 429, 5xx).
 */

import type { QuickMessageId } from '../contract';
import { composeAnswer } from '../deterministic';
import { QUICK_MESSAGES } from '../quickMessages';
import type { ToolOutputs } from '../tools/types';
import {
  LLMError,
  type LLMClient,
  type LLMMessage,
  type LLMRequest,
  type LLMResponse,
} from './types';

export type ScriptedStep = LLMResponse | LLMError | ((request: LLMRequest) => LLMResponse);

export type Attack =
  | 'hallucinated_id'
  | 'invented_number'
  | 'false_claim'
  | 'endless_tools'
  | 'disallowed_tool'
  | 'not_json'
  | 'slow'
  | 'rate_limited'
  | 'server_error';

export type FakeLLMOptions =
  | { mode: 'scripted'; steps: ScriptedStep[] }
  | { mode: 'policy' }
  | { mode: 'adversarial'; attack: Attack; delayMs?: number };

export class FakeLLMClient implements LLMClient {
  /** Every request received, for assertions. */
  readonly requests: LLMRequest[] = [];
  private calls = 0;

  constructor(private readonly options: FakeLLMOptions = { mode: 'policy' }) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    this.requests.push(request);
    const index = this.calls++;
    switch (this.options.mode) {
      case 'scripted':
        return scripted(this.options.steps, index, request);
      case 'policy':
        return policy(request);
      case 'adversarial':
        return adversarial(this.options.attack, this.options.delayMs ?? 1000, index, request);
    }
  }
}

function scripted(steps: ScriptedStep[], index: number, request: LLMRequest): LLMResponse {
  const step = steps[index];
  if (step === undefined) throw new Error(`FakeLLMClient: no scripted step ${index}`);
  if (step instanceof LLMError) throw step;
  return typeof step === 'function' ? step(request) : step;
}

// ─── Policy: the well-behaved model ───────────────────────────────────────────

function policy(request: LLMRequest): LLMResponse {
  const quickMessageId = questionOf(request.messages);
  const outputs = toolOutputsOf(request.messages);
  if (request.jsonSchema || !request.tools) return finalAnswer(quickMessageId, outputs);

  const allowed = new Set(request.tools.map((tool) => tool.name));
  const next = nextCall(quickMessageId, outputs);
  if (!next || !allowed.has(next.name)) return finalAnswer(quickMessageId, outputs);
  return { toolCalls: [{ id: `call_${request.messages.length}`, ...next }] };
}

function questionOf(messages: LLMMessage[]): QuickMessageId {
  const first = messages[0];
  const match = Object.values(QUICK_MESSAGES).find(
    (message) => first?.role === 'user' && message.text === first.content,
  );
  if (!match) throw new LLMError('bad_output', 'FakeLLMClient: unknown question');
  return match.id;
}

/** The latest successful result of each tool, from the conversation. */
function toolOutputsOf(messages: LLMMessage[]): ToolOutputs {
  const outputs: ToolOutputs = {};
  for (const message of messages) {
    if (message.role !== 'tool') continue;
    let result: unknown;
    try {
      result = JSON.parse(message.content);
    } catch {
      continue;
    }
    if (!result || typeof result !== 'object' || 'error' in result) continue;
    if (message.name === 'get_user_location') outputs.location = result as ToolOutputs['location'];
    if (message.name === 'get_nearest_facility') outputs.nearest = result as ToolOutputs['nearest'];
    if (message.name === 'get_facility_status') outputs.status = result as ToolOutputs['status'];
    if (message.name === 'get_next_train') outputs.trains = result as ToolOutputs['trains'];
    if (message.name === 'search_reviews') outputs.reviews = result as ToolOutputs['reviews'];
  }
  return outputs;
}

function nextCall(
  quickMessageId: QuickMessageId,
  outputs: ToolOutputs,
): { name: string; args: unknown } | null {
  const stationId = outputs.location?.station.id;
  if (!stationId) return { name: 'get_user_location', args: {} };
  if (quickMessageId === 'review_summary') {
    return outputs.reviews ? null : { name: 'search_reviews', args: { station_id: stationId } };
  }

  const type =
    quickMessageId === 'nearest_charging'
      ? 'charging'
      : quickMessageId === 'facility_working'
        ? 'any'
        : 'water';
  if (!outputs.nearest) {
    return { name: 'get_nearest_facility', args: { station_id: stationId, type, limit: 6 } };
  }
  const facilities = outputs.nearest.facilities;
  if (facilities.length === 0) return null;
  if (!outputs.status) {
    const ids = facilities.map((f) => f.facility_id);
    return { name: 'get_facility_status', args: { facility_ids: ids } };
  }

  if (quickMessageId === 'time_to_refill' && !outputs.trains) {
    const status = new Map(outputs.status.statuses.map((s) => [s.facility_id, s.status]));
    const available = facilities.find((f) => status.get(f.facility_id) === 'available');
    if (available) {
      return {
        name: 'get_next_train',
        args: { station_id: stationId, walk_time_min: available.walk_time_min },
      };
    }
  }
  return null;
}

function finalAnswer(quickMessageId: QuickMessageId, outputs: ToolOutputs): LLMResponse {
  const answer = composeAnswer(quickMessageId, outputs, outputs.location?.station.name ?? 'ini');
  return { text: JSON.stringify({ message: answer.message, facility_ids: answer.facilityIds }) };
}

// ─── Adversarial: the misbehaving model ───────────────────────────────────────

async function adversarial(
  attack: Attack,
  delayMs: number,
  index: number,
  request: LLMRequest,
): Promise<LLMResponse> {
  switch (attack) {
    case 'rate_limited':
      throw new LLMError('unavailable', 'Rate limited', 429);
    case 'server_error':
      throw new LLMError('unavailable', 'Server error', 503);
    case 'endless_tools':
      return { toolCalls: [{ id: `call_${index}`, name: 'get_user_location', args: {} }] };
    case 'slow':
      await sleep(delayMs, request.signal);
      return policy(request);
    case 'disallowed_tool':
      if (index === 0) {
        return {
          toolCalls: [
            { id: 'call_bad_1', name: 'delete_everything', args: {} },
            { id: 'call_bad_2', name: 'get_next_train', args: { station_id: 'x' } },
          ],
        };
      }
      return policy(request);
    default:
      return tamper(attack, policy(request), request);
  }
}

/** Changes the policy's final answer; tool calls pass through unchanged. */
function tamper(attack: Attack, response: LLMResponse, request: LLMRequest): LLMResponse {
  if (!response.text) return response;
  if (attack === 'not_json') {
    return request.jsonSchema ? response : { text: 'Dispenser air ada di dekat tangga.' };
  }
  const answer = JSON.parse(response.text) as { message: string; facility_ids: string[] };
  if (attack === 'hallucinated_id') answer.facility_ids = [...answer.facility_ids, 'fac-invented'];
  if (attack === 'invented_number') answer.message += ' Antreannya sekitar 987 orang.';
  if (attack === 'false_claim') {
    answer.message = 'Semua fasilitas di stasiun ini tersedia dan berfungsi normal.';
  }
  return { text: JSON.stringify(answer) };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new LLMError('unavailable', 'Timed out'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}
