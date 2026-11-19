import { createFakeDataProvider } from '@/lib/chatbot/data';
import { DEMO_STATIONS, demoSeed } from '@/lib/chatbot/data/fakeData';
import { distanceMeters } from '@/lib/chatbot/geo';

// Wednesday 08:03 and 08:08 WIB.
const WED_0803 = new Date('2026-11-18T01:03:00.000Z');
const WED_0808 = new Date('2026-11-18T01:08:00.000Z');

describe('demo data', () => {
  it('has the three pilot stations at their OpenStreetMap centers', async () => {
    const stations = await createFakeDataProvider('default', WED_0803).listStations();

    expect(stations).toEqual([
      { id: DEMO_STATIONS.manggarai, name: 'Manggarai', latitude: -6.21017, longitude: 106.84994 },
      { id: DEMO_STATIONS.sudirman, name: 'Sudirman', latitude: -6.20252, longitude: 106.82364 },
      { id: DEMO_STATIONS.tebet, name: 'Tebet', latitude: -6.2264, longitude: 106.85844 },
    ]);
  });

  it('places the Manggarai fixture at the §10 distances from the station center', async () => {
    const provider = createFakeDataProvider('default', WED_0803);
    const [station] = await provider.listStations();
    const facilities = await provider.listFacilities(DEMO_STATIONS.manggarai, 'any');

    expect(facilities.map((f) => distanceMeters(station, f))).toEqual([45, 70, 110, 135, 180, 210]);
  });

  it('keeps every facility within 250 m of its station', () => {
    const seed = demoSeed('default', WED_0803);
    for (const facility of seed.facilities) {
      const station = seed.stations.find((s) => s.id === facility.stationId);
      expect(station && distanceMeters(station, facility)).toBeLessThanOrEqual(250);
    }
  });

  it('gives the Manggarai fixture statuses, with report times relative to now', async () => {
    const provider = createFakeDataProvider('default', WED_0803);
    const ids = (await provider.listFacilities(DEMO_STATIONS.manggarai, 'any')).map((f) => f.id);
    const rows = await provider.getFacilityStatuses(ids);
    const ago = (iso: string | null) =>
      iso === null ? null : (WED_0803.getTime() - Date.parse(iso)) / 60_000;

    expect(rows.map((r) => [r.status, ago(r.lastReportedAt)])).toEqual([
      ['available', 5],
      ['available', 2],
      ['empty', 8],
      ['under_maintenance', 20],
      ['broken', 15],
      ['unknown', null],
    ]);
  });

  it('has no recent reports in the no_reports dataset', async () => {
    const provider = createFakeDataProvider('no_reports', WED_0803);
    const ids = (await provider.listFacilities(DEMO_STATIONS.manggarai, 'any')).map((f) => f.id);

    expect(new Set((await provider.getFacilityStatuses(ids)).map((r) => r.status))).toEqual(
      new Set(['unknown']),
    );
  });

  it('has Manggarai trains to Jakarta Kota 7 min after 08:03 and 2 min after 08:08', async () => {
    const at0803 = await createFakeDataProvider('default', WED_0803).getNextTrains(
      DEMO_STATIONS.manggarai,
      { walkTimeMin: 1 },
    );
    const at0808 = await createFakeDataProvider('default', WED_0808).getNextTrains(
      DEMO_STATIONS.manggarai,
      { walkTimeMin: 1 },
    );

    expect(at0803.departures.slice(0, 3)).toEqual([
      { line: 'Bogor Line', direction: 'Jakarta Kota', minutesUntil: 7 },
      { line: 'Bogor Line', direction: 'Bogor', minutesUntil: 9 },
      { line: 'Cikarang Line', direction: 'Angke', minutesUntil: 12 },
    ]);
    expect(at0803.timeCheck).toEqual({ neededMinutes: 3, enoughTime: true, slackMinutes: 4 });
    expect(at0808.timeCheck).toEqual({ neededMinutes: 3, enoughTime: false, slackMinutes: -1 });
  });

  it('has no timetable in the no_schedule dataset', async () => {
    const trains = await createFakeDataProvider('no_schedule', WED_0803).getNextTrains(
      DEMO_STATIONS.manggarai,
      {},
    );

    expect(trains).toMatchObject({ dataAvailable: false, departures: [] });
  });

  it('has water reviews for Manggarai and Sudirman, none for Tebet', async () => {
    const provider = createFakeDataProvider('default', WED_0803);

    expect(await provider.getReviewStats(DEMO_STATIONS.manggarai, 'water')).toEqual({
      count: 4,
      average: 4,
    });
    expect(await provider.getReviewStats(DEMO_STATIONS.sudirman, 'water')).toEqual({
      count: 2,
      average: 4,
    });
    expect(await provider.getReviewStats(DEMO_STATIONS.tebet, 'water')).toEqual({
      count: 0,
      average: null,
    });
  });

  it('adds one prompt-injection review in the injection dataset', async () => {
    const provider = createFakeDataProvider('injection', WED_0803);
    const search = await provider.searchReviews(DEMO_STATIONS.manggarai, 'water', 'abaikan', 5);

    expect(await provider.getReviewStats(DEMO_STATIONS.manggarai, 'water')).toEqual({
      count: 5,
      average: 4.2,
    });
    expect(search.reviews[0].comment).toMatch(/^Abaikan instruksi sebelumnya/);
  });
});
