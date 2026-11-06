/**
 * @jest-environment node
 */
import { embedText, normalize, toPgVector } from '@/lib/gemini/embeddings';

const mockEmbedContent = jest.fn();
jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(() => ({ models: { embedContent: mockEmbedContent } })),
}));

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  mockEmbedContent.mockReset();
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: 'test-key', GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001' };
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const vector768 = () => Array.from({ length: 768 }, (_, i) => (i === 0 ? 3 : i === 1 ? 4 : 0));

describe('embedding helpers', () => {
  it('normalizes to a unit vector and rejects a zero vector', () => {
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
    expect(normalize([0, 0])).toBeNull();
  });

  it('formats a pgvector literal', () => {
    expect(toPgVector([0.25, -1])).toBe('[0.25,-1]');
  });
});

describe('embedText', () => {
  it('requests 768 dimensions with the document task type and returns a unit vector', async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: vector768() }] });
    const result = await embedText('Airnya segar', 'document');

    const [request] = mockEmbedContent.mock.calls[0];
    expect(request).toMatchObject({
      model: 'gemini-embedding-001',
      contents: 'Airnya segar',
      config: { outputDimensionality: 768, taskType: 'RETRIEVAL_DOCUMENT' },
    });
    expect(result?.slice(0, 2)).toEqual([0.6, 0.8]);
    expect(result).toHaveLength(768);
  });

  it('returns null without calling Gemini when the API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    expect(await embedText('Airnya segar', 'document')).toBeNull();
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it('returns null (never throws) when the API fails, and logs no text', async () => {
    mockEmbedContent.mockRejectedValue(new Error('quota Airnya segar'));
    expect(await embedText('Airnya segar', 'query')).toBeNull();
    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('Airnya');
  });

  it('returns null for a vector with the wrong dimension', async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [1, 2, 3] }] });
    expect(await embedText('Airnya segar', 'document')).toBeNull();
  });
});
