/**
 * src/lib/chatbot/rateLimit.ts
 *
 * Rate limiting seam (docs/AI_TRACK.md §3.3). InMemoryRateLimiter counts per server instance,
 * so it resets on a cold start; a shared store can replace it behind the same interface.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export interface RateLimiter {
  check(key: string, action: 'chat', max: number, windowSec: number): Promise<RateLimitResult>;
}

// Above this many keys, buckets with no hit inside the window are dropped to bound memory.
const SWEEP_THRESHOLD_KEYS = 5000;

export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly nowMs: () => number = Date.now) {}

  async check(
    key: string,
    action: 'chat',
    max: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    const now = this.nowMs();
    const windowMs = windowSec * 1000;
    if (this.hits.size > SWEEP_THRESHOLD_KEYS) this.sweep(now, windowMs);

    const bucket = `${action}:${key}`;
    const recent = (this.hits.get(bucket) ?? []).filter((at) => now - at < windowMs);
    if (recent.length >= max) {
      this.hits.set(bucket, recent);
      const oldest = recent[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      return { allowed: false, retryAfterSec };
    }

    recent.push(now);
    this.hits.set(bucket, recent);
    return { allowed: true };
  }

  private sweep(now: number, windowMs: number): void {
    for (const [bucket, times] of this.hits) {
      const newest = times[times.length - 1] ?? 0;
      if (now - newest >= windowMs) this.hits.delete(bucket);
    }
  }
}
