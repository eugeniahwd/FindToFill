import { mapTrains, pointAlong } from '@/lib/trains/mapTrains';
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

describe('mapTrains', () => {
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
