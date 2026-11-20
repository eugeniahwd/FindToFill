import React from 'react';
import { act, render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { useLocation } from '@/context/LocationContext';
import type { Station } from '@/lib/types';

jest.mock('@/context/LocationContext', () => ({ useLocation: jest.fn() }));
jest.mock('@/components/layout/StationHeader', () => ({ StationHeader: () => null }));
jest.mock('@/lib/services/stationService', () => ({
  stationService: { getStationFacilities: jest.fn(() => Promise.resolve([])) },
}));
const mapProps: { zoom?: number }[] = [];
jest.mock('@/components/map/MapView', () => ({
  MapView: (props: { zoom?: number }) => {
    mapProps.push(props);
    return null;
  },
}));

function station(name: string): Station {
  return { id: `id-${name}`, name, lines: ['Bogor Line'], latitude: -6.22664, longitude: 106.85827, isPilot: true };
}

function mockLocation(name: string) {
  jest.mocked(useLocation).mockReturnValue({
    coords: null,
    isLocating: false,
    locationError: null,
    stations: [station(name)],
    detectedStation: station(name),
    selectedStation: station(name),
    selectStation: jest.fn(),
    isStationPickedManually: false,
    isFarFromPilotStations: false,
    distanceToSelectedStationM: null,
    showStationPicker: false,
    setShowStationPicker: jest.fn(),
    requestLocation: jest.fn(),
  });
}

describe('home page trains', () => {
  beforeEach(() => {
    mapProps.length = 0;
    // Thursday 04:00 WIB: Tebet has a timetable but no train is between stations yet.
    jest.useFakeTimers({ now: new Date('2026-12-02T21:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());

  it('opens the map zoomed out enough to see trains on the neighbouring track', async () => {
    mockLocation('Tebet');
    render(<HomePage />);
    await act(async () => {});
    expect(mapProps.at(-1)?.zoom).toBe(16);
  });

  it('shows the schedule-estimate note exactly once for a station with a timetable', async () => {
    mockLocation('Tebet');
    render(<HomePage />);
    await act(async () => {});
    expect(screen.getAllByText(/perkiraan dari jadwal/i)).toHaveLength(1);
  });

  it('shows no estimate note for a station without timetable', async () => {
    mockLocation('Juanda');
    render(<HomePage />);
    await act(async () => {});
    expect(screen.queryByText(/perkiraan dari jadwal/i)).not.toBeInTheDocument();
  });
});
