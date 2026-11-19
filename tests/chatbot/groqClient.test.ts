/**
 * @jest-environment node
 */
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from 'groq-sdk/resources/chat/completions';
import { GroqLLMClient, type GroqChat } from '../../src/lib/chatbot/llm/groqClient';
import { LLMError, type LLMRequest } from '../../src/lib/chatbot/llm/types';

type Reply = ChatCompletion | Error;

function fakeGroq(replies: Reply[]) {
  const calls: Array<{ body: ChatCompletionCreateParamsNonStreaming; signal?: AbortSignal }> = [];
  const groq: GroqChat = {
    chat: {
      completions: {
        async create(body, options) {
          calls.push({ body, signal: options?.signal });
          const reply = replies.shift();
          if (!reply) throw new Error('no reply scripted');
          if (reply instanceof Error) throw reply;
          return reply;
        },
      },
    },
  };
  return { groq, calls };
}

function completion(message: Partial<ChatCompletion.Choice['message']>): ChatCompletion {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'openai/gpt-oss-20b',
    choices: [
      {
        index: 0,
        finish_reason: message.tool_calls ? 'tool_calls' : 'stop',
        logprobs: null,
        message: { role: 'assistant', content: null, ...message },
      },
    ],
  };
}

function apiError(status: number): Error {
  return Object.assign(new Error(`status ${status}`), { status });
}

function client(groq: GroqChat): GroqLLMClient {
  return new GroqLLMClient(groq, { model: 'openai/gpt-oss-20b' });
}

const TOOL = {
  name: 'get_user_location',
  description: 'Stasiun pengguna.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
};

const BASE: LLMRequest = {
  systemPrompt: 'SYSTEM',
  messages: [{ role: 'user', content: 'Dispenser air terdekat?' }],
  temperature: 0,
};

describe('GroqLLMClient request', () => {
  it('sends the system prompt, the tools, and the GPT-OSS reasoning settings', async () => {
    const { groq, calls } = fakeGroq([completion({ content: 'ok' })]);
    const controller = new AbortController();

    await client(groq).generate({ ...BASE, tools: [TOOL], signal: controller.signal });

    const { body, signal } = calls[0];
    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(body.temperature).toBe(0);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Dispenser air terdekat?' });
    expect(body.tools).toEqual([{ type: 'function', function: TOOL }]);
    expect(body.tool_choice).toBe('auto');
    expect(body.response_format).toBeUndefined();
    expect(body.reasoning_effort).toBe('low');
    expect(body.include_reasoning).toBe(false);
    expect(signal).toBe(controller.signal);
  });

  it('uses strict JSON output only in a call without tools', async () => {
    const { groq, calls } = fakeGroq([completion({ content: '{}' }), completion({ content: '{}' })]);
    const jsonSchema = { name: 'chat_answer', schema: { type: 'object' } };

    await client(groq).generate({ ...BASE, jsonSchema });
    await client(groq).generate({ ...BASE, jsonSchema, tools: [TOOL] });

    expect(calls[0].body.response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'chat_answer', schema: { type: 'object' }, strict: true },
    });
    expect(calls[0].body.tools).toBeUndefined();
    expect(calls[1].body.response_format).toBeUndefined();
  });

  it('leaves out the reasoning settings for other models', async () => {
    const { groq, calls } = fakeGroq([completion({ content: 'ok' })]);
    await new GroqLLMClient(groq, { model: 'llama-3.3-70b-versatile' }).generate(BASE);

    expect(calls[0].body.reasoning_effort).toBeUndefined();
    expect(calls[0].body.include_reasoning).toBeUndefined();
  });

  it('maps assistant tool calls and tool results to the Groq message format', async () => {
    const { groq, calls } = fakeGroq([completion({ content: 'ok' })]);
    await client(groq).generate({
      ...BASE,
      messages: [
        { role: 'user', content: 'Q' },
        {
          role: 'assistant',
          content: null,
          toolCalls: [{ id: 'call_1', name: 'find_nearest_facility', args: { type: 'water' } }],
        },
        { role: 'tool', toolCallId: 'call_1', name: 'find_nearest_facility', content: '{"a":1}' },
      ],
    });

    expect(calls[0].body.messages.slice(2)).toEqual([
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: { name: 'find_nearest_facility', arguments: '{"type":"water"}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'call_1', content: '{"a":1}' },
    ]);
  });
});

describe('GroqLLMClient response', () => {
  it('returns the text of a final answer', async () => {
    const { groq } = fakeGroq([completion({ content: '{"message":"Halo","facility_ids":[]}' })]);
    const response = await client(groq).generate(BASE);

    expect(response.text).toBe('{"message":"Halo","facility_ids":[]}');
    expect(response.toolCalls).toBeUndefined();
  });

  it('parses tool call arguments, and keeps invalid JSON as the raw string', async () => {
    const { groq } = fakeGroq([
      completion({
        tool_calls: [
          { id: 'c1', type: 'function', function: { name: 'get_user_location', arguments: '{}' } },
          {
            id: 'c2',
            type: 'function',
            function: { name: 'find_nearest_facility', arguments: '{type: water' },
          },
        ],
      }),
    ]);
    const response = await client(groq).generate(BASE);

    expect(response.text).toBeUndefined();
    expect(response.toolCalls).toEqual([
      { id: 'c1', name: 'get_user_location', args: {} },
      { id: 'c2', name: 'find_nearest_facility', args: '{type: water' },
    ]);
  });

  it('treats a response without choices as bad output', async () => {
    const { groq } = fakeGroq([{ ...completion({ content: 'x' }), choices: [] }]);
    await expect(client(groq).generate(BASE)).rejects.toMatchObject({ kind: 'bad_output' });
  });
});

describe('GroqLLMClient errors', () => {
  it.each([429, 500, 503, 401, 403])('maps HTTP %i to unavailable', async (status) => {
    const { groq } = fakeGroq([apiError(status)]);
    const error: unknown = await client(groq)
      .generate(BASE)
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(LLMError);
    expect(error).toMatchObject({ kind: 'unavailable', status });
  });

  it('maps a timeout, an abort, or a network error (no status) to unavailable', async () => {
    const { groq } = fakeGroq([new Error('Request timed out.')]);
    const result = client(groq).generate(BASE);
    await expect(result).rejects.toMatchObject({ kind: 'unavailable', status: undefined });
  });

  it('maps other 4xx errors, such as a rejected tool call, to bad output', async () => {
    const { groq } = fakeGroq([apiError(400)]);
    const result = client(groq).generate(BASE);
    await expect(result).rejects.toMatchObject({ kind: 'bad_output', status: 400 });
  });

  it('never copies the SDK error message (it can contain request details)', async () => {
    const { groq } = fakeGroq([apiError(500)]);
    await expect(client(groq).generate(BASE)).rejects.toThrow('The model is unavailable.');
  });
});
