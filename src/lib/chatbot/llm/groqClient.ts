/**
 * src/lib/chatbot/llm/groqClient.ts
 *
 * GroqLLMClient (docs/AI_TRACK.md §14): chat completions with tool calling on Groq. The Groq
 * instance is injected: the route passes getGroqClient() (src/lib/groq/client.ts: no retries,
 * 10 s timeout), the eval script builds its own. Checked against console.groq.com/docs
 * (tool use, reasoning, structured outputs) on 2026-11-19.
 */

import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from 'groq-sdk/resources/chat/completions';
import { LLMError, type LLMClient, type LLMRequest, type LLMResponse } from './types';

/** The part of the Groq SDK this client uses (a real Groq instance fits). */
export interface GroqChat {
  chat: {
    completions: {
      create(
        body: ChatCompletionCreateParamsNonStreaming,
        options?: { signal?: AbortSignal },
      ): Promise<ChatCompletion>;
    };
  };
}

export interface GroqOptions {
  model: string;
  /** GPT-OSS models only: low keeps reasoning short, for the 3-second target. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  maxCompletionTokens?: number;
}

export class GroqLLMClient implements LLMClient {
  constructor(
    private readonly groq: GroqChat,
    private readonly options: GroqOptions,
  ) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const tools = request.tools ?? [];
    const body: ChatCompletionCreateParamsNonStreaming = {
      model: this.options.model,
      temperature: request.temperature,
      max_completion_tokens: this.options.maxCompletionTokens ?? 1024,
      messages: toGroqMessages(request),
    };
    if (tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));
      body.tool_choice = 'auto';
    } else if (request.jsonSchema) {
      // Structured outputs cannot be combined with tools on Groq, so only in a call without tools.
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: request.jsonSchema.name, schema: request.jsonSchema.schema, strict: true },
      };
    }
    if (this.options.model.startsWith('openai/gpt-oss')) {
      body.reasoning_effort = this.options.reasoningEffort ?? 'low';
      body.include_reasoning = false;
    }

    let completion: ChatCompletion;
    try {
      completion = await this.groq.chat.completions.create(body, { signal: request.signal });
    } catch (err) {
      throw toLLMError(err);
    }

    const message = completion.choices[0]?.message;
    if (!message) throw new LLMError('bad_output', 'The model returned no message.');
    return {
      text: message.content ?? undefined,
      toolCalls: message.tool_calls?.map((call) => ({
        id: call.id,
        name: call.function.name,
        args: parseArguments(call.function.arguments),
      })),
    };
  }
}

function toGroqMessages(request: LLMRequest): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: request.systemPrompt }];
  for (const message of request.messages) {
    if (message.role === 'user') {
      messages.push({ role: 'user', content: message.content });
    } else if (message.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: message.toolCallId, content: message.content });
    } else {
      messages.push({
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: 'function' as const,
                function: {
                  name: call.name,
                  arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args),
                },
              })),
            }
          : {}),
      });
    }
  }
  return messages;
}

/** The model's arguments as JSON, or the raw string when it is not valid JSON. */
function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * 429, 5xx, 401/403 (bad key), timeouts, aborts, and network errors: "unavailable" (the chatbot
 * answers fallback_ai_unavailable). Other 4xx, such as a rejected tool call: "bad_output".
 */
function toLLMError(err: unknown): LLMError {
  const status =
    typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number'
      ? err.status
      : undefined;
  if (status === undefined || status === 429 || status >= 500 || status === 401 || status === 403) {
    return new LLMError('unavailable', 'The model is unavailable.', status);
  }
  return new LLMError('bad_output', 'The model request was rejected.', status);
}
