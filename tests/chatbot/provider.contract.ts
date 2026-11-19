/**
 * tests/chatbot/provider.contract.ts
 *
 * Contract tests for ChatbotDataProvider (docs/AI_TRACK.md §12). Every implementation must pass
 * them: FakeDataProvider now (tests/chatbot/fakeProvider.test.ts), SupabaseDataProvider later.
 *
 * Backend usage, in a *.test.ts file:
 *   import { runProviderContractTests } from './chatbot/provider.contract';
 *   runProviderContractTests('SupabaseDataProvider', (seed) => buildProviderOn(seed));
 *
 * The factory receives database-shaped rows (ProviderSeed in src/lib/chatbot/data/provider.ts)
 * and must return a provider that reads exactly those rows and treats `seed.now` as the current
 * time: for the 7-day status window and for next trains (getNextTrains(db, id, { now })).
 * Ids are UUIDs, so the same rows fit the real tables.
 */

import type {
  ChatbotDataProvider,
  NextTrains,
  ProviderSeed,
  SeedFacility,
  SeedReport,
  SeedReview,
  SeedSchedule,
  SeedStation,
} from '@/lib/chatbot/data/provider';

export type ProviderFactory = (
  seed: ProviderSeed,
) => ChatbotDataProvider | Promise<ChatbotDataProvider>;

// Stations: A and B are pilot stations, X is not.
const STATION_A = 'a0000000-0000-4000-8000-00000000000a';
const STATION_B = 'b0000000-0000-4000-8000-00000000000b';
const STATION_X = 'c0000000-0000-4000-8000-00000000000c';
// Facilities.
const WATER_1 = 'f1000000-0000-4000-8000-000000000001'; // A, water, all text columns set
const WATER_2 = 'f2000000-0000-4000-8000-000000000002'; // A, water, empty text columns
const CHARGING_1 = 'f3000000-0000-4000-8000-000000000003'; // A, charging
const WATER_INACTIVE = 'f4000000-0000-4000-8000-000000000004'; // A, water, switched off
const WATER_B = 'f5000000-0000-4000-8000-000000000005'; // B, water
const WATER_X = 'f6000000-0000-4000-8000-000000000006'; // X (not pilot), water
const UNKNOWN_ID = '99999999-9999-4999-8999-999999999999';

// Wednesday 08:00 WIB. Saturday 08:00 WIB. Friday 17:30 UTC is already Saturday 00:30 WIB.
const WEDNESDAY_0800_WIB = new Date('2026-11-18T01:00:00.000Z');
const SATURDAY_0800_WIB = new Date('2026-11-21T01:00:00.000Z');
const SATURDAY_0030_WIB = new Date('2026-11-20T17:30:00.000Z');

const HOUR = 60;
const DAY = 24 * HOUR;
const minutesBefore = (minutes: number) =>
  new Date(WEDNESDAY_0800_WIB.getTime() - minutes * 60_000).toISOString();

const LONG_COMMENT_WITH_URL =
  'Air bersih, kadang antre. Lihat https://spam.example.com/promo ' + 'enak '.repeat(80);

// Row builders, so the seed below reads like a table.
const station = (
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  isPilot: boolean,
): SeedStation => ({ id, name, latitude, longitude, isPilot });

const facility = (
  id: string,
  stationId: string,
  type: SeedFacility['type'],
  name: string,
  isActive = true,
): SeedFacility => ({
  id,
  stationId,
  type,
  name,
  platform: null,
  locationDetail: null,
  level: null,
  latitude: -6.2,
  longitude: 106.85,
  isActive,
});

const report = (
  facilityId: string,
  status: SeedReport['status'],
  createdMinutesAgo: number,
  removedMinutesAgo: number | null = null,
): SeedReport => ({
  facilityId,
  status,
  createdAt: minutesBefore(createdMinutesAgo),
  removedAt: removedMinutesAgo === null ? null : minutesBefore(removedMinutesAgo),
});

const departure = (
  stationId: string,
  line: string,
  direction: string,
  dayType: SeedSchedule['dayType'],
  departureTime: string,
): SeedSchedule => ({ stationId, line, direction, dayType, departureTime });

const review = (
  facilityId: string,
  rating: number,
  comment: string,
  createdMinutesAgo: number,
  removedMinutesAgo: number | null = null,
): SeedReview => ({
  facilityId,
  rating,
  comment,
  createdAt: minutesBefore(createdMinutesAgo),
  removedAt: removedMinutesAgo === null ? null : minutesBefore(removedMinutesAgo),
});

/** The rows every contract test starts from. Only `now` changes between tests. */
export function contractSeed(now: Date = WEDNESDAY_0800_WIB): ProviderSeed {
  return {
    now,
    stations: [
      station(STATION_A, 'Stasiun A', -6.21017, 106.84994, true),
      station(STATION_B, 'Stasiun B', -6.2264, 106.85844, true),
      station(STATION_X, 'Stasiun X', -6.3, 106.9, false),
    ],
    facilities: [
      {
        ...facility(WATER_1, STATION_A, 'water', 'Water Station'),
        platform: '3',
        locationDetail: 'Near the stairs',
        level: 'L1',
        latitude: -6.2102,
        longitude: 106.84998,
      },
      facility(WATER_2, STATION_A, 'water', 'Water Refill'),
      facility(CHARGING_1, STATION_A, 'charging', 'Charging Lounge'),
      facility(WATER_INACTIVE, STATION_A, 'water', 'Old Dispenser', false),
      facility(WATER_B, STATION_B, 'water', 'Water Station B'),
      facility(WATER_X, STATION_X, 'water', 'Water Station X'),
    ],
    reports: [
      // WATER_1: the newer report wins; both count as active.
      report(WATER_1, 'broken', 2 * DAY),
      report(WATER_1, 'available', HOUR),
      // WATER_2: the newest report was removed by an admin, so the older one counts.
      report(WATER_2, 'empty', 3 * HOUR),
      report(WATER_2, 'available', 30, 10),
      // CHARGING_1: only a report older than 7 days.
      report(CHARGING_1, 'available', 8 * DAY),
      // An inactive facility never appears, whatever its reports say.
      report(WATER_INACTIVE, 'available', HOUR),
    ],
    schedules: [
      departure(STATION_A, 'Bogor Line', 'Jakarta Kota', 'weekday', '08:07'),
      departure(STATION_A, 'Bogor Line', 'Jakarta Kota', 'weekday', '08:17'),
      departure(STATION_A, 'Bogor Line', 'Jakarta Kota', 'weekday', '08:27'),
      departure(STATION_A, 'Bogor Line', 'Bogor', 'weekday', '07:58'),
      departure(STATION_A, 'Bogor Line', 'Bogor', 'weekday', '08:03'),
      departure(STATION_A, 'Bogor Line', 'Bogor', 'weekday', '08:30'),
      departure(STATION_A, 'Cikarang Line', 'Angke', 'weekday', '08:12:00'),
      departure(STATION_A, 'Bogor Line', 'Jakarta Kota', 'weekend', '08:20'),
      // Station B: a weekday timetable that has ended by 08:00, and no weekend timetable.
      departure(STATION_B, 'Cikarang Line', 'Bekasi', 'weekday', '06:00'),
      departure(STATION_B, 'Cikarang Line', 'Bekasi', 'weekday', '07:30'),
    ],
    reviews: [
      review(WATER_1, 5, 'Airnya dingin dan bersih', DAY),
      review(WATER_2, 4, LONG_COMMENT_WITH_URL, 2 * DAY),
      // Excluded from every result below: removed, other type, inactive facility, other station.
      review(WATER_1, 1, 'Spam', HOUR, 30),
      review(CHARGING_1, 3, 'Colokan longgar', HOUR),
      review(WATER_INACTIVE, 2, 'Sudah dicabut', HOUR),
      review(WATER_B, 5, 'Mantap', HOUR),
    ],
  };
}

const sortedIds = (rows: { id: string }[]) => rows.map((row) => row.id).sort();
const departuresOf = (trains: NextTrains) =>
  trains.departures.map(({ line, direction, minutesUntil }) => ({ line, direction, minutesUntil }));

export function runProviderContractTests(name: string, factory: ProviderFactory): void {
  describe(`ChatbotDataProvider contract: ${name}`, () => {
    const build = async (now?: Date) => factory(contractSeed(now));

    describe('listStations', () => {
      it('lists pilot stations only, with their center coordinates', async () => {
        const stations = await (await build()).listStations();

        expect(sortedIds(stations)).toEqual([STATION_A, STATION_B]);
        expect(stations.find((s) => s.id === STATION_A)).toMatchObject({
          name: 'Stasiun A',
          latitude: -6.21017,
          longitude: 106.84994,
        });
      });
    });

    describe('listFacilities', () => {
      it('returns the active facilities of a station for "any", and filters by type', async () => {
        const provider = await build();

        expect(sortedIds(await provider.listFacilities(STATION_A, 'any'))).toEqual(
          [WATER_1, WATER_2, CHARGING_1].sort(),
        );
        expect(sortedIds(await provider.listFacilities(STATION_A, 'water'))).toEqual(
          [WATER_1, WATER_2].sort(),
        );
        expect(sortedIds(await provider.listFacilities(STATION_A, 'charging'))).toEqual([
          CHARGING_1,
        ]);
      });

      it('returns nothing for a station that does not exist', async () => {
        expect(await (await build()).listFacilities(UNKNOWN_ID, 'any')).toEqual([]);
      });

      it('maps every column, with null (never undefined) for empty text columns', async () => {
        const facilities = await (await build()).listFacilities(STATION_A, 'water');
        const full = facilities.find((f) => f.id === WATER_1);
        const empty = facilities.find((f) => f.id === WATER_2);

        expect(full).toMatchObject({
          stationId: STATION_A,
          type: 'water',
          name: 'Water Station',
          platform: '3',
          locationDetail: 'Near the stairs',
          level: 'L1',
          latitude: -6.2102,
          longitude: 106.84998,
        });
        expect(empty?.platform).toBeNull();
        expect(empty?.locationDetail).toBeNull();
        expect(empty?.level).toBeNull();
      });
    });

    describe('getFacilityStatuses', () => {
      const statuses = async () => {
        const rows = await (await build()).getFacilityStatuses([
          WATER_1,
          WATER_2,
          CHARGING_1,
          WATER_B,
          WATER_INACTIVE,
          UNKNOWN_ID,
        ]);
        return new Map(rows.map((row) => [row.facilityId, row]));
      };

      it('returns one row per active facility, without inactive or unknown ids', async () => {
        expect([...(await statuses()).keys()].sort()).toEqual(
          [WATER_1, WATER_2, CHARGING_1, WATER_B].sort(),
        );
      });

      it('uses the most recent report from the last 7 days and counts active ones', async () => {
        const row = (await statuses()).get(WATER_1);

        expect(row?.status).toBe('available');
        expect(Date.parse(row?.lastReportedAt ?? '')).toBe(Date.parse(minutesBefore(HOUR)));
        expect(row?.activeReportCount).toBe(2);
      });

      it('ignores removed reports', async () => {
        const row = (await statuses()).get(WATER_2);

        expect(row?.status).toBe('empty');
        expect(Date.parse(row?.lastReportedAt ?? '')).toBe(Date.parse(minutesBefore(3 * HOUR)));
        expect(row?.activeReportCount).toBe(1);
      });

      it('reports "unknown" when there is no report in the last 7 days', async () => {
        const rows = await statuses();
        const unknown = { status: 'unknown', lastReportedAt: null, activeReportCount: 0 };

        expect(rows.get(CHARGING_1)).toMatchObject(unknown);
        expect(rows.get(WATER_B)).toMatchObject(unknown);
      });

      it('returns nothing for an empty id list', async () => {
        expect(await (await build()).getFacilityStatuses([])).toEqual([]);
      });
    });

    describe('getNextTrains', () => {
      it('lists the next 2 per line and direction, soonest first, on WIB time', async () => {
        const trains = await (await build()).getNextTrains(STATION_A, {});

        expect(trains.dataAvailable).toBe(true);
        expect(trains.serviceEnded).toBe(false);
        expect(trains.timeCheck).toBeUndefined();
        expect(departuresOf(trains)).toEqual([
          { line: 'Bogor Line', direction: 'Bogor', minutesUntil: 3 },
          { line: 'Bogor Line', direction: 'Jakarta Kota', minutesUntil: 7 },
          { line: 'Cikarang Line', direction: 'Angke', minutesUntil: 12 },
          { line: 'Bogor Line', direction: 'Jakarta Kota', minutesUntil: 17 },
          { line: 'Bogor Line', direction: 'Bogor', minutesUntil: 30 },
        ]);
      });

      it('checks 2 x walk + 1 minute against the soonest departure', async () => {
        const provider = await build();

        expect((await provider.getNextTrains(STATION_A, { walkTimeMin: 2 })).timeCheck).toEqual({
          neededMinutes: 5,
          enoughTime: false,
          slackMinutes: -2,
        });
        expect((await provider.getNextTrains(STATION_A, { walkTimeMin: 1 })).timeCheck).toEqual({
          neededMinutes: 3,
          enoughTime: true,
          slackMinutes: 0,
        });
      });

      it('filters by line, and has no data for a line without a timetable', async () => {
        const provider = await build();
        const cikarang = await provider.getNextTrains(STATION_A, { line: 'Cikarang Line' });

        expect(departuresOf(cikarang)).toEqual([
          { line: 'Cikarang Line', direction: 'Angke', minutesUntil: 12 },
        ]);
        expect(await provider.getNextTrains(STATION_A, { line: 'No Such Line' })).toMatchObject({
          dataAvailable: false,
          departures: [],
        });
      });

      it('marks the service as ended when no departure is left today', async () => {
        const trains = await (await build()).getNextTrains(STATION_B, { walkTimeMin: 1 });

        expect(trains).toMatchObject({ dataAvailable: true, serviceEnded: true, departures: [] });
        expect(trains.timeCheck).toBeUndefined();
      });

      it('uses the weekend timetable on Saturday, and has no data without one', async () => {
        const provider = await build(SATURDAY_0800_WIB);

        expect(departuresOf(await provider.getNextTrains(STATION_A, {}))).toEqual([
          { line: 'Bogor Line', direction: 'Jakarta Kota', minutesUntil: 20 },
        ]);
        expect(await provider.getNextTrains(STATION_B, {})).toMatchObject({
          dataAvailable: false,
          serviceEnded: false,
          departures: [],
        });
      });

      it('takes the day from WIB: Friday 17:30 UTC is Saturday 00:30 WIB', async () => {
        const trains = await (await build(SATURDAY_0030_WIB)).getNextTrains(STATION_A, {});

        expect(departuresOf(trains)).toEqual([
          { line: 'Bogor Line', direction: 'Jakarta Kota', minutesUntil: 470 },
        ]);
      });

      it('has no data for a station that does not exist', async () => {
        expect(await (await build()).getNextTrains(UNKNOWN_ID, {})).toMatchObject({
          dataAvailable: false,
          departures: [],
        });
      });
    });

    describe('searchReviews', () => {
      const QUERY = 'kualitas air';

      it('returns only non-removed reviews of active facilities of the type', async () => {
        const search = await (await build()).searchReviews(STATION_A, 'water', QUERY, 5);
        const found = search.reviews
          .map(({ facilityId, rating }) => ({ facilityId, rating }))
          .sort((a, b) => b.rating - a.rating);

        expect(['semantic', 'latest']).toContain(search.method);
        expect(found).toEqual([
          { facilityId: WATER_1, rating: 5 },
          { facilityId: WATER_2, rating: 4 },
        ]);
      });

      it('adds the facility name and cleans each comment', async () => {
        const { reviews } = await (await build()).searchReviews(STATION_A, 'water', QUERY, 5);
        const water1 = reviews.find((r) => r.facilityId === WATER_1);

        expect(water1?.facilityName).toBe('Water Station');
        expect(water1?.comment).toBe('Airnya dingin dan bersih');
        expect(Date.parse(water1?.createdAt ?? '')).toBe(Date.parse(minutesBefore(DAY)));
        for (const { comment } of reviews) {
          expect(comment).not.toMatch(/https?:\/\//);
          expect(comment.length).toBeLessThanOrEqual(300);
        }
      });

      it('respects the limit, the type, and the station', async () => {
        const provider = await build();
        const charging = await provider.searchReviews(STATION_A, 'charging', QUERY, 5);
        const limited = await provider.searchReviews(STATION_A, 'water', QUERY, 1);

        expect(limited.reviews).toHaveLength(1);
        expect(charging.reviews.map((r) => r.facilityId)).toEqual([CHARGING_1]);
        expect((await provider.searchReviews(UNKNOWN_ID, 'water', QUERY, 5)).reviews).toEqual([]);
      });
    });

    describe('getReviewStats', () => {
      it('counts and averages non-removed reviews of active facilities of the type', async () => {
        const provider = await build();

        expect(await provider.getReviewStats(STATION_A, 'water')).toEqual({
          count: 2,
          average: 4.5,
        });
        expect(await provider.getReviewStats(STATION_A, 'charging')).toEqual({
          count: 1,
          average: 3,
        });
        expect(await provider.getReviewStats(STATION_B, 'water')).toEqual({ count: 1, average: 5 });
      });

      it('returns a null average when there are no reviews', async () => {
        expect(await (await build()).getReviewStats(STATION_B, 'charging')).toEqual({
          count: 0,
          average: null,
        });
      });
    });
  });
}
