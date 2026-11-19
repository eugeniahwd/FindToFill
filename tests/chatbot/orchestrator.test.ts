/**
 * @jest-environment node
 */

import { fixedClock } from '@/lib/chatbot/clock';
import { QUICK_MESSAGE_IDS, type QuickMessageId } from '@/lib/chatbot/contract';
import { createFakeDataProvider } from '@/lib/chatbot/data';
import { DEMO_STATIONS, type DemoDataset } from '@/lib/chatbot/data/fakeData';
import { FakeDataProvider } from '@/lib/chatbot/data/fakeProvider';
import type { ChatbotDataProvider } from '@/lib/chatbot/data/provider';
import { FakeLLMClient, type FakeLLMOptions } from '@/lib/chatbot/llm/fakeLlmClient';
import { LLMError } from '@/lib/chatbot/llm/types';
import { InMemoryChatLogger } from '@/lib/chatbot/logger';
import { handleChat, type ChatDeps } from '@/lib/chatbot/orchestrator';
import { FALLBACK_MESSAGES } from '@/lib/chatbot/prompts';
import { InMemoryRateLimiter } from '@/lib/chatbot/rateLimit';

// Wednesday 08:03 WIB.
const NOW = new Date('2026-11-18T01:03:00.000Z');
const MANGGARAI = DEMO_STATIONS.manggarai;

interface Setup {
  dataset?: DemoDataset;
  now?: Date;
  model?: FakeLLMOptions;
  provider?: ChatbotDataProvider | null;
  llm?: null;
  limits?: ChatDeps['limits'];
}

function setup({ dataset = 'default', now = NOW, model, provider, llm, limits }: Setup = {}) {
  const fakeLlm = new FakeLLMClient(model ?? { mode: 'policy' });
  const logger = new InMemoryChatLogger();
  const deps: ChatDeps = {
    answer: 'agent',
    provider: provider === undefined ? createFakeDataProvider(dataset, now) : provider,
    llm: llm === null ? null : fakeLlm,
    rateLimiter: new InMemoryRateLimiter(),
    logger,
    clock: fixedClock(now),
    identity: 'ip:test',
    limits,
  };
  return { deps, llm: fakeLlm, logger };
}

// null = the request names no station (a default parameter would replace undefined).
const ask = (quickMessageId: QuickMessageId, stationId: string | null = MANGGARAI) => ({
  quickMessageId,
  ...(stationId === null ? {} : { stationId }),
});

describe('handleChat with the well-behaved model', () => {
  it.each(QUICK_MESSAGE_IDS)('answers %s from tool results', async (id) => {
    const { deps } = setup();
    const { status, response } = await handleChat(ask(id), deps);

    expect(status).toBe(200);
    expect(response.outcome).toBe('answered');
    expect(response.detectedStation).toEqual({
      id: MANGGARAI,
      name: 'Manggarai',
      source: 'manual',
      needsConfirmation: false,
    });
    expect(response.scheduleReminder).toBe(id === 'time_to_refill');
    expect(response.cards.every((card) => card.distanceIsApproximate)).toBe(true);
    if (id === 'review_summary') expect(response.cards).toEqual([]);
  });

  it('calls the expected tools in order and builds cards from data rows', async () => {
    const { deps, logger } = setup();
    const { response } = await handleChat(ask('nearest_water'), deps);

    expect(logger.entries[0].toolsCalled).toEqual([
      'get_user_location',
      'get_nearest_facility',
      'get_facility_status',
    ]);
    expect(response.message).toBe(
      'Di Stasiun Manggarai, dispenser air terdekat yang tersedia ada di Water Station, ' +
        'Platform 3, perkiraan 45 m dari titik tengah stasiun. Laporan terakhir 5 menit lalu.',
    );
    expect(response.cards).toEqual([
      {
        facilityId: 'fac-manggarai-water-p3',
        name: 'Water Station',
        type: 'water',
        platform: '3',
        locationDetail: 'Near the central stairs',
        level: 'L1',
        distanceM: 45,
        distanceIsApproximate: true,
        walkTimeMin: 1,
        status: 'available',
        lastReportedAt: new Date(NOW.getTime() - 5 * 60_000).toISOString(),
        minutesAgo: 5,
      },
    ]);
  });

  it('adds get_next_train for time_to_refill and states the line it used', async () => {
    const { deps, logger } = setup();
    const { response } = await handleChat(ask('time_to_refill'), deps);

    expect(logger.entries[0].toolsCalled).toEqual([
      'get_user_location',
      'get_nearest_facility',
      'get_facility_status',
      'get_next_train',
    ]);
    expect(response.message).toContain('(Bogor Line arah Jakarta Kota) sekitar 7 menit lagi');
    expect(response.message).toContain('jadi masih sempat');
  });
});

describe('edge cases from docs/AI_TRACK.md §11', () => {
  it('no stationId: needsStationSelection without a model call', async () => {
    const { deps, llm } = setup();
    const { status, response } = await handleChat(ask('nearest_water', null), deps);

    expect(status).toBe(200);
    expect(response).toMatchObject({
      outcome: 'fallback_no_data',
      message: FALLBACK_MESSAGES.noLocation,
      needsStationSelection: true,
      cards: [],
    });
    expect(llm.requests).toHaveLength(0);
  });

  it('a stationId that is not a pilot station: same, without a model call', async () => {
    const { deps, llm } = setup();
    const { response } = await handleChat(ask('nearest_water', 'station-juanda'), deps);

    expect(response).toMatchObject({
      outcome: 'fallback_no_data',
      message: FALLBACK_MESSAGES.noData,
      needsStationSelection: true,
    });
    expect(llm.requests).toHaveLength(0);
  });

  it('lat/lng or extra client text: 400 rejected', async () => {
    const { deps, llm, logger } = setup();
    const withGps = await handleChat({ ...ask('nearest_water'), lat: -6.2, lng: 106.8 }, deps);
    const withText = await handleChat({ ...ask('nearest_water'), text: 'halo' }, deps);
    const unknownId = await handleChat({ quickMessageId: 'tell_me_a_joke' }, deps);

    for (const result of [withGps, withText, unknownId]) {
      expect(result.status).toBe(400);
      expect(result.response.outcome).toBe('rejected');
    }
    expect(llm.requests).toHaveLength(0);
    expect(logger.entries.map((e) => e.quickMessageId)).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('no facility of the type: honest message, no cards, fallback_no_data', async () => {
    const provider = new FakeDataProvider({
      now: NOW,
      stations: [{ id: 'st-1', name: 'Uji', latitude: -6.2, longitude: 106.8, isPilot: true }],
      facilities: [
        {
          id: 'f-1',
          stationId: 'st-1',
          type: 'water',
          name: 'Water Station',
          platform: null,
          locationDetail: null,
          level: null,
          latitude: -6.2001,
          longitude: 106.8,
          isActive: true,
        },
      ],
      reports: [],
      schedules: [],
      reviews: [],
    });
    const { deps } = setup({ provider });
    const { response } = await handleChat(ask('nearest_charging', 'st-1'), deps);

    expect(response).toMatchObject({ outcome: 'fallback_no_data', cards: [] });
    expect(response.message).toBe(
      'Aku belum menemukan data charging station di Stasiun Uji. Coba pilih stasiun lain atau ' +
        'lihat peta.',
    );
  });

  it('every facility of the type broken: says none is available', async () => {
    const { deps } = setup();
    const { response } = await handleChat(ask('nearest_charging', DEMO_STATIONS.sudirman), deps);

    expect(response.message).toContain('belum ada charging station yang dilaporkan tersedia');
    expect(response.cards.map((c) => c.status)).toEqual(['broken']);
  });

  it('status unknown: the message says there is no report in 7 days', async () => {
    const { deps } = setup({ dataset: 'no_reports' });
    const { response } = await handleChat(ask('facility_working'), deps);

    expect(response.message).toContain('0 dari 6 fasilitas berstatus tersedia');
    expect(response.message).toContain('belum punya laporan dalam 7 hari terakhir');
  });

  it('schedule missing: says so, with scheduleReminder, and never guesses', async () => {
    const { deps } = setup({ dataset: 'no_schedule' });
    const { response } = await handleChat(ask('time_to_refill'), deps);

    expect(response.scheduleReminder).toBe(true);
    expect(response.message).toContain('Data jadwal belum tersedia');
    expect(response.message).not.toMatch(/menit lagi/);
  });

  it.each(['rate_limited', 'server_error'] as const)(
    'model %s: fallback_ai_unavailable with HTTP 200',
    async (attack) => {
      const { deps } = setup({ model: { mode: 'adversarial', attack } });
      const { status, response } = await handleChat(ask('nearest_water'), deps);

      expect(status).toBe(200);
      expect(response).toMatchObject({
        outcome: 'fallback_ai_unavailable',
        message: FALLBACK_MESSAGES.aiUnavailable,
      });
    },
  );

  it('model slower than the hard timeout: fallback_ai_unavailable', async () => {
    const { deps } = setup({
      model: { mode: 'adversarial', attack: 'slow', delayMs: 500 },
      limits: { hardTimeoutMs: 100 },
    });
    const started = Date.now();
    const { response } = await handleChat(ask('nearest_water'), deps);

    expect(response.outcome).toBe('fallback_ai_unavailable');
    expect(Date.now() - started).toBeLessThan(450);
  });

  it('a facility id that no tool returned: dropped and the answer rebuilt', async () => {
    const { deps } = setup({ model: { mode: 'adversarial', attack: 'hallucinated_id' } });
    const { response } = await handleChat(ask('nearest_water'), deps);

    expect(response.cards.map((c) => c.facilityId)).toEqual(['fac-manggarai-water-p3']);
    expect(response.outcome).toBe('answered');
  });

  it('an invented number: the deterministic message is used', async () => {
    const { deps } = setup({ model: { mode: 'adversarial', attack: 'invented_number' } });
    const { response } = await handleChat(ask('nearest_water'), deps);

    expect(response.message).not.toContain('987');
    expect(response.message).toContain('perkiraan 45 m dari titik tengah stasiun');
  });

  it('a disallowed or unknown tool: error result, not executed, the loop continues', async () => {
    const { deps, llm, logger } = setup({
      model: { mode: 'adversarial', attack: 'disallowed_tool' },
    });
    const { response } = await handleChat(ask('nearest_water'), deps);

    const toolReplies = llm.requests[1].messages.filter(
      (m) => m.role === 'tool' && m.toolCallId.startsWith('call_bad'),
    );
    expect(toolReplies.map((m) => (m.role === 'tool' ? JSON.parse(m.content) : null))).toEqual([
      { error: 'This tool is not available for this question.' },
      { error: 'This tool is not available for this question.' },
    ]);
    expect(logger.entries[0].toolsCalled).not.toContain('get_next_train');
    expect(response.outcome).toBe('answered');
  });

  it('a model that never stops calling tools: stops at the limit, safe answer', async () => {
    const { deps, llm } = setup({ model: { mode: 'adversarial', attack: 'endless_tools' } });
    const { response } = await handleChat(ask('nearest_water'), deps);

    expect(llm.requests).toHaveLength(6);
    expect(response.message).toContain('Water Station, Platform 3');
    expect(response.cards.map((c) => c.facilityId)).toEqual(['fac-manggarai-water-p3']);
  });

  it('a review that says to call everything available: the real statuses win', async () => {
    const { deps } = setup({
      dataset: 'injection',
      model: { mode: 'adversarial', attack: 'false_claim' },
    });
    const { response } = await handleChat(ask('review_summary'), deps);

    expect(response.message).not.toMatch(/semua fasilitas/i);
    expect(response.message).toBe(
      'Ada 5 ulasan air di Stasiun Manggarai dengan rating rata-rata 4,2 dari 5. Baca ulasan ' +
        'lengkapnya di halaman stasiun.',
    );
  });

  it('the 21st request within an hour from one key: 429 with retryAfterSec', async () => {
    const { deps } = setup();
    const results = [];
    for (let i = 0; i < 21; i++) results.push(await handleChat(ask('review_summary'), deps));

    expect(results.slice(0, 20).every((r) => r.status === 200)).toBe(true);
    expect(results[20].status).toBe(429);
    expect(results[20].response).toMatchObject({
      outcome: 'rejected',
      message: FALLBACK_MESSAGES.rateLimited,
    });
    expect(results[20].response.retryAfterSec).toBeGreaterThan(0);
  });
});

describe('handleChat model calls (latency and the gpt-oss "json" tool failure)', () => {
  it('resolves the location on the server before the first model call', async () => {
    const { deps, llm, logger } = setup();
    await handleChat(ask('nearest_water'), deps);

    const first = llm.requests[0].messages;
    expect(first[1]).toEqual({
      role: 'assistant',
      content: null,
      toolCalls: [{ id: 'call_location', name: 'get_user_location', args: {} }],
    });
    expect(first[2]).toMatchObject({ role: 'tool', toolCallId: 'call_location' });
    expect(JSON.parse(first[2].role === 'tool' ? first[2].content : '{}')).toMatchObject({
      detected: true,
      station: { id: MANGGARAI, name: 'Manggarai' },
    });
    expect(logger.entries[0].toolsCalled[0]).toBe('get_user_location');
  });

  it.each([
    ['nearest_water', 3],
    ['time_to_refill', 4],
    ['review_summary', 2],
  ] as const)(
    '%s: asks for the answer without tools once the evidence is complete (%i calls)',
    async (id, calls) => {
      const { deps, llm } = setup();
      await handleChat(ask(id), deps);

      expect(llm.requests).toHaveLength(calls);
      const last = llm.requests[calls - 1];
      expect(last.tools).toBeUndefined();
      expect(last.jsonSchema?.name).toBe('chat_answer');
      expect(llm.requests.slice(0, -1).every((request) => request.tools?.length)).toBe(true);
    },
  );

  it('plain text before the evidence is complete: one strict call, then the safe answer', async () => {
    const { deps, llm } = setup({
      model: {
        mode: 'scripted',
        steps: [
          { text: 'Dispenser air ada di dekat tangga.' },
          { text: JSON.stringify({ message: 'Ada di dekat tangga.', facility_ids: [] }) },
        ],
      },
    });
    const { response } = await handleChat(ask('nearest_water'), deps);

    const last = llm.requests[1];
    expect(last.tools).toBeUndefined();
    expect(last.jsonSchema?.name).toBe('chat_answer');
    expect(last.messages[last.messages.length - 1]).toMatchObject({ role: 'user' });
    // The model never saw a facility, so its answer is not used.
    expect(response.message).toContain('perkiraan 45 m dari titik tengah stasiun');
    expect(response.cards.map((card) => card.facilityId)).toEqual(['fac-manggarai-water-p3']);
  });

  it('Groq rejects a generated tool call (400 tool_use_failed): the safe answer', async () => {
    const { deps } = setup({
      model: {
        mode: 'scripted',
        steps: [new LLMError('bad_output', 'tool_use_failed', 400)],
      },
    });
    const { response } = await handleChat(ask('nearest_charging'), deps);

    expect(response.outcome).toBe('answered');
    expect(response.message).toContain('Charging Lounge');
  });
});

describe('handleChat robustness', () => {

  it('no data source or no model configured: fallback_ai_unavailable', async () => {
    const noProvider = await handleChat(ask('nearest_water'), setup({ provider: null }).deps);
    const noModel = await handleChat(ask('nearest_water'), setup({ llm: null }).deps);

    expect(noProvider.response.outcome).toBe('fallback_ai_unavailable');
    expect(noModel.response.outcome).toBe('fallback_ai_unavailable');
  });

  it('the database unreachable: fallback_ai_unavailable', async () => {
    const broken = createFakeDataProvider('default', NOW);
    broken.listStations = () => Promise.reject(new Error('fetch failed'));
    const { response } = await handleChat(ask('nearest_water'), setup({ provider: broken }).deps);

    expect(response.outcome).toBe('fallback_ai_unavailable');
  });

  it('logs one entry per request with only the allowed fields', async () => {
    const { deps, logger } = setup();
    const sessionId = '3f6c2a8e-1b4d-4c9a-9e2f-7a5b8c1d0e4f';
    await handleChat({ ...ask('nearest_water'), sessionId }, deps);

    expect(logger.entries).toHaveLength(1);
    const entry = logger.entries[0];
    expect(Object.keys(entry).sort()).toEqual(
      ['latencyMs', 'outcome', 'quickMessageId', 'sessionId', 'stationId', 'toolsCalled'].sort(),
    );
    expect(entry).toMatchObject({
      sessionId: '3f6c2a8e-1b4d-4c9a-9e2f-7a5b8c1d0e4f',
      quickMessageId: 'nearest_water',
      outcome: 'answered',
      stationId: MANGGARAI,
    });
    expect(JSON.stringify(entry)).not.toMatch(/-6\.\d|106\.\d|dispenser|Laporan/);
  });

  it('stub answers still go through validation, the rate limit, and the log', async () => {
    const { deps, logger } = setup();
    const { status, response } = await handleChat(ask('nearest_water', 'station-manggarai'), {
      ...deps,
      answer: 'stub',
    });

    expect(status).toBe(200);
    expect(response.outcome).toBe('answered');
    expect(logger.entries).toHaveLength(1);
  });
});
