import { headingAlong, mapTrains, pointAlong } from '@/lib/trains/mapTrains';
import { STATION_COORDS } from '@/lib/trains/segments';
import type { ServiceClock } from '@/lib/trains/clock';

const weekday = (minute: number): ServiceClock => ({ dayType: 'weekday', nextDayType: 'weekday', minute });

describe('pointAlong', () => {
  const path: [number, number][] = [
    [0, 0],
    [0, 0.001],
    [0, 0.003],
  ];

  it('walks the path by length', () => {
    const [lat, lon] = pointAlong(path, 0.5);
    expect(lat).toBeCloseTo(0, 9);
    expect(lon).toBeCloseTo(0.0015, 9);
  });

  it('clamps the fraction to the ends', () => {
    expect(pointAlong(path, -1)).toEqual([0, 0]);
    expect(pointAlong(path, 2)).toEqual([0, 0.003]);
  });
});

describe('headingAlong', () => {
  // Degrees clockwise from north, following the direction of travel.
  it.each([
    ['north', [[0, 0], [0.001, 0]], 0],
    ['east', [[0, 0], [0, 0.001]], 90],
    ['south', [[0.001, 0], [0, 0]], 180],
    ['west', [[0, 0.001], [0, 0]], 270],
  ] as const)('points %s along a straight track', (_dir, path, expected) => {
    expect(headingAlong(path as unknown as [number, number][], 0.5)).toBeCloseTo(expected, 5);
  });

  it('uses the piece of track the train is on', () => {
    const bend: [number, number][] = [
      [0, 0],
      [0, 0.001], // east first
      [0.002, 0.001], // then north (longer piece)
    ];
    expect(headingAlong(bend, 0.1)).toBeCloseTo(90, 5);
    expect(headingAlong(bend, 0.9)).toBeCloseTo(0, 5);
  });
});

describe('mapTrains', () => {
  it('turns KA 1125 to face its way along the track (Cawang to Tebet runs roughly north)', () => {
    const ka = mapTrains('Tebet', weekday(276.5)).find((t) => t.detail.train === '1125');
    const heading = ka!.heading;
    expect(heading >= 0 && heading < 360).toBe(true);
    expect(heading > 315 || heading < 45).toBe(true);
  });

  it('places KA 1125 between Cawang and Tebet halfway through its run', () => {
    const trains = mapTrains('Tebet', weekday(276.5));
    const ka = trains.find((t) => t.detail.train === '1125');
    expect(ka).toBeDefined();
    expect(ka?.color).toBe('#E30A16');
    expect(ka?.label).toBe('→ Manggarai/Jakarta Kota ±2 mnt');
    expect(ka?.detail).toEqual({ train: '1125', relasi: 'Dp - Jakk', arrival: '04.38' });
    const [lat] = ka!.position;
    expect(lat).toBeGreaterThan(STATION_COORDS.CW[0]);
    expect(lat).toBeLessThan(STATION_COORDS.TEB[0]);
  });

  it('only shows trains that are between stations right now', () => {
    // 04:34: KA 1125 has not left Cawang (04:35) yet.
    expect(mapTrains('Tebet', weekday(274)).find((t) => t.detail.train === '1125')).toBeUndefined();
  });

  it('shows nothing for a station without timetable', () => {
    expect(mapTrains('Juanda', weekday(600))).toEqual([]);
  });
});
