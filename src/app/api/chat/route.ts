/**
 * src/app/api/chat/route.ts
 *
 * POST /api/chat (docs/AI_TRACK.md §3.1 and §13). Every response body is a ChatResponse.
 * 200: answered and every fallback. 400: invalid body or unknown quickMessageId (rejected).
 * 429: rate limited (rejected, Retry-After header). 500: unexpected bug, generic body.
 * Modes and data sources are picked in ./deps.ts; the work happens in handleChat.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { MAX_REQUEST_BODY_BYTES } from '@/lib/chatbot/config';
import type { ChatResponse } from '@/lib/chatbot/contract';
import { fallbackResponse, handleChat } from '@/lib/chatbot/orchestrator';
import { FALLBACK_MESSAGES } from '@/lib/chatbot/prompts';
import { buildChatDeps } from './deps';

// Vercel Hobby allows up to 300 s with Fluid compute (docs checked 2026-11-01).
// 15 s covers the 10 s hard timeout plus a margin.
export const maxDuration = 15;

export async function POST(req: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    const body = await readJsonBody(req);
    const { status, response } = await handleChat(body, await buildChatDeps(req.headers));
    const headers =
      status === 429 && response.retryAfterSec !== undefined
        ? { 'Retry-After': String(response.retryAfterSec) }
        : undefined;
    return NextResponse.json(response, { status, headers });
  } catch (err) {
    // Never echo the error: no stack traces or internals in the response or the log.
    console.error(`[chat] 500: ${err instanceof Error ? err.name : 'unknown'}`);
    return NextResponse.json(
      fallbackResponse('fallback_ai_unavailable', FALLBACK_MESSAGES.aiUnavailable, new Date()),
      { status: 500 },
    );
  }
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
