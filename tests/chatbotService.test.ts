import { buildChatRequest, chatbotService, getChatSessionId } from '@/lib/services/chatbotService';
import type { ChatResponse } from '@/lib/chatbot/contract';

const manggarai = { latitude: -6.21017, longitude: 106.84994 };

function chatResponse(overrides: Partial<ChatResponse> = {}): ChatResponse {
  return {
    outcome: 'answered',
    message: 'Dispenser terdekat ada di Peron 6.',
    cards: [],
    scheduleReminder: false,
    needsStationSelection: false,
    detectedStation: null,
    generatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

function fakeResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => body,
  };
}

describe('buildChatRequest', () => {
  it('sends lat and lng together and leaves out absent fields', () => {
    expect(
      buildChatRequest({ quickMessageId: 'nearest_water', coords: manggarai, stationId: null, sessionId: null }),
    ).toEqual({ quickMessageId: 'nearest_water', lat: -6.21017, lng: 106.84994 });
  });

  it('sends only stationId and sessionId when there is no GPS', () => {
    const body = buildChatRequest({
      quickMessageId: 'review_summary',
      coords: null,
      stationId: 'station-manggarai',
      sessionId: 'abc',
    });
    expect(body).toEqual({ quickMessageId: 'review_summary', stationId: 'station-manggarai', sessionId: 'abc' });
    expect(JSON.stringify(body)).not.toContain('null');
  });

  it('drops a non-finite position instead of sending half of it', () => {
    const body = buildChatRequest({
      quickMessageId: 'nearest_water',
      coords: { latitude: Number.NaN, longitude: 106.8 },
    });
    expect(body).toEqual({ quickMessageId: 'nearest_water' });
  });
});

describe('getChatSessionId', () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(() => window.sessionStorage.clear());

  it('replaces a stored value that is not a UUID, then reuses the new id', () => {
    window.sessionStorage.setItem('findtofill.chatSessionId', 'not-a-uuid');
    const id = getChatSessionId();
    expect(id).toMatch(uuid);
    expect(getChatSessionId()).toBe(id);
  });
});

describe('chatbotService.ask', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('POSTs JSON to /api/chat and returns the server response', async () => {
    const response = chatResponse();
    fetchMock.mockResolvedValue(fakeResponse(200, response));

    const result = await chatbotService.ask({ quickMessageId: 'nearest_water', coords: manggarai });

    expect(fetchMock).toHaveBeenCalledWith('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quickMessageId: 'nearest_water', lat: -6.21017, lng: 106.84994 }),
    });
    expect(result).toEqual({ status: 200, response });
  });

  it('keeps at most 3 cards', async () => {
    const card = {
      facilityId: 'f',
      name: 'Dispenser',
      type: 'water' as const,
      platform: null,
      locationDetail: null,
      level: null,
      distanceM: 40,
      distanceIsApproximate: false,
      walkTimeMin: 1,
      status: 'available' as const,
      lastReportedAt: null,
      minutesAgo: null,
    };
    const cards = [1, 2, 3, 4].map((n) => ({ ...card, facilityId: `f${n}` }));
    fetchMock.mockResolvedValue(fakeResponse(200, chatResponse({ cards })));

    const result = await chatbotService.ask({ quickMessageId: 'nearest_water', coords: manggarai });
    expect(result.response.cards.map((c) => c.facilityId)).toEqual(['f1', 'f2', 'f3']);
  });

  it('passes a 429 through and reads Retry-After when the body has no retryAfterSec', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(429, chatResponse({ outcome: 'rejected', message: 'Terlalu banyak permintaan.' }), {
        'Retry-After': '120',
      }),
    );

    const result = await chatbotService.ask({ quickMessageId: 'nearest_water', coords: null });
    expect(result.status).toBe(429);
    expect(result.response.retryAfterSec).toBe(120);
  });

  it('turns a network error into an AI-unavailable reply instead of throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await chatbotService.ask({ quickMessageId: 'nearest_water', coords: null });
    expect(result.status).toBe(0);
    expect(result.response.outcome).toBe('fallback_ai_unavailable');
    expect(result.response.cards).toEqual([]);
  });

  it('treats a body that is not a ChatResponse as AI unavailable', async () => {
    fetchMock.mockResolvedValue(fakeResponse(502, { error: 'Bad gateway' }));

    const result = await chatbotService.ask({ quickMessageId: 'nearest_water', coords: null });
    expect(result.status).toBe(502);
    expect(result.response.outcome).toBe('fallback_ai_unavailable');
  });
});
