import type { ChatRequest, ChatResponse, QuickMessageId } from '@/lib/chatbot/contract';

export interface ChatAskInput {
  quickMessageId: QuickMessageId;
  /** The browser's GPS position, or null when location is denied or unavailable. */
  coords: { latitude: number; longitude: number } | null;
  /** Only when the user picked the station by hand, or GPS is unavailable. */
  stationId?: string | null;
  sessionId?: string | null;
}

export interface ChatResult {
  /** HTTP status, or 0 when the request never got a response (offline, aborted). */
  status: number;
  response: ChatResponse;
}

const SESSION_KEY = 'findtofill.chatSessionId';
const NETWORK_ERROR_MESSAGE =
  'Asisten tidak dapat dihubungi. Periksa koneksi, atau lihat peta untuk fasilitas terdekat.';

// The server rejects (400) any sessionId that is not a UUID, so a corrupted stored value is replaced.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let memorySessionId: string | null = null;

/**
 * Builds the POST /api/chat body. lat/lng go together or not at all, and absent values are
 * omitted rather than sent as null (the server rejects null and unknown fields).
 */
export function buildChatRequest(input: ChatAskInput): ChatRequest {
  const { quickMessageId, coords, stationId, sessionId } = input;
  const hasCoords =
    coords !== null && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude);

  return {
    quickMessageId,
    ...(hasCoords ? { lat: coords.latitude, lng: coords.longitude } : {}),
    ...(stationId ? { stationId } : {}),
    ...(sessionId ? { sessionId } : {}),
  };
}

/** One anonymous id per browser session (sessionStorage), or null when crypto is unavailable. */
export function getChatSessionId(): string | null {
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    if (stored && UUID_PATTERN.test(stored)) return stored;
  } catch {
    // Storage blocked (private mode, sandboxed iframe): fall back to memory below.
  }
  if (memorySessionId) return memorySessionId;
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') return null;

  memorySessionId = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(SESSION_KEY, memorySessionId);
  } catch {
    // Keep the in-memory id.
  }
  return memorySessionId;
}

function networkFailure(): ChatResult {
  return {
    status: 0,
    response: {
      outcome: 'fallback_ai_unavailable',
      message: NETWORK_ERROR_MESSAGE,
      cards: [],
      scheduleReminder: false,
      needsStationSelection: false,
      detectedStation: null,
      generatedAt: new Date().toISOString(),
    },
  };
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.outcome === 'string' && typeof v.message === 'string' && Array.isArray(v.cards);
}

export const chatbotService = {
  /** Calls POST /api/chat. Never throws: a network or parse failure becomes an AI-unavailable reply. */
  async ask(input: ChatAskInput): Promise<ChatResult> {
    let res: Response;
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChatRequest(input)),
      });
    } catch {
      return networkFailure();
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return { ...networkFailure(), status: res.status };
    }
    if (!isChatResponse(body)) return { ...networkFailure(), status: res.status };

    const retryHeader = Number(res.headers.get('Retry-After'));
    const retryAfterSec =
      body.retryAfterSec ?? (res.status === 429 && retryHeader > 0 ? retryHeader : undefined);

    return {
      status: res.status,
      response: {
        ...body,
        cards: body.cards.slice(0, 3),
        ...(retryAfterSec !== undefined ? { retryAfterSec } : {}),
      },
    };
  },
};
