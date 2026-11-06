import 'server-only';
import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { APP_CONFIG } from '@/lib/config';
import { ApiError, fromDatabaseError } from '@/lib/api/errors';

// Sliding-window rate limits stored in rate_limit_events (service role only, no cron:
// old rows simply fall outside the window). Key = user id, or an IP hash for guests (chat).

type AdminDb = SupabaseClient<Database>;

export interface RateLimitRule {
  action: 'report' | 'review' | 'chat';
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS = {
  report: { action: 'report', limit: APP_CONFIG.MAX_REPORTS_PER_HOUR, windowMs: APP_CONFIG.RATE_LIMIT_WINDOW_MS },
  review: { action: 'review', limit: APP_CONFIG.MAX_REVIEWS_PER_HOUR, windowMs: APP_CONFIG.RATE_LIMIT_WINDOW_MS },
  chat: { action: 'chat', limit: APP_CONFIG.MAX_CHAT_PER_HOUR, windowMs: APP_CONFIG.RATE_LIMIT_WINDOW_MS },
} as const satisfies Record<string, RateLimitRule>;

/** Throws 429 RATE_LIMITED when `key` already used `rule.limit` actions inside the window. */
export async function assertWithinRateLimit(
  admin: AdminDb,
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<void> {
  const since = new Date(now.getTime() - rule.windowMs).toISOString();
  const { count, error } = await admin
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('key', key)
    .eq('action', rule.action)
    .gte('created_at', since);
  if (error) throw fromDatabaseError(error);

  if ((count ?? 0) >= rule.limit) {
    const minutes = Math.round(rule.windowMs / 60000);
    throw new ApiError(429, 'RATE_LIMITED', `Limit reached: ${rule.limit} per ${minutes} minutes. Please try again later.`);
  }
}

export async function recordRateLimitEvent(admin: AdminDb, key: string, rule: RateLimitRule): Promise<void> {
  const { error } = await admin.from('rate_limit_events').insert({ key, action: rule.action });
  if (error) throw fromDatabaseError(error);
}

/** Checks the limit, then counts this request. Use for chat, where every request costs a model call. */
export async function consumeRateLimit(admin: AdminDb, key: string, rule: RateLimitRule, now?: Date): Promise<void> {
  await assertWithinRateLimit(admin, key, rule, now);
  await recordRateLimitEvent(admin, key, rule);
}

// ---------------------------------------------------------------------------
// Guest keys: an HMAC of the client IP, so raw IP addresses are never stored.
// ---------------------------------------------------------------------------

const DEV_IP_HASH_SALT = 'findtofill-dev-only-salt';

/** Client IP from the proxy headers Vercel sets (first x-forwarded-for entry), or null. */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || null;
}

/**
 * HMAC-SHA256 of the IP with IP_HASH_SALT (server-only). A plain hash of an IPv4 address
 * can be reversed by trying all 4 billion values, so production requires the secret.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt && process.env.NODE_ENV === 'production') {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'The server is not configured yet.');
  }
  return createHmac('sha256', salt || DEV_IP_HASH_SALT).update(ip).digest('hex').slice(0, 32);
}

/**
 * Rate-limit key for POST /api/chat: the user id when logged in, otherwise "ip:<hash>".
 * Requests without any IP header share one "ip:unknown" bucket.
 */
export function chatRateLimitKey(headers: Headers, userId: string | null): string {
  if (userId) return userId;
  const ip = clientIpFrom(headers);
  return ip ? `ip:${hashIp(ip)}` : 'ip:unknown';
}
