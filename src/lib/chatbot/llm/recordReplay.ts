/**
 * src/lib/chatbot/llm/recordReplay.ts
 *
 * For the eval only (docs/AI_TRACK.md §15): "record" saves each model response under a hash of
 * the request; "replay" answers from those files without the network, so live results can be
 * checked again without spending the free quota.
 *
 * Record mode reuses a response that is already saved instead of calling the model again. Cases
 * that start with the same request (same question and station) then share that first response,
 * and every recorded conversation can be replayed to its end. Overwriting would break the
 * earlier cases' chains. Delete the folder to record everything fresh.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LLMError, type LLMClient, type LLMRequest, type LLMResponse } from './types';

export class RecordReplayLLMClient implements LLMClient {
  constructor(
    private readonly mode: 'record' | 'replay',
    private readonly directory: string,
    private readonly inner: LLMClient | null = null,
  ) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const file = join(this.directory, `${requestKey(request)}.json`);
    if (existsSync(file)) return replay(JSON.parse(readFileSync(file, 'utf8')) as Recording);
    if (this.mode === 'replay') throw new LLMError('unavailable', `No recording for ${file}`);
    if (!this.inner) throw new LLMError('unavailable', 'Record mode needs a model.');

    let recording: Recording;
    try {
      recording = await this.inner.generate(request);
    } catch (err) {
      // A rejected model output (such as Groq's 400 tool_use_failed) is part of the run and is
      // saved. Quota, server, and network errors are not: the next run should try again.
      if (!(err instanceof LLMError) || err.kind !== 'bad_output') throw err;
      recording = { error: { kind: 'bad_output', status: err.status } };
    }
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(file, `${JSON.stringify(recording, null, 2)}\n`);
    return replay(recording);
  }
}

type Recording = LLMResponse | { error: { kind: 'bad_output'; status?: number } };

function replay(recording: Recording): LLMResponse {
  if ('error' in recording) {
    throw new LLMError('bad_output', 'Recorded model output error.', recording.error.status);
  }
  return recording;
}

/** The same conversation always gets the same key (the abort signal is not part of it). */
export function requestKey(request: LLMRequest): string {
  const { systemPrompt, messages, tools, jsonSchema, temperature } = request;
  const json = JSON.stringify({ systemPrompt, messages, tools, jsonSchema, temperature });
  return createHash('sha256').update(json).digest('hex').slice(0, 24);
}
