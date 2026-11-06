import 'server-only';
import Groq from 'groq-sdk';
import { APP_CONFIG } from '@/lib/config';

// Groq runs the chatbot (chat completions with tool calling). Embeddings stay on Gemini
// (src/lib/gemini/embeddings.ts) because Groq has no embedding models.
// GROQ_API_KEY is server-only: never import this module from client components.

let client: Groq | null = null;

/**
 * The shared Groq client, or null when GROQ_API_KEY is missing (the chatbot then answers
 * with fallback_ai_unavailable). No automatic retries: a 429 or timeout should fall back
 * right away instead of eating into the 10-second budget.
 */
export function getGroqClient(): Groq | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  client ??= new Groq({ apiKey, maxRetries: 0, timeout: APP_CONFIG.CHAT_TIMEOUT_MS });
  return client;
}

/** Chat model id from GROQ_MODEL (check console.groq.com/docs/models for current ids). */
export function getChatModel(): string | null {
  return process.env.GROQ_MODEL || null;
}
