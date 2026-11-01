import { toFacility, toStation, toStationLayout, withStatus } from '@/lib/data/mappers';
import type { TableRow, ViewRow } from '@/lib/supabase/database.types';

const facilityRow: TableRow<'facilities'> = {
  id: 'f1',
  station_id: 's1',
  type: 'water',
  name: 'Water Station',
  platform: null,
  location_detail: 'Near gate',
  level: 'L1',
  latitude: -6.2,
  longitude: 106.85,
  layout_x: 52,
  layout_y: null,
  is_active: true,
  is_demo_data: true,
};

describe('row mappers', () => {
  it('maps a station row', () => {
    expect(
      toStation({ id: 's1', name: 'Tebet', lines: ['Bogor Line'], latitude: -6.2, longitude: 106.8, is_pilot: true, is_demo_data: false }),
    ).toEqual({ id: 's1', name: 'Tebet', lines: ['Bogor Line'], latitude: -6.2, longitude: 106.8, isPilot: true, isDemoData: false });
  });

  it('maps nulls to undefined and keeps layout percentages numeric', () => {
    const facility = toFacility(facilityRow);
    expect(facility.platform).toBeUndefined();
    expect(facility.layoutX).toBe(52);
    expect(facility.layoutY).toBeUndefined();
    expect(facility.locationDetail).toBe('Near gate');
  });

  it('maps a layout row', () => {
    expect(toStationLayout({ id: 'l1', station_id: 's1', level: 'L2', image_url: 'https://x/l2.png', notes: null })).toEqual({
      id: 'l1',
      stationId: 's1',
      level: 'L2',
      imageUrl: 'https://x/l2.png',
      notes: undefined,
    });
  });
});

describe('withStatus', () => {
  const facility = toFacility(facilityRow);

  it('uses the latest active report', () => {
    const status: ViewRow<'facility_status'> = {
      facility_id: 'f1',
      status: 'empty',
      last_reported_at: '2026-11-01T10:00:00Z',
      photo_path: 'u/p.jpg',
      active_report_count: 3,
    };
    expect(withStatus(facility, status, 'https://signed/p.jpg')).toMatchObject({
      currentStatus: 'empty',
      lastReportedAt: '2026-11-01T10:00:00Z',
      lastPhotoUrl: 'https://signed/p.jpg',
      activeReportCount: 3,
    });
  });

  it('is "unknown" with no report time or photo when nothing is active in 7 days', () => {
    const none: ViewRow<'facility_status'> = {
      facility_id: 'f1',
      status: null,
      last_reported_at: null,
      photo_path: null,
      active_report_count: 0,
    };
    for (const status of [none, undefined]) {
      expect(withStatus(facility, status, 'https://ignored')).toMatchObject({
        currentStatus: 'unknown',
        lastReportedAt: null,
        lastPhotoUrl: null,
        activeReportCount: 0,
      });
    }
  });
});
