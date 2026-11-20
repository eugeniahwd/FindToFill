import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MapPage from '@/app/map/page';
import { resolveSheetDrag } from '@/components/common/useSheetDrag';
import { useLocation } from '@/context/LocationContext';
import type { Station } from '@/lib/types';

jest.mock('@/context/LocationContext', () => ({ useLocation: jest.fn() }));
jest.mock('@/components/map/MapView', () => ({ MapView: () => null }));
jest.mock('@/lib/services/stationService', () => ({
  stationService: {
    getStations: jest.fn(() => Promise.resolve([])),
    getStationFacilities: jest.fn(() => Promise.resolve([])),
  },
}));

// jsdom has no PointerEvent; without it fireEvent drops clientY. A MouseEvent carries it.
if (typeof window.PointerEvent === 'undefined') {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = TestPointerEvent;
}

const station: Station = {
  id: 'id-tebet',
  name: 'Tebet',
  lines: ['Bogor Line'],
  latitude: -6.22664,
  longitude: 106.85827,
  isPilot: true,
};

describe('resolveSheetDrag', () => {
  it('opens on a drag up and closes on a drag down', () => {
    expect(resolveSheetDrag(false, -80)).toBe(true);
    expect(resolveSheetDrag(true, 80)).toBe(false);
  });

  it('keeps the state for a small wobble and toggles on a tap', () => {
    expect(resolveSheetDrag(false, -20)).toBe(false);
    expect(resolveSheetDrag(true, 20)).toBe(true);
    expect(resolveSheetDrag(false, 0)).toBe(true);
    expect(resolveSheetDrag(true, 2)).toBe(false);
  });
});

describe('map page facility sheet', () => {
  beforeEach(() => {
    jest.mocked(useLocation).mockReturnValue({
      coords: null,
      isLocating: false,
      locationError: null,
      stations: [station],
      detectedStation: station,
      selectedStation: station,
      selectStation: jest.fn(),
      isStationPickedManually: false,
      isFarFromPilotStations: false,
      distanceToSelectedStationM: null,
      showStationPicker: false,
      setShowStationPicker: jest.fn(),
      requestLocation: jest.fn(),
    });
  });

  it('opens when the handle is dragged up and closes when dragged down', async () => {
    render(<MapPage />);
    await act(async () => {});
    const handle = screen.getByRole('button', { name: 'Buka daftar fasilitas' });

    fireEvent.pointerDown(handle, { clientY: 600, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 450, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 450, pointerId: 1 });
    expect(screen.getByRole('button', { name: 'Kecilkan daftar' })).toHaveAttribute('aria-expanded', 'true');

    const open = screen.getByRole('button', { name: 'Kecilkan daftar' });
    fireEvent.pointerDown(open, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(open, { clientY: 400, pointerId: 1 });
    fireEvent.pointerUp(open, { clientY: 400, pointerId: 1 });
    expect(screen.getByRole('button', { name: 'Buka daftar fasilitas' })).toHaveAttribute('aria-expanded', 'false');
  });
});
