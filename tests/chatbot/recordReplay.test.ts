/**
 * @jest-environment node
 */
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RecordReplayLLMClient, requestKey } from '../../src/lib/chatbot/llm/recordReplay';
import {
  LLMError,
  type LLMClient,
  type LLMRequest,
  type LLMResponse,
} from '../../src/lib/chatbot/llm/types';

class FailingClient implements LLMClient {
  calls = 0;
  constructor(private readonly error: LLMError) {}
  async generate(): Promise<LLMResponse> {
    this.calls += 1;
    throw this.error;
  }
}

const REQUEST: LLMRequest = {
  systemPrompt: 'SYSTEM',
  messages: [{ role: 'user', content: 'Q' }],
  temperature: 0,
};

class CountingClient implements LLMClient {
  calls = 0;
  constructor(private readonly response: LLMResponse) {}
  async generate(): Promise<LLMResponse> {
    this.calls += 1;
    return this.response;
  }
}

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'chat-recordings-'));
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('requestKey', () => {
  it('is stable, ignores the abort signal, and changes with the conversation', () => {
    const signal = new AbortController().signal;
    expect(requestKey(REQUEST)).toBe(requestKey({ ...REQUEST, signal }));
    expect(requestKey(REQUEST)).not.toBe(
      requestKey({ ...REQUEST, messages: [{ role: 'user', content: 'Q2' }] }),
    );
  });
});

describe('RecordReplayLLMClient', () => {
  it('records a response and replays it without calling the model', async () => {
    const response: LLMResponse = { toolCalls: [{ id: 'c1', name: 'get_user_location', args: {} }] };
    const inner = new CountingClient(response);

    const recorded = await new RecordReplayLLMClient('record', directory, inner).generate(REQUEST);
    expect(recorded).toEqual(response);
    expect(readdirSync(directory)).toHaveLength(1);

    const replayed = await new RecordReplayLLMClient('replay', directory).generate(REQUEST);
    expect(replayed).toEqual(response);
    expect(inner.calls).toBe(1);
  });

  it('reuses a saved response in record mode instead of calling the model again', async () => {
    const first = new CountingClient({ text: 'first' });
    const second = new CountingClient({ text: 'second' });

    await new RecordReplayLLMClient('record', directory, first).generate(REQUEST);
    const again = await new RecordReplayLLMClient('record', directory, second).generate(REQUEST);

    expect(again).toEqual({ text: 'first' });
    expect(second.calls).toBe(0);
    expect(readdirSync(directory)).toHaveLength(1);
  });

  it('records a rejected model output (400) and replays it as the same error', async () => {
    const inner = new FailingClient(new LLMError('bad_output', 'tool_use_failed', 400));

    await expect(
      new RecordReplayLLMClient('record', directory, inner).generate(REQUEST),
    ).rejects.toMatchObject({ kind: 'bad_output', status: 400 });
    await expect(
      new RecordReplayLLMClient('replay', directory).generate(REQUEST),
    ).rejects.toMatchObject({ kind: 'bad_output', status: 400 });
    expect(inner.calls).toBe(1);
  });

  it('does not record quota or server errors, so the next run tries again', async () => {
    const inner = new FailingClient(new LLMError('unavailable', 'rate limited', 429));

    await expect(
      new RecordReplayLLMClient('record', directory, inner).generate(REQUEST),
    ).rejects.toMatchObject({ kind: 'unavailable', status: 429 });
    expect(readdirSync(directory)).toHaveLength(0);
  });

  it('fails as unavailable when a recording is missing', async () => {
    const result = new RecordReplayLLMClient('replay', directory).generate(REQUEST);
    await expect(result).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('needs a model to record', async () => {
    const result = new RecordReplayLLMClient('record', directory).generate(REQUEST);
    await expect(result).rejects.toMatchObject({ kind: 'unavailable' });
  });
});
