/**
 * @jest-environment node
 */
import { z } from 'zod';
import { ApiError, fromDatabaseError, handleRouteError } from '@/lib/api/errors';
import { SupabaseConfigError } from '@/lib/supabase/env';

async function bodyOf(res: Response) {
  return (await res.json()) as { error: { code: string; message: string } };
}

describe('handleRouteError', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('returns the ApiError status and { error: { code, message } }', async () => {
    const res = handleRouteError(new ApiError(429, 'RATE_LIMITED', 'Too many reports.'));
    expect(res.status).toBe(429);
    expect(await bodyOf(res)).toEqual({ error: { code: 'RATE_LIMITED', message: 'Too many reports.' } });
  });

  it('turns zod errors into 400 VALIDATION_ERROR with the field path', async () => {
    const result = z.object({ note: z.string().max(140) }).safeParse({ note: 'x'.repeat(141) });
    if (result.success) throw new Error('expected failure');
    const res = handleRouteError(result.error);
    expect(res.status).toBe(400);
    const body = await bodyOf(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toMatch(/^note:/);
  });

  it('reports a missing configuration as 503', async () => {
    const res = handleRouteError(new SupabaseConfigError());
    expect(res.status).toBe(503);
  });

  it('never leaks internal error messages', async () => {
    const res = handleRouteError(new Error('password=hunter2 at /srv/app.js:12'));
    expect(res.status).toBe(500);
    const body = await bodyOf(res);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });
});

describe('fromDatabaseError', () => {
  it.each([
    ['23505', 409, 'CONFLICT'],
    ['23503', 400, 'VALIDATION_ERROR'],
    ['42501', 403, 'FORBIDDEN'],
    ['PGRST116', 404, 'NOT_FOUND'],
  ])('maps %s to %i %s', (code, status, apiCode) => {
    expect(fromDatabaseError({ code, message: 'db detail' })).toMatchObject({ status, code: apiCode });
  });

  it('treats network failures (paused project) as 503', () => {
    expect(fromDatabaseError({ message: 'TypeError: fetch failed' })).toMatchObject({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });
});
