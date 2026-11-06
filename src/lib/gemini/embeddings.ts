import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { APP_CONFIG } from '@/lib/config';

// Text embeddings for review comments (RAG for the search_reviews chatbot tool).
// Never throws: a missing key, timeout, or API error returns null, and callers
// save the review without a vector (docs/AI_CHATBOT.md "Review embeddings").

export type EmbeddingPurpose = 'document' | 'query';

let client: GoogleGenAI | null = null;

function getClient(apiKey: string): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** gemini-embedding-001 only normalizes 3072-d output; cosine search expects unit vectors. */
export function normalize(values: number[]): number[] | null {
  const norm = Math.hypot(...values);
  if (!Number.isFinite(norm) || norm === 0) return null;
  return values.map((v) => v / norm);
}

/** pgvector text literal, e.g. "[0.1,0.2]". */
export function toPgVector(values: number[]): string {
  return `[${values.join(',')}]`;
}

// The chatbot's search queries are fixed strings, so each is embedded once per server instance.
const queryCache = new Map<string, number[]>();
const QUERY_CACHE_MAX = 20;

/** embedText(text, 'query') with an in-memory cache. Failures are not cached, so they retry next time. */
export async function embedQueryCached(text: string): Promise<number[] | null> {
  const cached = queryCache.get(text);
  if (cached) return cached;
  const vector = await embedText(text, 'query');
  if (vector && queryCache.size < QUERY_CACHE_MAX) queryCache.set(text, vector);
  return vector;
}

export async function embedText(text: string, purpose: EmbeddingPurpose): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBEDDING_MODEL;
  if (!apiKey || !model || !text) return null;

  try {
    const response = await getClient(apiKey).models.embedContent({
      model,
      contents: text,
      config: {
        outputDimensionality: APP_CONFIG.EMBEDDING_DIMENSIONS,
        // gemini-embedding-2 does not accept a task type.
        ...(model.startsWith('gemini-embedding-2')
          ? {}
          : { taskType: purpose === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY' }),
        abortSignal: AbortSignal.timeout(APP_CONFIG.EMBEDDING_TIMEOUT_MS),
      },
    });
    const values = response.embeddings?.[0]?.values;
    if (!values || values.length !== APP_CONFIG.EMBEDDING_DIMENSIONS) return null;
    return normalize(values);
  } catch (err) {
    // Log only the error type: never the text or the key.
    console.error('Embedding failed:', err instanceof Error ? err.name : typeof err);
    return null;
  }
}
