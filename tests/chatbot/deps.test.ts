/**
 * @jest-environment node
 */

// The Backend's Supabase helpers are mocked: these tests never reach a database.
// Relative paths: next/jest rewrites the @/ alias only in import statements, not in jest.mock.
jest.mock('../../src/lib/supabase/admin', () => ({
  createSupabaseAdminClient: jest.fn(() => ({ admin: true })),
}));
jest.mock('../../src/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
}));
jest.mock('../../src/lib/data/chatLogs', () => ({
  logChat: jest.fn(async () => undefined),
}));
jest.mock('../../src/lib/rate-limit', () => ({
  ...jest.requireActual('../../src/lib/rate-limit'),
  consumeRateLimit: jest.fn(async () => undefined),
}));

import {
  buildChatDeps,
  DatabaseRateLimiter,
  resolveDataSource,
  resolveMode,
} from '../../src/app/api/chat/deps';
import { ApiError } from '../../src/lib/api/errors';
import { logChat } from '../../src/lib/data/chatLogs';
import { consumeRateLimit } from '../../src/lib/rate-limit';
import { createSupabaseServerClient } from '../../src/lib/supabase/server';
import { RATE_LIMIT_CHAT, RATE_LIMIT_WINDOW_SEC } from '../../src/lib/chatbot/config';
import { FakeLLMClient } from '../../src/lib/chatbot/llm/fakeLlmClient';
import { GroqLLMClient } from '../../src/lib/chatbot/llm/groqClient';
import type { ChatLogEntry } from '../../src/lib/chatbot/logger';
import { handleChat } from '../../src/lib/chatbot/orchestrator';
import { InMemoryRateLimiter } from '../../src/lib/chatbot/rateLimit';

const ADMIN = { admin: true };
const serverClient = jest.mocked(createSupabaseServerClient);

function headers(extra: Record<string, string> = {}): Headers {
  return new Headers({ 'x-forwarded-for': '203.0.113.7', ...extra });
}

function signedIn(result: { id: string } | Error): void {
  const getUser = async () =>
    result instanceof Error
      ? { data: { user: null }, error: result }
      : { data: { user: result }, error: null };
  serverClient.mockResolvedValue({ auth: { getUser } } as unknown as Awaited<
    ReturnType<typeof createSupabaseServerClient>
  >);
}

const ENTRY: ChatLogEntry = {
  sessionId: '3f6c2a8e-1b4d-4c9a-9e2f-7a5b8c1d0e4f',
  quickMessageId: 'nearest_water',
  toolsCalled: ['get_user_location'],
  outcome: 'answered',
  latencyMs: 12,
  stationId: 'station-manggarai',
};

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  errorSpy.mockRestore();
  delete process.env.GROQ_API_KEY;
  delete process.env.GROQ_MODEL;
});

describe('resolveMode and resolveDataSource', () => {
  it('default to stub and fake, ignore case and spaces, and reject unknown values', () => {
    expect(resolveMode(undefined)).toBe('stub');
    expect(resolveMode(' FAKE ')).toBe('fake');
    expect(resolveMode('live')).toBe('live');
    expect(resolveMode('demo')).toBeNull();
    expect(resolveDataSource(undefined)).toBe('fake');
    expect(resolveDataSource('Supabase')).toBe('supabase');
    expect(resolveDataSource('postgres')).toBeNull();
  });
});

describe('DatabaseRateLimiter', () => {
  it('passes the chat limit to the Backend sliding window and allows the request', async () => {
    const consume = jest.fn(async () => undefined);
    const result = await new DatabaseRateLimiter(consume).check(
      'ip:abc',
      'chat',
      RATE_LIMIT_CHAT,
      RATE_LIMIT_WINDOW_SEC,
    );

    expect(result).toEqual({ allowed: true });
    expect(consume).toHaveBeenCalledWith('ip:abc', {
      action: 'chat',
      limit: RATE_LIMIT_CHAT,
      windowMs: RATE_LIMIT_WINDOW_SEC * 1000,
    });
  });

  it('turns the Backend 429 into a rejection with the window as Retry-After', async () => {
    const consume = jest.fn(async () => {
      throw new ApiError(429, 'RATE_LIMITED', 'Limit reached');
    });
    const result = await new DatabaseRateLimiter(consume).check('k', 'chat', 20, 3600);

    expect(result).toEqual({ allowed: false, retryAfterSec: 3600 });
  });

  it('fails open on a database error and logs only the error name', async () => {
    const consume = jest.fn(async () => {
      throw new TypeError('connection to db.example.supabase.co failed');
    });
    const result = await new DatabaseRateLimiter(consume).check('k', 'chat', 20, 3600);

    expect(result).toEqual({ allowed: true });
    expect(errorSpy).toHaveBeenCalledWith('[chat] rate limit check failed: TypeError');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('supabase.co');
  });
});

describe('buildChatDeps with CHATBOT_DATA=fake (the default)', () => {
  it('uses the stub, the in-memory limiter, and an IP-hash identity by default', async () => {
    const deps = await buildChatDeps(headers(), {});

    expect(deps.answer).toBe('stub');
    expect(deps.provider).toBeNull();
    expect(deps.llm).toBeNull();
    expect(deps.rateLimiter).toBeInstanceOf(InMemoryRateLimiter);
    expect(deps.identity).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(deps.identity).not.toContain('203.0.113.7');
    expect(serverClient).not.toHaveBeenCalled();
  });

  it('builds FakeLLMClient and the demo provider in fake mode, without any network', async () => {
    const deps = await buildChatDeps(headers(), { CHATBOT_MODE: 'fake' });

    expect(deps.answer).toBe('agent');
    expect(deps.llm).toBeInstanceOf(FakeLLMClient);
    const stations = await deps.provider?.listStations();
    expect(stations?.map((station) => station.name)).toEqual(['Manggarai', 'Sudirman', 'Tebet']);
    expect(serverClient).not.toHaveBeenCalled();
  });

  it('builds GroqLLMClient in live mode when GROQ_API_KEY and GROQ_MODEL are set', async () => {
    process.env.GROQ_API_KEY = 'test-key-not-real';
    process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
    const deps = await buildChatDeps(headers(), { CHATBOT_MODE: 'live' });

    expect(deps.llm).toBeInstanceOf(GroqLLMClient);
    expect(deps.provider).not.toBeNull();
  });

  it('gives an unknown mode no provider and no model', async () => {
    const deps = await buildChatDeps(headers(), { CHATBOT_MODE: 'demo' });

    expect(deps).toMatchObject({ answer: 'agent', provider: null, llm: null });
  });
});

describe('buildChatDeps with CHATBOT_DATA=supabase', () => {
  const ENV = { CHATBOT_MODE: 'fake', CHATBOT_DATA: 'supabase' };

  it('limits through rate_limit_events and logs to chat_logs with the admin client', async () => {
    const deps = await buildChatDeps(headers(), ENV);

    expect(deps.rateLimiter).toBeInstanceOf(DatabaseRateLimiter);
    await deps.rateLimiter.check(deps.identity, 'chat', RATE_LIMIT_CHAT, RATE_LIMIT_WINDOW_SEC);
    expect(consumeRateLimit).toHaveBeenCalledWith(ADMIN, deps.identity, {
      action: 'chat',
      limit: RATE_LIMIT_CHAT,
      windowMs: RATE_LIMIT_WINDOW_SEC * 1000,
    });

    await deps.logger.log(ENTRY);
    expect(logChat).toHaveBeenCalledWith(ADMIN, ENTRY);
  });

  it('uses the signed-in user id as the identity when there is an auth cookie', async () => {
    signedIn({ id: 'user-123' });
    const deps = await buildChatDeps(headers({ cookie: 'sb-access-token=x' }), ENV);

    expect(deps.identity).toBe('user-123');
  });

  it('falls back to the IP hash for guests and on auth errors', async () => {
    const guest = await buildChatDeps(headers(), ENV);
    expect(guest.identity).toMatch(/^ip:/);
    expect(serverClient).not.toHaveBeenCalled();

    signedIn(new Error('JWT expired'));
    const expired = await buildChatDeps(headers({ cookie: 'sb-access-token=x' }), ENV);
    expect(expired.identity).toBe(guest.identity);
  });

  it('answers fallback_ai_unavailable until the Backend provider is wired in', async () => {
    const deps = await buildChatDeps(headers(), ENV);
    expect(deps.provider).toBeNull();

    const { status, response } = await handleChat(
      { quickMessageId: 'nearest_water', stationId: 'station-manggarai' },
      deps,
    );
    expect(status).toBe(200);
    expect(response.outcome).toBe('fallback_ai_unavailable');
    expect(logChat).toHaveBeenCalledWith(
      ADMIN,
      expect.objectContaining({ outcome: 'fallback_ai_unavailable' }),
    );
  });

  it('keeps the stub answers but still uses the database limiter in stub mode', async () => {
    const deps = await buildChatDeps(headers(), { CHATBOT_DATA: 'supabase' });

    expect(deps.answer).toBe('stub');
    expect(deps.rateLimiter).toBeInstanceOf(DatabaseRateLimiter);
  });
});
