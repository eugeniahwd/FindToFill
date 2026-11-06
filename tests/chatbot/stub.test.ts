import { MAX_CARDS, MAX_MESSAGE_CHARS } from '@/lib/chatbot/config';
import { QUICK_MESSAGE_IDS } from '@/lib/chatbot/contract';
import { FALLBACK_MESSAGES } from '@/lib/chatbot/prompts';
import { getStubChatResponse, STUB_STATION } from '@/lib/chatbot/stub';

const NOW = new Date('2026-11-01T08:00:00.000Z');
const STATION = { stationId: STUB_STATION.id };
const EMOJI = new RegExp('\\p{Extended_Pictographic}', 'u');

describe('stub responses', () => {
  it.each(QUICK_MESSAGE_IDS)('answers %s within the contract rules', (quickMessageId) => {
    const res = getStubChatResponse({ quickMessageId, ...STATION }, NOW);

    expect(res.outcome).toBe('answered');
    expect(res.detectedStation).toEqual({
      ...STUB_STATION,
      source: 'manual',
      needsConfirmation: false,
    });
    expect(res.needsStationSelection).toBe(false);
    expect(res.scheduleReminder).toBe(quickMessageId === 'time_to_refill');
    expect(res.generatedAt).toBe(NOW.toISOString());

    // Indonesian, at most 3 sentences and 400 characters, no URLs, markdown, or emoji.
    expect(res.message.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS);
    expect(res.message.match(/[.!?](\s|$)/g)?.length ?? 0).toBeLessThanOrEqual(3);
    expect(res.message).not.toMatch(/https?:\/\/|[*_#`]/);
    expect(res.message).not.toMatch(EMOJI);

    if (quickMessageId === 'review_summary') {
      expect(res.cards).toEqual([]);
    } else {
      expect(res.cards.length).toBeGreaterThan(0);
      expect(res.cards.length).toBeLessThanOrEqual(MAX_CARDS);
    }
    for (const card of res.cards) {
      // GPS stays in the browser, so distances are always from the station center.
      expect(card.distanceIsApproximate).toBe(true);
      const reportedAt =
        card.minutesAgo === null
          ? null
          : new Date(NOW.getTime() - card.minutesAgo * 60_000).toISOString();
      expect(card.lastReportedAt).toBe(reportedAt);
    }
  });

  it('matches the §10 example for nearest_water', () => {
    const res = getStubChatResponse({ quickMessageId: 'nearest_water', ...STATION }, NOW);
    expect(res.message).toBe(
      'Di Stasiun Manggarai, dispenser air terdekat yang tersedia ada di Water Station, ' +
        'Platform 3, perkiraan 45 m dari titik tengah stasiun. Laporan terakhir 5 menit lalu.',
    );
  });

  it('asks for a station when the request has no stationId (the fallback example)', () => {
    expect(getStubChatResponse({ quickMessageId: 'nearest_water' }, NOW)).toEqual({
      outcome: 'fallback_no_data',
      message: FALLBACK_MESSAGES.noLocation,
      cards: [],
      scheduleReminder: false,
      needsStationSelection: true,
      detectedStation: null,
      generatedAt: NOW.toISOString(),
    });
  });

  it('never invents data for a station outside the fixture', () => {
    const res = getStubChatResponse({ quickMessageId: 'nearest_water', stationId: 'tebet' }, NOW);
    expect(res.outcome).toBe('fallback_no_data');
    expect(res.message).toBe(FALLBACK_MESSAGES.noData);
    expect(res.cards).toEqual([]);
    expect(res.detectedStation).toBeNull();
  });
});
