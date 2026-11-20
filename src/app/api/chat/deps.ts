/**
 * src/app/api/chat/deps.ts
 *
 * Builds the orchestrator's dependencies for one request (docs/AI_TRACK.md §13).
 * CHATBOT_MODE picks who answers: stub (canned), fake (FakeLLMClient policy), live (Groq).
 * CHATBOT_DATA picks the data and the infrastructure: fake (demo data, in-memory rate limit,
 * console log line) or supabase (Backend provider, rate_limit_events, chat_logs).
 * Supabase is only imported here: src/lib/chatbot never imports it.
 */

import 'server-only';
import { ApiError } from '@/lib/api/errors';
import { chatRateLimitKey, consumeRateLimit, type RateLimitRule } from '@/lib/rate-limit';
import { logChat } from '@/lib/data/chatLogs';
import { SupabaseDataProvider } from '@/lib/data/chatbotProvider';
import { embedQueryCached } from '@/lib/gemini/embeddings';
import { getChatModel, getGroqClient } from '@/lib/groq/client';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fixedClock } from '@/lib/chatbot/clock';
import { CHATBOT_MODES, DEFAULT_CHATBOT_MODE, type ChatbotMode } from '@/lib/chatbot/config';
import { createFakeDataProvider } from '@/lib/chatbot/data';
import type { ChatbotDataProvider } from '@/lib/chatbot/data/provider';
import { FakeLLMClient } from '@/lib/chatbot/llm/fakeLlmClient';
import { GroqLLMClient } from '@/lib/chatbot/llm/groqClient';
import type { LLMClient } from '@/lib/chatbot/llm/types';
import { ConsoleChatLogger, type ChatLogger } from '@/lib/chatbot/logger';
import type { ChatDeps } from '@/lib/chatbot/orchestrator';
import {
  InMemoryRateLimiter,
  type RateLimiter,
  type RateLimitResult,
} from '@/lib/chatbot/rateLimit';

export const CHATBOT_DATA_SOURCES = ['fake', 'supabase'] as const;
export type ChatbotDataSource = (typeof CHATBOT_DATA_SOURCES)[number];
const DEFAULT_DATA_SOURCE: ChatbotDataSource = 'fake';

// Per server instance: resets on a cold start (README notes this). supabase mode uses the database.
const memoryRateLimiter = new InMemoryRateLimiter();
const consoleLogger = new ConsoleChatLogger();

export function resolveMode(raw: string | undefined): ChatbotMode | null {
  const value = raw?.trim().toLowerCase() || DEFAULT_CHATBOT_MODE;
  return CHATBOT_MODES.find((mode) => mode === value) ?? null;
}

export function resolveDataSource(raw: string | undefined): ChatbotDataSource | null {
  const value = raw?.trim().toLowerCase() || DEFAULT_DATA_SOURCE;
  return CHATBOT_DATA_SOURCES.find((source) => source === value) ?? null;
}

/** This file reads CHATBOT_MODE and CHATBOT_DATA; GROQ_* are read by getGroqClient(). */
export type ChatEnv = Readonly<Record<string, string | undefined>>;

/**
 * Unknown CHATBOT_MODE or CHATBOT_DATA values answer fallback_ai_unavailable: never demo data
 * under a name that promises something else.
 */
export async function buildChatDeps(
  headers: Headers,
  env: ChatEnv = process.env,
): Promise<ChatDeps> {
  const now = new Date();
  const mode = resolveMode(env.CHATBOT_MODE);
  const source = resolveDataSource(env.CHATBOT_DATA);
  const { supabaseProvider, ...infra } =
    source === 'supabase' ? await supabaseInfra(headers, now) : memoryInfra(headers);
  const base = { ...infra, clock: fixedClock(now) };

  if (mode === 'stub') return { ...base, answer: 'stub', provider: null, llm: null };
  if (!mode || !source) return { ...base, answer: 'agent', provider: null, llm: null };
  return {
    ...base,
    answer: 'agent',
    provider: source === 'fake' ? createFakeDataProvider('default', now) : supabaseProvider,
    llm: llmClient(mode),
  };
}

interface Infra {
  rateLimiter: RateLimiter;
  logger: ChatLogger;
  identity: string;
  supabaseProvider: ChatbotDataProvider | null;
}

function memoryInfra(headers: Headers): Infra {
  return {
    rateLimiter: memoryRateLimiter,
    logger: consoleLogger,
    identity: chatRateLimitKey(headers, null),
    supabaseProvider: null,
  };
}

async function supabaseInfra(headers: Headers, now: Date): Promise<Infra> {
  const admin = createSupabaseAdminClient();
  return {
    rateLimiter: new DatabaseRateLimiter((key, rule) => consumeRateLimit(admin, key, rule)),
    logger: { log: (entry) => logChat(admin, entry) },
    identity: chatRateLimitKey(headers, await signedInUserId(headers)),
    supabaseProvider: createSupabaseProvider(admin, now),
  };
}

/**
 * The Backend's SupabaseDataProvider (src/lib/data/chatbotProvider.ts), checked by
 * tests/chatbot/provider.contract.ts in tests/chatbotSupabaseProvider.test.ts.
 * The admin client gives every request the same read path, guest or signed in, without a
 * cookie-bound client. The provider only reads, and filters removed reports and reviews and
 * inactive facilities itself (RLS does not apply to the service role).
 */
function createSupabaseProvider(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  now: Date,
): ChatbotDataProvider {
  return new SupabaseDataProvider(admin, { now: () => now, embedQuery: embedQueryCached });
}

function llmClient(mode: Exclude<ChatbotMode, 'stub'>): LLMClient | null {
  if (mode === 'fake') return new FakeLLMClient({ mode: 'policy' });
  const groq = getGroqClient();
  const model = getChatModel();
  return groq && model ? new GroqLLMClient(groq, { model }) : null;
}

/** The signed-in user id from the auth cookies, or null for a guest or any auth error. */
async function signedInUserId(headers: Headers): Promise<string | null> {
  if (!headers.get('cookie')) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    return error ? null : (data.user?.id ?? null);
  } catch {
    return null;
  }
}

export type ConsumeRateLimit = (key: string, rule: RateLimitRule) => Promise<void>;

/**
 * The Backend's sliding window in rate_limit_events behind the RateLimiter seam. consumeRateLimit
 * reports a full window as ApiError 429 without a reset time, so retryAfterSec is the window.
 * Any other database error fails open: the free Groq tier has its own hard quota, and a broken
 * database already turns the answer into a fallback.
 */
export class DatabaseRateLimiter implements RateLimiter {
  constructor(private readonly consume: ConsumeRateLimit) {}

  async check(
    key: string,
    action: 'chat',
    max: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    try {
      await this.consume(key, { action, limit: max, windowMs: windowSec * 1000 });
      return { allowed: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        return { allowed: false, retryAfterSec: windowSec };
      }
      console.error(`[chat] rate limit check failed: ${err instanceof Error ? err.name : 'unknown'}`);
      return { allowed: true };
    }
  }
}
