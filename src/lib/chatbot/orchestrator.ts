/**
 * src/lib/chatbot/orchestrator.ts
 *
 * handleChat (docs/AI_TRACK.md §9): validate, rate limit, resolve the station, run the bounded
 * tool loop, check the model's answer, build cards from data rows, and log one entry. Every
 * dependency is injected, so it runs the same in the route, in Jest, and in the eval.
 */

import { randomUUID } from 'node:crypto';
import type { Clock } from './clock';
import {
  FILL_BUFFER_MIN,
  HARD_TIMEOUT_MS,
  MAX_NEAREST_LIMIT,
  MAX_TOOL_ITERATIONS,
  RATE_LIMIT_CHAT,
  RATE_LIMIT_WINDOW_SEC,
  TOOL_TIMEOUT_MS,
} from './config';
import type {
  ChatCard,
  ChatOutcome,
  ChatRequest,
  ChatResponse,
  FacilityType,
  QuickMessageId,
} from './contract';
import type { ChatbotDataProvider } from './data/provider';
import { composeAnswer } from './deterministic';
import { resolveLocation } from './geo';
import { LLMError, type LLMClient, type LLMMessage, type LLMToolCall } from './llm/types';
import type { ChatLogEntry, ChatLogger } from './logger';
import {
  FALLBACK_MESSAGES,
  FINAL_ANSWER_INSTRUCTION,
  FINAL_ANSWER_SCHEMA,
  SYSTEM_PROMPT,
} from './prompts';
import { QUICK_MESSAGES, type ChatbotToolName } from './quickMessages';
import type { RateLimiter } from './rateLimit';
import { getStubChatResponse } from './stub';
import { getTool, toolDeclarations } from './tools/registry';
import { createEvidence, type Evidence, type ToolContext, type ToolResult } from './tools/types';
import { ChatRequestSchema, checkAnswer, parseFinalAnswer, type ParsedAnswer } from './validation';

export interface ChatLimits {
  maxToolIterations: number;
  toolTimeoutMs: number;
  hardTimeoutMs: number;
}

const DEFAULT_LIMITS: ChatLimits = {
  maxToolIterations: MAX_TOOL_ITERATIONS,
  toolTimeoutMs: TOOL_TIMEOUT_MS,
  hardTimeoutMs: HARD_TIMEOUT_MS,
};

const TEMPERATURE = 0.2;

export interface ChatDeps {
  /** "stub": canned answers (stub.ts). "agent": the tool loop with a model. */
  answer: 'stub' | 'agent';
  /** null when no data source is wired: the chatbot answers fallback_ai_unavailable. */
  provider: ChatbotDataProvider | null;
  /** null when no model is configured (for example a missing key): fallback_ai_unavailable. */
  llm: LLMClient | null;
  rateLimiter: RateLimiter;
  logger: ChatLogger;
  clock: Clock;
  /** Rate-limit key: the Backend's chatRateLimitKey() (user id, or an HMAC of the IP). */
  identity: string;
  limits?: Partial<ChatLimits>;
}

export interface ChatResult {
  status: 200 | 400 | 429;
  response: ChatResponse;
  /** What the tools returned, for the eval. Never sent to the client. */
  evidence?: Evidence;
}

/** The facility type each quick message looks at (null: reviews only). */
const FACILITY_TYPE: Record<QuickMessageId, FacilityType | 'any' | null> = {
  nearest_water: 'water',
  nearest_charging: 'charging',
  facility_working: 'any',
  time_to_refill: 'water',
  review_summary: null,
};

export async function handleChat(body: unknown, deps: ChatDeps): Promise<ChatResult> {
  const startedAt = Date.now();
  const now = deps.clock.now();
  const log = (entry: Omit<ChatLogEntry, 'latencyMs'>) =>
    deps.logger.log({ ...entry, latencyMs: Date.now() - startedAt }).catch(() => undefined);

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    console.warn(`[chat] 400 rejected: ${issuePaths(parsed.error.issues)}`);
    await log({
      sessionId: randomUUID(),
      quickMessageId: 'unknown',
      toolsCalled: [],
      outcome: 'rejected',
      stationId: null,
    });
    return { status: 400, response: fallbackResponse('rejected', FALLBACK_MESSAGES.rejected, now) };
  }

  const request = parsed.data;
  const base = {
    sessionId: request.sessionId ?? randomUUID(),
    quickMessageId: request.quickMessageId,
  };
  const limit = await deps.rateLimiter.check(
    deps.identity,
    'chat',
    RATE_LIMIT_CHAT,
    RATE_LIMIT_WINDOW_SEC,
  );
  if (!limit.allowed) {
    await log({ ...base, toolsCalled: [], outcome: 'rejected', stationId: null });
    return {
      status: 429,
      response: {
        ...fallbackResponse('rejected', FALLBACK_MESSAGES.rateLimited, now),
        retryAfterSec: limit.retryAfterSec ?? RATE_LIMIT_WINDOW_SEC,
      },
    };
  }

  if (deps.answer === 'stub') {
    const response = getStubChatResponse(request, now);
    await log({ ...base, toolsCalled: [], outcome: response.outcome, stationId: null });
    return { status: 200, response };
  }

  const evidence = createEvidence();
  const response = await runWithDeadline(request, deps, now, evidence);
  await log({
    ...base,
    toolsCalled: evidence.toolsCalled,
    outcome: response.outcome,
    stationId: response.detectedStation?.id ?? null,
  });
  return { status: 200, response, evidence };
}

function aiUnavailable(now: Date): ChatResponse {
  return fallbackResponse('fallback_ai_unavailable', FALLBACK_MESSAGES.aiUnavailable, now);
}

export function fallbackResponse(outcome: ChatOutcome, message: string, now: Date): ChatResponse {
  return {
    outcome,
    message,
    cards: [],
    scheduleReminder: false,
    needsStationSelection: false,
    detectedStation: null,
    generatedAt: now.toISOString(),
  };
}

/** The agent within HARD_TIMEOUT_MS. Model quota, 5xx, or timeout: fallback_ai_unavailable. */
async function runWithDeadline(
  request: ChatRequest,
  deps: ChatDeps,
  now: Date,
  evidence: Evidence,
): Promise<ChatResponse> {
  const limits = { ...DEFAULT_LIMITS, ...deps.limits };
  const unavailable = aiUnavailable(now);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, limits.hardTimeoutMs);
  });

  const work = runAgent(request, deps, now, evidence, limits, controller.signal);
  work.catch(() => undefined); // settled after the deadline: nothing is waiting for it
  try {
    return (await Promise.race([work, deadline])) ?? unavailable;
  } catch (err) {
    if (err instanceof LLMError && err.kind === 'unavailable') return unavailable;
    throw err;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function runAgent(
  request: ChatRequest,
  deps: ChatDeps,
  now: Date,
  evidence: Evidence,
  limits: ChatLimits,
  signal: AbortSignal,
): Promise<ChatResponse> {
  const unavailable = aiUnavailable(now);
  if (!deps.provider) return unavailable;

  // Resolved before any model call: no station means no model call (§9 step 3).
  let stations;
  try {
    stations = await withTimeout(deps.provider.listStations(), limits.toolTimeoutMs);
  } catch {
    return unavailable;
  }
  const location = resolveLocation(request.stationId, stations);
  if (!location.detected) {
    const message =
      location.reason === 'no_location' ? FALLBACK_MESSAGES.noLocation : FALLBACK_MESSAGES.noData;
    return { ...fallbackResponse('fallback_no_data', message, now), needsStationSelection: true };
  }
  if (!deps.llm) return unavailable;

  const ctx: ToolContext = { provider: deps.provider, station: location.station, now, evidence };
  const answer = await askModel(request.quickMessageId, deps.llm, ctx, limits, signal);
  const final = await decideAnswer(request.quickMessageId, answer, ctx, limits);

  return {
    outcome: final.outcome,
    message: final.message,
    cards: final.outcome === 'answered' ? await buildCards(final.facilityIds, ctx) : [],
    scheduleReminder: evidence.toolsCalled.includes('get_next_train'),
    needsStationSelection: false,
    detectedStation: {
      id: location.station.id,
      name: location.station.name,
      source: 'manual',
      needsConfirmation: false,
    },
    generatedAt: now.toISOString(),
  };
}

/**
 * The bounded tool loop (§9 steps 4 to 6). Returns null when the model gave no usable JSON.
 * Two choices keep it inside the latency budget and away from a gpt-oss failure mode:
 * - get_user_location runs on the server first (the station is already resolved), so the model
 *   starts from its result instead of spending a round trip on it.
 * - Once the evidence for the question is complete, the answer comes from a call without tools
 *   and with the strict JSON schema. With tools on, gpt-oss sometimes wraps its JSON answer as
 *   a call to a tool named "json", which Groq rejects with 400 tool_use_failed.
 */
async function askModel(
  quickMessageId: QuickMessageId,
  llm: LLMClient,
  ctx: ToolContext,
  limits: ChatLimits,
  signal: AbortSignal,
): Promise<ParsedAnswer | null> {
  const question = QUICK_MESSAGES[quickMessageId];
  const tools = toolDeclarations(question.allowedTools);
  const messages: LLMMessage[] = [{ role: 'user', content: question.text }];
  const ask = (extra: Partial<Parameters<LLMClient['generate']>[0]>) => {
    if (signal.aborted) throw new LLMError('unavailable', 'Timed out');
    // A copy: the conversation keeps growing after the request is sent (and maybe recorded).
    return llm.generate({
      systemPrompt: SYSTEM_PROMPT,
      messages: [...messages],
      temperature: TEMPERATURE,
      signal,
      ...extra,
    });
  };
  const pushToolResults = (calls: LLMToolCall[], results: ToolResult[]) => {
    calls.forEach((call, j) => {
      const result = results[j];
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(result.ok ? result.output : { error: result.error }),
      });
    });
  };
  const strictAnswer = async () =>
    parseFinalAnswer((await ask({ jsonSchema: FINAL_ANSWER_SCHEMA })).text);

  const locationCall: LLMToolCall = { id: 'call_location', name: 'get_user_location', args: {} };
  messages.push({ role: 'assistant', content: null, toolCalls: [locationCall] });
  pushToolResults([locationCall], [await executeTool(locationCall.name, {}, ctx, limits)]);

  try {
    for (let i = 0; i < limits.maxToolIterations; i++) {
      if (hasEvidenceFor(quickMessageId, ctx.evidence)) return await strictAnswer();
      const reply = await ask({ tools });
      if (!reply.toolCalls?.length) {
        const answer = parseFinalAnswer(reply.text);
        if (answer) return answer;
        // Groq cannot combine tools and structured output, so the JSON comes from a call without
        // tools.
        if (reply.text) messages.push({ role: 'assistant', content: reply.text });
        messages.push({ role: 'user', content: FINAL_ANSWER_INSTRUCTION });
        return await strictAnswer();
      }
      messages.push({ role: 'assistant', content: reply.text ?? null, toolCalls: reply.toolCalls });
      const results = await Promise.all(
        reply.toolCalls.map((call) => runToolCall(call, question.allowedTools, ctx, limits)),
      );
      pushToolResults(reply.toolCalls, results);
    }
    // The model never stopped calling tools: deterministic answer (§11).
    return null;
  } catch (err) {
    if (err instanceof LLMError && err.kind === 'bad_output') return null;
    throw err;
  }
}

/** The model's answer if it passed every check and saw the data it needs; else a safe one. */
async function decideAnswer(
  quickMessageId: QuickMessageId,
  answer: ParsedAnswer | null,
  ctx: ToolContext,
  limits: ChatLimits,
): Promise<{ outcome: 'answered' | 'fallback_no_data'; message: string; facilityIds: string[] }> {
  const { evidence } = ctx;
  if (answer && hasEvidenceFor(quickMessageId, evidence)) {
    const check = checkAnswer(answer, quickMessageId, evidence);
    if (check.ok && !lacksFacilities(quickMessageId, evidence)) {
      // A facility answer without cards leaves the user nothing to tap: use the rows the
      // deterministic answer would show (data rows, never model text).
      const facilityIds =
        check.facilityIds.length > 0 || FACILITY_TYPE[quickMessageId] === null
          ? check.facilityIds
          : composeAnswer(quickMessageId, evidence.outputs, ctx.station.name).facilityIds;
      return { outcome: 'answered', message: answer.message, facilityIds };
    }
    if (!check.ok) console.warn(`[chat] model answer replaced: ${check.problems.join(', ')}`);
  }
  await ensureEvidence(quickMessageId, ctx, limits);
  return composeAnswer(quickMessageId, evidence.outputs, ctx.station.name);
}

function hasEvidenceFor(quickMessageId: QuickMessageId, evidence: Evidence): boolean {
  const { outputs } = evidence;
  if (quickMessageId === 'review_summary') return outputs.reviews !== undefined;
  if (!outputs.nearest) return false;
  if (outputs.nearest.facilities.length > 0 && !outputs.status) return false;
  if (quickMessageId === 'time_to_refill' && staleTrains(evidence)) return false;
  return true;
}

/**
 * time_to_refill needs a train check computed with the walk time of the nearest available
 * dispenser. The model picks walk_time_min itself, so a check made with another value (and its
 * enough_time) is not trusted.
 */
function staleTrains(evidence: Evidence): boolean {
  const available = firstAvailableWater(evidence);
  if (!available) return false;
  const trains = evidence.outputs.trains;
  if (!trains) return true;
  if (!trains.data_available || trains.departures.length === 0) return false;
  return trains.time_check?.needed_minutes !== 2 * available.walk_time_min + FILL_BUFFER_MIN;
}

function lacksFacilities(quickMessageId: QuickMessageId, evidence: Evidence): boolean {
  const type = FACILITY_TYPE[quickMessageId];
  if (type === null) return false;
  const facilities = evidence.outputs.nearest?.facilities ?? [];
  return !facilities.some((f) => type === 'any' || f.type === type);
}

function firstAvailableWater(evidence: Evidence) {
  return (evidence.outputs.nearest?.facilities ?? []).find(
    (f) => f.type === 'water' && evidence.statuses.get(f.facility_id)?.status === 'available',
  );
}

/** Runs, server-side, the tool calls a deterministic answer needs and the model skipped. */
async function ensureEvidence(
  quickMessageId: QuickMessageId,
  ctx: ToolContext,
  limits: ChatLimits,
): Promise<void> {
  const { outputs } = ctx.evidence;
  const stationId = ctx.station.id;
  const type = FACILITY_TYPE[quickMessageId];
  if (type === null) {
    if (!outputs.reviews) {
      await executeTool('search_reviews', { station_id: stationId }, ctx, limits);
    }
    return;
  }

  if (!outputs.nearest || outputs.nearest.type !== type) {
    const args = { station_id: stationId, type, limit: MAX_NEAREST_LIMIT };
    await executeTool('get_nearest_facility', args, ctx, limits);
  }
  const ids = (outputs.nearest?.facilities ?? []).map((f) => f.facility_id);
  const covered = new Set(outputs.status?.statuses.map((s) => s.facility_id));
  if (ids.length > 0 && ids.some((id) => !covered.has(id))) {
    await executeTool('get_facility_status', { facility_ids: ids }, ctx, limits);
  }

  const available = quickMessageId === 'time_to_refill' ? firstAvailableWater(ctx.evidence) : null;
  if (available && staleTrains(ctx.evidence)) {
    const args = { station_id: stationId, walk_time_min: available.walk_time_min };
    await executeTool('get_next_train', args, ctx, limits);
  }
}

async function runToolCall(
  call: LLMToolCall,
  allowed: readonly ChatbotToolName[],
  ctx: ToolContext,
  limits: ChatLimits,
): Promise<ToolResult> {
  // Unknown or disallowed tools are not executed; the model gets an error and may continue.
  if (!(allowed as readonly string[]).includes(call.name)) {
    return { ok: false, error: 'This tool is not available for this question.' };
  }
  let args = call.args;
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: 'Tool arguments must be a JSON object.' };
    }
  }
  return executeTool(call.name, args, ctx, limits);
}

async function executeTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
  limits: ChatLimits,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) return { ok: false, error: 'This tool does not exist.' };
  ctx.evidence.toolsCalled.push(tool.name);
  try {
    return await withTimeout(tool.run(args, ctx), limits.toolTimeoutMs);
  } catch {
    return { ok: false, error: `${tool.name} timed out. Do not guess the missing data.` };
  }
}

/** Cards from data rows by facility id (§9 step 9), never from model text. */
async function buildCards(facilityIds: string[], ctx: ToolContext): Promise<ChatCard[]> {
  const { evidence } = ctx;
  const missing = facilityIds.filter((id) => !evidence.statuses.has(id));
  const fetched = new Map(
    missing.length > 0
      ? (await ctx.provider.getFacilityStatuses(missing).catch(() => [])).map((row) => [
          row.facilityId,
          row,
        ])
      : [],
  );

  return facilityIds.flatMap((id) => {
    const facility = evidence.facilities.get(id);
    if (!facility) return [];
    const known = evidence.statuses.get(id);
    const row = fetched.get(id);
    const lastReportedAt = known?.last_reported_at ?? row?.lastReportedAt ?? null;
    return [
      {
        facilityId: id,
        name: facility.name,
        type: facility.type,
        platform: facility.platform,
        locationDetail: facility.location_detail,
        level: facility.level,
        distanceM: facility.distance_m,
        distanceIsApproximate: true,
        walkTimeMin: facility.walk_time_min,
        status: known?.status ?? row?.status ?? 'unknown',
        lastReportedAt,
        minutesAgo:
          lastReportedAt === null
            ? null
            : Math.max(0, Math.floor((ctx.now.getTime() - Date.parse(lastReportedAt)) / 60_000)),
      },
    ];
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Field paths only, never values: values can hold client text. Body-level problems (not JSON,
// unknown extra keys) have an empty path and show as "(body)".
function issuePaths(issues: readonly { path: readonly PropertyKey[] }[]): string {
  const paths = issues.map((issue) => issue.path.map(String).join('.') || '(body)');
  return [...new Set(paths)].join(', ');
}
