/**
 * src/app/api/chat/route.ts
 *
 * POST /api/chat (docs/AI_TRACK.md §3.1 and §13). Every response body is a ChatResponse.
 * 200: answered and every fallback. 400: invalid body or unknown quickMessageId (rejected).
 * 429: rate limited (rejected, Retry-After header). 500: unexpected bug, generic body.
 */

import { NextResponse, type NextRequest } from 'next/server';
import {
  CHATBOT_MODES,
  DEFAULT_CHATBOT_MODE,
  MAX_REQUEST_BODY_BYTES,
  RATE_LIMIT_CHAT,
  RATE_LIMIT_WINDOW_SEC,
  type ChatbotMode,
} from '@/lib/chatbot/config';
import type { ChatOutcome, ChatRequest, ChatResponse } from '@/lib/chatbot/contract';
import { FALLBACK_MESSAGES } from '@/lib/chatbot/prompts';
import { InMemoryRateLimiter } from '@/lib/chatbot/rateLimit';
import { getStubChatResponse } from '@/lib/chatbot/stub';
import { ChatRequestSchema } from '@/lib/chatbot/validation';
// Backend's rate-limit key: user id when logged in, else an HMAC of the IP (IP_HASH_SALT).
import { chatRateLimitKey } from '@/lib/rate-limit';

// Vercel Hobby allows up to 300 s with Fluid compute (docs checked 2026-11-01).
// 15 s covers the 10 s hard timeout plus a margin.
export const maxDuration = 15;

const rateLimiter = new InMemoryRateLimiter();

export async function POST(req: NextRequest): Promise<NextResponse<ChatResponse>> {
  const now = new Date();
  try {
    const parsed = ChatRequestSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      console.warn(`[chat] 400 rejected: ${issuePaths(parsed.error.issues)}`);
      return NextResponse.json(emptyResponse('rejected', FALLBACK_MESSAGES.rejected, now), {
        status: 400,
      });
    }

    // Guests only for now; the signed-in user id is passed once the orchestrator lands.
    const limit = await rateLimiter.check(
      chatRateLimitKey(req.headers, null),
      'chat',
      RATE_LIMIT_CHAT,
      RATE_LIMIT_WINDOW_SEC,
    );
    if (!limit.allowed) {
      const retryAfterSec = limit.retryAfterSec ?? RATE_LIMIT_WINDOW_SEC;
      const body: ChatResponse = {
        ...emptyResponse('rejected', FALLBACK_MESSAGES.rateLimited, now),
        retryAfterSec,
      };
      return NextResponse.json(body, {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      });
    }

    return NextResponse.json(answer(parsed.data, now), { status: 200 });
  } catch {
    // Never echo the error: no stack traces or internals in the response.
    return NextResponse.json(
      emptyResponse('fallback_ai_unavailable', FALLBACK_MESSAGES.aiUnavailable, now),
      { status: 500 },
    );
  }
}

function answer(request: ChatRequest, now: Date): ChatResponse {
  if (resolveMode(process.env.CHATBOT_MODE) === 'stub') return getStubChatResponse(request, now);
  // fake and live arrive with the orchestrator. Until then, and for unknown values, say so
  // honestly instead of serving canned data under their name.
  return emptyResponse('fallback_ai_unavailable', FALLBACK_MESSAGES.aiUnavailable, now);
}

function resolveMode(raw: string | undefined): ChatbotMode | null {
  const value = raw?.trim().toLowerCase() || DEFAULT_CHATBOT_MODE;
  return CHATBOT_MODES.find((mode) => mode === value) ?? null;
}

// Returns undefined, which the schema rejects, for a non-JSON content type, an oversized body,
// or unparseable JSON. Requiring application/json also forces a CORS preflight on cross-site
// browser requests, so other sites cannot spend our quota through their visitors.
async function readJsonBody(req: NextRequest): Promise<unknown> {
  const mediaType = req.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') return undefined;
  if (Number(req.headers.get('content-length') ?? 0) > MAX_REQUEST_BODY_BYTES) return undefined;

  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Field paths only, never values: values can hold coordinates or client text. Body-level
// problems (not JSON, unknown extra keys) have an empty path and show as "(body)".
function issuePaths(issues: readonly { path: readonly PropertyKey[] }[]): string {
  const paths = issues.map((issue) => issue.path.map(String).join('.') || '(body)');
  return [...new Set(paths)].join(', ');
}

function emptyResponse(outcome: ChatOutcome, message: string, now: Date): ChatResponse {
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
