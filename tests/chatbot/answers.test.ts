import type { QuickMessageId } from '@/lib/chatbot/contract';
import { createFakeDataProvider } from '@/lib/chatbot/data';
import { DEMO_STATIONS, type DemoDataset } from '@/lib/chatbot/data/fakeData';
import { FakeDataProvider } from '@/lib/chatbot/data/fakeProvider';
import type { ChatbotDataProvider } from '@/lib/chatbot/data/provider';
import { composeAnswer } from '@/lib/chatbot/deterministic';
import { getTool } from '@/lib/chatbot/tools/registry';
import { createEvidence, type Evidence, type ToolContext } from '@/lib/chatbot/tools/types';
import { checkAnswer, parseFinalAnswer } from '@/lib/chatbot/validation';

const WED_0803 = new Date('2026-11-18T01:03:00.000Z');
const WED_0808 = new Date('2026-11-18T01:08:00.000Z');

const TYPE: Record<QuickMessageId, 'water' | 'charging' | 'any' | null> = {
  nearest_water: 'water',
  nearest_charging: 'charging',
  facility_working: 'any',
  time_to_refill: 'water',
  review_summary: null,
};

/** Runs the tools a well-behaved model would call, and returns the evidence. */
async function collect(
  quickMessageId: QuickMessageId,
  stationId: string = DEMO_STATIONS.manggarai,
  options: { dataset?: DemoDataset; now?: Date; provider?: ChatbotDataProvider } = {},
): Promise<{ evidence: Evidence; stationName: string }> {
  const now = options.now ?? WED_0803;
  const provider = options.provider ?? createFakeDataProvider(options.dataset ?? 'default', now);
  const station = (await provider.listStations()).find((s) => s.id === stationId);
  if (!station) throw new Error('station not found');
  const ctx: ToolContext = { provider, station, now, evidence: createEvidence() };
  const run = (name: string, args: unknown) => getTool(name)?.run(args, ctx);

  await run('get_user_location', {});
  const type = TYPE[quickMessageId];
  if (type) {
    await run('get_nearest_facility', { station_id: stationId, type, limit: 6 });
    const ids = (ctx.evidence.outputs.nearest?.facilities ?? []).map((f) => f.facility_id);
    if (ids.length > 0) await run('get_facility_status', { facility_ids: ids });
  }
  if (quickMessageId === 'time_to_refill') {
    const water = ctx.evidence.outputs.nearest?.facilities ?? [];
    const available = water.find(
      (f) => ctx.evidence.statuses.get(f.facility_id)?.status === 'available',
    );
    if (available) {
      await run('get_next_train', {
        station_id: stationId,
        walk_time_min: available.walk_time_min,
      });
    }
  }
  if (quickMessageId === 'review_summary') await run('search_reviews', { station_id: stationId });
  return { evidence: ctx.evidence, stationName: station.name };
}

async function deterministic(...args: Parameters<typeof collect>) {
  const { evidence, stationName } = await collect(...args);
  const answer = composeAnswer(args[0], evidence.outputs, stationName);
  return { answer, evidence };
}

describe('deterministic answers', () => {
  it('matches the §10 nearest_water example at Manggarai', async () => {
    const { answer } = await deterministic('nearest_water');

    expect(answer).toEqual({
      outcome: 'answered',
      message:
        'Di Stasiun Manggarai, dispenser air terdekat yang tersedia ada di Water Station, ' +
        'Platform 3, perkiraan 45 m dari titik tengah stasiun. Laporan terakhir 5 menit lalu.',
      facilityIds: ['fac-manggarai-water-p3'],
    });
  });

  it('names the nearest facility honestly when it is not available (Tebet water)', async () => {
    const { answer } = await deterministic('nearest_water', DEMO_STATIONS.tebet);

    expect(answer.message).toBe(
      'Di Stasiun Tebet, dispenser air yang terdekat, Water Dispenser (Gate A), ' +
        'berstatus kosong, laporan terakhir 40 menit lalu. Yang tersedia ada di ' +
        'Water Station, Platform 2, perkiraan 140 m dari titik tengah stasiun, ' +
        'laporan terakhir 180 menit lalu.',
    );
    expect(answer.facilityIds).toEqual(['fac-tebet-water-p2', 'fac-tebet-water-gate-a']);
  });

  it('says none is available and never calls a broken one working (Sudirman)', async () => {
    const { answer } = await deterministic('nearest_charging', DEMO_STATIONS.sudirman);

    expect(answer.message).toBe(
      'Di Stasiun Sudirman, belum ada charging station yang dilaporkan tersedia. Charging Tower ' +
        '(Main hall) yang terdekat berstatus rusak, laporan terakhir 50 menit lalu.',
    );
  });

  it('summarizes facility_working with the precomputed counts', async () => {
    const { answer } = await deterministic('facility_working');

    expect(answer.message).toBe(
      'Di Stasiun Manggarai, 2 dari 6 fasilitas berstatus tersedia. Yang paling dekat ada di ' +
        'bawah. Ada 1 fasilitas yang belum punya laporan dalam 7 hari terakhir.',
    );
    expect(answer.facilityIds).toHaveLength(3);
  });

  it('states that a status is unknown when there is no report in 7 days', async () => {
    const { answer } = await deterministic('nearest_water', DEMO_STATIONS.manggarai, {
      dataset: 'no_reports',
    });

    expect(answer.message).toContain('belum ada dispenser air yang dilaporkan tersedia');
    expect(answer.message).toContain('belum punya laporan dalam 7 hari terakhir');
  });

  it('answers time_to_refill with the line and direction it used', async () => {
    const { answer } = await deterministic('time_to_refill');

    expect(answer.message).toBe(
      'Di Stasiun Manggarai, dispenser air terdekat yang tersedia ada di Water Station, ' +
        'Platform 3, perkiraan 1 menit jalan dari titik tengah stasiun, laporan terakhir ' +
        '5 menit lalu. ' +
        'Kereta tercepat berikutnya (Bogor Line arah Jakarta Kota) sekitar 7 menit lagi dan kamu ' +
        'butuh sekitar 3 menit pulang-pergi, jadi masih sempat. Cek papan informasi stasiun ' +
        'untuk jadwal terbaru.',
    );
  });

  it('keeps one pair of brackets for a facility described by its location', async () => {
    const { answer } = await deterministic('time_to_refill', DEMO_STATIONS.sudirman);

    expect(answer.message).toContain(
      'ada di Water Station (Kendal Tunnel exit), perkiraan 1 menit jalan dari titik tengah ' +
        'stasiun, laporan terakhir 30 menit lalu.',
    );
    expect(answer.message).not.toContain(') (');
  });

  it('says the time is short when it is', async () => {
    const { answer } = await deterministic('time_to_refill', DEMO_STATIONS.manggarai, {
      now: WED_0808,
    });

    expect(answer.message).toContain('sekitar 2 menit lagi');
    expect(answer.message).toContain('jadi waktunya tidak cukup');
  });

  it('says the schedule is not available instead of guessing', async () => {
    const { answer } = await deterministic('time_to_refill', DEMO_STATIONS.manggarai, {
      dataset: 'no_schedule',
    });

    expect(answer.message).toContain(
      'Data jadwal belum tersedia, jadi aku tidak bisa menghitung waktunya.',
    );
  });

  it('summarizes reviews from the counts, and handles zero reviews', async () => {
    const manggarai = await deterministic('review_summary');
    const tebet = await deterministic('review_summary', DEMO_STATIONS.tebet);

    expect(manggarai.answer.message).toBe(
      'Ada 4 ulasan air di Stasiun Manggarai dengan rating rata-rata 4 dari 5. Baca ulasan ' +
        'lengkapnya di halaman stasiun.',
    );
    expect(manggarai.answer.facilityIds).toEqual([]);
    expect(tebet.answer.message).toBe('Belum ada ulasan air untuk Stasiun Tebet.');
  });

  it('returns fallback_no_data when the station has no facility of the type', async () => {
    const provider = new FakeDataProvider({
      now: WED_0803,
      stations: [{ id: 'st-1', name: 'Uji', latitude: -6.2, longitude: 106.8, isPilot: true }],
      facilities: [],
      reports: [],
      schedules: [],
      reviews: [],
    });
    const { answer } = await deterministic('nearest_charging', 'st-1', { provider });

    expect(answer).toEqual({
      outcome: 'fallback_no_data',
      message:
        'Aku belum menemukan data charging station di Stasiun Uji. Coba pilih stasiun lain atau ' +
        'lihat peta.',
      facilityIds: [],
    });
  });

  // Our own validator must accept every deterministic answer: no invented numbers or claims.
  it.each([
    ['nearest_water', DEMO_STATIONS.manggarai, 'default'],
    ['nearest_water', DEMO_STATIONS.tebet, 'default'],
    ['nearest_charging', DEMO_STATIONS.sudirman, 'default'],
    ['facility_working', DEMO_STATIONS.manggarai, 'default'],
    ['facility_working', DEMO_STATIONS.manggarai, 'no_reports'],
    ['time_to_refill', DEMO_STATIONS.manggarai, 'default'],
    ['time_to_refill', DEMO_STATIONS.manggarai, 'no_schedule'],
    ['review_summary', DEMO_STATIONS.manggarai, 'injection'],
    ['review_summary', DEMO_STATIONS.tebet, 'default'],
  ] as const)('passes the answer check: %s at %s (%s)', async (id, station, dataset) => {
    const { answer, evidence } = await deterministic(id, station, { dataset });
    const check = checkAnswer(answer, id, evidence);

    expect(check.problems).toEqual([]);
  });
});

describe('parseFinalAnswer', () => {
  it('reads plain JSON, fenced JSON, and JSON with extra text', () => {
    const expected = { message: 'Halo', facilityIds: ['a'] };

    expect(parseFinalAnswer('{"message":"Halo","facility_ids":["a"]}')).toEqual(expected);
    expect(parseFinalAnswer('```json\n{"message":"Halo","facility_ids":["a"]}\n```')).toEqual(
      expected,
    );
    expect(parseFinalAnswer('Ini: {"message":" Halo ","facility_ids":["a"]}')).toEqual(expected);
  });

  it('defaults facility_ids to empty, and rejects anything else', () => {
    expect(parseFinalAnswer('{"message":"Halo"}')).toEqual({ message: 'Halo', facilityIds: [] });
    expect(parseFinalAnswer('Halo')).toBeNull();
    expect(parseFinalAnswer('{"message": 5}')).toBeNull();
    expect(parseFinalAnswer('{"message": "a", ')).toBeNull();
    expect(parseFinalAnswer(undefined)).toBeNull();
  });
});

describe('checkAnswer', () => {
  const GOOD =
    'Di Stasiun Manggarai, dispenser air terdekat yang tersedia ada di Water Station, ' +
    'Platform 3, perkiraan 45 m dari titik tengah stasiun. Laporan terakhir 5 menit lalu.';
  const water = () => collect('nearest_water');

  it('accepts a grounded, honest answer and caps the cards at 3', async () => {
    const { evidence } = await water();
    const ids = [...evidence.facilities.keys()];

    expect(checkAnswer({ message: GOOD, facilityIds: ids }, 'nearest_water', evidence)).toEqual({
      ok: true,
      problems: [],
      facilityIds: ids.slice(0, 3),
    });
  });

  it('rejects a facility id that no tool returned, and drops it from the cards', async () => {
    const { evidence } = await water();
    const check = checkAnswer(
      { message: GOOD, facilityIds: ['fac-manggarai-water-p3', 'fac-invented'] },
      'nearest_water',
      evidence,
    );

    expect(check.problems).toEqual(['unknown_facility_id']);
    expect(check.facilityIds).toEqual(['fac-manggarai-water-p3']);
  });

  it('rejects a number in no tool result, even one only seen in a timestamp', async () => {
    const { evidence } = await water();
    const reportedAt = evidence.statuses.get('fac-manggarai-water-p3')?.last_reported_at ?? '';
    const timestampMinute = reportedAt.slice(14, 16);
    const invented = { message: GOOD.replace('45 m', '99 m'), facilityIds: [] };

    expect(checkAnswer(invented, 'nearest_water', evidence).problems).toEqual([
      'ungrounded_number',
    ]);
    expect(
      checkAnswer(
        { message: `Laporan terakhir ${timestampMinute} menit lalu.`, facilityIds: [] },
        'nearest_water',
        evidence,
      ).problems,
    ).toEqual(['ungrounded_number']);
  });

  it('reads Indonesian number words and decimal commas', async () => {
    const { evidence } = await collect('facility_working');
    const reviews = await collect('review_summary', DEMO_STATIONS.manggarai, {
      dataset: 'injection',
    });
    const check = (message: string, id: QuickMessageId, ev: Evidence) =>
      checkAnswer({ message, facilityIds: [] }, id, ev).problems;
    const working = (message: string) => check(message, 'facility_working', evidence);

    expect(working('Ada dua dari enam fasilitas berstatus tersedia.')).toEqual([]);
    expect(working('Ada sembilan fasilitas.')).toEqual(['ungrounded_number']);
    expect(working('Salah satu fasilitas belum dilaporkan.')).toEqual([]);
    expect(check('Rating rata-rata 4,2 dari 5.', 'review_summary', reviews.evidence)).toEqual([]);
    expect(check('Rating rata-rata 4,7 dari 5.', 'review_summary', reviews.evidence)).toEqual([
      'ungrounded_number',
    ]);
  });

  it('rejects calling a broken, empty, or unreported facility working', async () => {
    const { evidence } = await water();
    const problems = (message: string) =>
      checkAnswer({ message, facilityIds: [] }, 'nearest_water', evidence).problems;

    expect(problems('Water Station, Platform 1 tersedia dan dekat.')).toEqual(['status_claim']);
    expect(problems('Hot and Cold Water di Platform 1-2 bisa dipakai.')).toEqual(['status_claim']);
    expect(problems('Water Station, Platform 1 tidak tersedia karena rusak.')).toEqual([]);
    expect(problems('Water Station, Platform 3 tersedia, sedangkan Platform 1 rusak.')).toEqual([]);
  });

  it('rejects "semua tersedia" when not all are, and any claim when none is', async () => {
    const working = await collect('facility_working');
    const none = await collect('nearest_charging', DEMO_STATIONS.sudirman);
    const all = { message: 'Semua fasilitas tersedia.', facilityIds: [] };

    expect(checkAnswer(all, 'facility_working', working.evidence).problems).toEqual([
      'status_claim',
    ]);
    expect(
      checkAnswer(
        { message: 'Charging station terdekat tersedia di aula utama.', facilityIds: [] },
        'nearest_charging',
        none.evidence,
      ).problems,
    ).toEqual(['status_claim']);
  });

  it('rejects URLs, markdown, emoji, long messages, and more than 3 sentences', async () => {
    const { evidence } = await water();
    const problems = (message: string) =>
      checkAnswer({ message, facilityIds: [] }, 'nearest_water', evidence).problems;

    expect(problems('Lihat https://contoh.id')).toEqual(['url']);
    expect(problems('**Platform 3**')).toEqual(['markdown']);
    expect(problems('Platform 3 tersedia 👍')).toEqual(['emoji']);
    expect(problems('a'.repeat(401))).toEqual(['too_long']);
    expect(problems('Ya. Ya. Ya. Ya.')).toEqual(['too_many_sentences']);
    expect(problems('')).toEqual(['empty_message']);
  });

  it('drops facility ids for review_summary without failing the answer', async () => {
    const { evidence } = await collect('review_summary');
    const message = 'Ada 4 ulasan air di Stasiun Manggarai dengan rating rata-rata 4 dari 5.';

    expect(checkAnswer({ message, facilityIds: ['x'] }, 'review_summary', evidence)).toEqual({
      ok: true,
      problems: [],
      facilityIds: [],
    });
  });
});

describe('checkAnswer: the time_to_refill verdict', () => {
  async function verdictProblem(
    message: string,
    options: { dataset?: DemoDataset; now?: Date } = {},
  ): Promise<boolean> {
    const { evidence } = await collect('time_to_refill', DEMO_STATIONS.manggarai, options);
    const facilityIds = ['fac-manggarai-water-p3'];
    return checkAnswer({ message, facilityIds }, 'time_to_refill', evidence).problems.includes(
      'time_verdict',
    );
  }

  // 08:03: the next train leaves in 7 minutes and 3 are needed, so there is time.
  it.each([
    ['Kamu masih sempat isi air, kereta berikutnya 7 menit lagi.', false],
    ['Anda bisa isi air sebelum kereta berikutnya yang berangkat dalam 7 menit.', false],
    ['Kereta berikutnya berangkat 7 menit lagi.', true],
    ['Kereta berangkat 7 menit lagi, jadi waktunya tidak cukup.', true],
  ])('with enough time: "%s" is a problem: %s', async (message, problem) => {
    expect(await verdictProblem(message)).toBe(problem);
  });

  // 08:08: the next train leaves in 2 minutes and 3 are needed.
  it.each([
    // Said by gpt-oss-20b in a live eval run.
    ['Anda dapat mengisi air sebelum kereta berikutnya yang berangkat dalam 2 menit.', true],
    ['Kamu masih sempat, kereta berikutnya 2 menit lagi.', true],
    ['Kereta Bogor Line berangkat 2 menit lagi, cek papan informasi stasiun.', true],
    ['Kereta berangkat 2 menit lagi, jadi waktunya tidak cukup.', false],
    ['Kamu tidak akan sempat, kereta berangkat 2 menit lagi.', false],
  ])('with too little time: "%s" is a problem: %s', async (message, problem) => {
    expect(await verdictProblem(message, { now: WED_0808 })).toBe(problem);
  });

  it.each([
    ['Water Station di Platform 3 tersedia, perkiraan 45 m.', true],
    ['Data jadwal belum tersedia, jadi waktunya belum bisa dihitung.', false],
    ['Jadwal belum tersedia, tapi kamu masih sempat.', true],
  ])('without a schedule: "%s" is a problem: %s', async (message, problem) => {
    expect(await verdictProblem(message, { dataset: 'no_schedule' })).toBe(problem);
  });

  it('accepts every deterministic time_to_refill answer', async () => {
    for (const options of [{}, { now: WED_0808 }, { dataset: 'no_schedule' as const }]) {
      const { answer } = await deterministic('time_to_refill', DEMO_STATIONS.manggarai, options);
      expect(await verdictProblem(answer.message, options)).toBe(false);
    }
  });

  it('applies only to time_to_refill', async () => {
    const { evidence } = await collect('nearest_water');
    const message = 'Water Station di Platform 3 tersedia, perkiraan 45 m dari titik tengah stasiun.';

    expect(checkAnswer({ message, facilityIds: [] }, 'nearest_water', evidence).problems).toEqual(
      [],
    );
  });
});
