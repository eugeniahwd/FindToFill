/**
 * src/lib/chatbot/llm/types.ts
 *
 * The LLM seam (docs/AI_TRACK.md §3.3): one model turn per call. GroqLLMClient is the real one,
 * FakeLLMClient the offline one.
 */

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMToolCall {
  id: string;
  name: string;
  /** Parsed JSON arguments, or the raw string when the model sent invalid JSON. */
  args: unknown;
}

export type LLMMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: LLMToolCall[] }
  | { role: 'tool'; toolCallId: string; name: string; content: string };

export interface JsonSchemaFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface LLMRequest {
  systemPrompt: string;
  messages: LLMMessage[];
  /** Tools the model may call. Never combined with jsonSchema (Groq does not support it). */
  tools?: ToolDeclaration[];
  /** Strict JSON output for the final answer, in a call without tools. */
  jsonSchema?: JsonSchemaFormat;
  temperature: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  text?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMClient {
  generate(request: LLMRequest): Promise<LLMResponse>;
}

/**
 * "unavailable": quota (429), server error, timeout, or no network: the chatbot answers with
 * fallback_ai_unavailable. "bad_output": the model sent something unusable (for example an
 * invalid tool call): the chatbot builds a deterministic answer instead.
 */
export class LLMError extends Error {
  constructor(
    readonly kind: 'unavailable' | 'bad_output',
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
