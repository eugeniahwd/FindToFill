/**
 * @jest-environment node
 */
import { RATE_LIMITS, assertWithinRateLimit, recordRateLimitEvent } from '@/lib/rate-limit';
import { fakeSupabase } from './helpers/fakeSupabase';

const now = new Date('2026-11-02T10:00:00Z');

describe('rate limit (rate_limit_events)', () => {
  it('counts only this key and action within the last hour', async () => {
    const admin = fakeSupabase({ 'rate_limit_events.select': () => ({ count: 0 }) });
    await assertWithinRateLimit(admin.client, 'user-1', RATE_LIMITS.report, now);

    const [query] = admin.calls;
    expect(query.options).toMatchObject({ count: 'exact', head: true });
    expect(query.filters).toEqual([
      ['eq', 'key', 'user-1'],
      ['eq', 'action', 'report'],
      ['gte', 'created_at', '2026-11-02T09:00:00.000Z'],
    ]);
  });

  it('allows the 5th report and blocks the 6th (5 per hour)', async () => {
    expect(RATE_LIMITS.report.limit).toBe(5);
    const four = fakeSupabase({ 'rate_limit_events.select': () => ({ count: 4 }) });
    await expect(assertWithinRateLimit(four.client, 'u', RATE_LIMITS.report, now)).resolves.toBeUndefined();

    const five = fakeSupabase({ 'rate_limit_events.select': () => ({ count: 5 }) });
    await expect(assertWithinRateLimit(five.client, 'u', RATE_LIMITS.report, now)).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
  });

  it('uses 20 per hour for chat', () => {
    expect(RATE_LIMITS.chat).toMatchObject({ action: 'chat', limit: 20, windowMs: 3_600_000 });
  });

  it('records an event with key and action', async () => {
    const admin = fakeSupabase({ 'rate_limit_events.insert': () => ({}) });
    await recordRateLimitEvent(admin.client, 'user-1', RATE_LIMITS.report);
    expect(admin.calls[0].payload).toEqual({ key: 'user-1', action: 'report' });
  });
});
