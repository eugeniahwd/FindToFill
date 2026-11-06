/**
 * @jest-environment node
 */
import Groq from 'groq-sdk';

jest.mock('groq-sdk', () => jest.fn().mockImplementation(() => ({ chat: {} })));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  jest.mocked(Groq).mockClear();
  process.env = { ...ORIGINAL_ENV };
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

async function load() {
  return import('@/lib/groq/client');
}

describe('Groq client', () => {
  it('returns null without GROQ_API_KEY (chatbot falls back)', async () => {
    delete process.env.GROQ_API_KEY;
    const { getGroqClient } = await load();
    expect(getGroqClient()).toBeNull();
  });

  it('creates one client without retries and with the 10 s chat timeout', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const { getGroqClient } = await load();
    const GroqMock = jest.mocked((await import('groq-sdk')).default);

    expect(getGroqClient()).toBe(getGroqClient());
    expect(GroqMock).toHaveBeenCalledTimes(1);
    expect(GroqMock).toHaveBeenCalledWith({ apiKey: 'test-key', maxRetries: 0, timeout: 10_000 });
  });

  it('reads the chat model id from GROQ_MODEL', async () => {
    process.env.GROQ_MODEL = 'openai/gpt-oss-20b';
    const { getChatModel } = await load();
    expect(getChatModel()).toBe('openai/gpt-oss-20b');
  });
});
