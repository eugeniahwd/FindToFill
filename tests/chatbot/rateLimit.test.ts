import { InMemoryRateLimiter } from '@/lib/chatbot/rateLimit';

describe('InMemoryRateLimiter', () => {
  let now: number;
  let limiter: InMemoryRateLimiter;

  beforeEach(() => {
    now = 1_000_000;
    limiter = new InMemoryRateLimiter(() => now);
  });

  it('allows max requests in the window, then denies with the seconds until the oldest expires', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await limiter.check('client-a', 'chat', 3, 60)).toEqual({ allowed: true });
      now += 1000;
    }

    expect(await limiter.check('client-a', 'chat', 3, 60)).toEqual({
      allowed: false,
      retryAfterSec: 57,
    });
  });

  it('allows again once the oldest request leaves the window', async () => {
    for (let i = 0; i < 3; i++) await limiter.check('client-a', 'chat', 3, 60);

    now += 60_000;
    expect(await limiter.check('client-a', 'chat', 3, 60)).toEqual({ allowed: true });
  });

  it('counts each key separately', async () => {
    for (let i = 0; i < 3; i++) await limiter.check('client-a', 'chat', 3, 60);

    expect((await limiter.check('client-a', 'chat', 3, 60)).allowed).toBe(false);
    expect((await limiter.check('client-b', 'chat', 3, 60)).allowed).toBe(true);
  });
});
