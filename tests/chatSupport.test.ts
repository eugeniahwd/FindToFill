/**
 * @jest-environment node
 */
import { RATE_LIMITS, chatRateLimitKey, clientIpFrom, consumeRateLimit, hashIp } from '@/lib/rate-limit';
import { logChat, normalizeSessionId, type ChatLogEntry } from '@/lib/data/chatLogs';
import { fakeSupabase } from './helpers/fakeSupabase';

const ORIGINAL_ENV = process.env;
beforeEach(() => {
  process.env = { ...ORIGINAL_ENV, IP_HASH_SALT: 'test-salt' };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const headers = (h: Record<string, string>) => new Headers(h);

describe('guest IP keys', () => {
  it('takes the first x-forwarded-for address, then x-real-ip', () => {
    expect(clientIpFrom(headers({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }))).toBe('203.0.113.5');
    expect(clientIpFrom(headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIpFrom(headers({}))).toBeNull();
  });

  it('hashes the IP with the secret salt (stable, not reversible without it)', () => {
    const hash = hashIp('203.0.113.5');
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(hashIp('203.0.113.5')).toBe(hash);
    expect(hashIp('203.0.113.6')).not.toBe(hash);
    process.env.IP_HASH_SALT = 'other-salt';
    expect(hashIp('203.0.113.5')).not.toBe(hash);
  });

  it('refuses to hash without IP_HASH_SALT in production', () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production' };
    delete process.env.IP_HASH_SALT;
    expect(() => hashIp('203.0.113.5')).toThrow(expect.objectContaining({ status: 503 }));
  });

  it('uses the user id when logged in and never the raw IP for guests', () => {
    const h = headers({ 'x-forwarded-for': '203.0.113.5' });
    expect(chatRateLimitKey(h, 'user-1')).toBe('user-1');
    const guestKey = chatRateLimitKey(h, null);
    expect(guestKey).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(guestKey).not.toContain('203.0.113.5');
    expect(chatRateLimitKey(headers({}), null)).toBe('ip:unknown');
  });
});

describe('consumeRateLimit (chat: 20 per hour)', () => {
  it('counts the request after the check passes', async () => {
    const admin = fakeSupabase({ 'rate_limit_events.select': () => ({ count: 19 }), 'rate_limit_events.insert': () => ({}) });
    await consumeRateLimit(admin.client, 'ip:abc', RATE_LIMITS.chat);
    expect(admin.find('rate_limit_events.insert')[0].payload).toEqual({ key: 'ip:abc', action: 'chat' });
  });

  it('rejects the 21st request with 429 and records nothing', async () => {
    const admin = fakeSupabase({ 'rate_limit_events.select': () => ({ count: 20 }), 'rate_limit_events.insert': () => ({}) });
    await expect(consumeRateLimit(admin.client, 'ip:abc', RATE_LIMITS.chat)).rejects.toMatchObject({ status: 429 });
    expect(admin.find('rate_limit_events.insert')).toHaveLength(0);
  });
});

describe('chat_logs', () => {
  const entry: ChatLogEntry = {
    sessionId: 'sess_abcdef12',
    quickMessageId: 'nearest_water',
    toolsCalled: ['get_user_location', 'get_nearest_facility', 'DROP TABLE', 'get_facility_status'],
    outcome: 'answered',
    latencyMs: 1234.6,
    stationId: '33333333-3333-4333-8333-333333333333',
  };

  it('keeps a valid anonymous session id and replaces anything else', () => {
    expect(normalizeSessionId('sess_abcdef12')).toBe('sess_abcdef12');
    for (const bad of ['short', 'has spaces in it', 'nadia@example.com', 42, undefined]) {
      expect(normalizeSessionId(bad)).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('writes only the allowed columns, with clean tool names and a rounded latency', async () => {
    const admin = fakeSupabase({ 'chat_logs.insert': () => ({}) });
    await logChat(admin.client, entry);
    expect(admin.calls[0].payload).toEqual({
      session_id: 'sess_abcdef12',
      quick_message_id: 'nearest_water',
      tools_called: ['get_user_location', 'get_nearest_facility', 'get_facility_status'],
      outcome: 'answered',
      latency_ms: 1235,
      station_id: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('never throws, even when the insert fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = fakeSupabase({ 'chat_logs.insert': () => ({ error: { code: '42501', message: 'denied' } }) });
    await expect(logChat(failing.client, entry)).resolves.toBeUndefined();
    const throwing = fakeSupabase({ 'chat_logs.insert': () => { throw new Error('network'); } });
    await expect(logChat(throwing.client, { ...entry, quickMessageId: 'unknown', outcome: 'rejected' })).resolves.toBeUndefined();
  });
});
