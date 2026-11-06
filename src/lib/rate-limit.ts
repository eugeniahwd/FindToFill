import 'server-only';
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
