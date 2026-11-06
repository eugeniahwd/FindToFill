import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StationHeader } from '@/components/layout/StationHeader';
import { useLocation } from '@/context/LocationContext';
import type { Station } from '@/lib/types';

jest.mock('@/context/LocationContext', () => ({ useLocation: jest.fn() }));

const station: Station = {
  id: 'st-1',
  name: 'Manggarai',
  lines: ['Bogor Line'],
  latitude: -6.20988,
  longitude: 106.85018,
  isPilot: true,
};

function mockLocation(overrides: Partial<ReturnType<typeof useLocation>> = {}) {
  const value = {
    coords: null,
    isLocating: false,
    locationError: null,
    stations: [station],
    detectedStation: station,
    selectedStation: station,
    selectStation: jest.fn(),
    isFarFromPilotStations: false,
    distanceToSelectedStationM: null,
    showStationPicker: false,
    setShowStationPicker: jest.fn(),
    requestLocation: jest.fn(),
    ...overrides,
  };
  jest.mocked(useLocation).mockReturnValue(value);
  return value;
}

describe('StationHeader', () => {
  it('shows the current station without a notice when inside the pilot area', () => {
    mockLocation();
    render(<StationHeader />);
    expect(screen.getByRole('heading', { name: 'Stasiun Manggarai' })).toBeInTheDocument();
    expect(screen.getByText('Current Station')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('attaches the outside-pilot notice when the user is far from the pilot stations', () => {
    mockLocation({ isFarFromPilotStations: true });
    render(<StationHeader />);
    expect(screen.getByText('Nearest Station')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Anda berada di luar stasiun uji coba. Menampilkan stasiun terdekat.',
    );
  });

  it('shows the GPS error as the notice when location is unavailable', () => {
    mockLocation({ locationError: 'Akses lokasi ditolak. Silakan pilih stasiun secara manual.' });
    render(<StationHeader />);
    expect(screen.getByRole('status')).toHaveTextContent('Akses lokasi ditolak');
  });

  it('opens the station picker from the round change button', async () => {
    const location = mockLocation();
    render(<StationHeader />);
    await userEvent.click(screen.getByRole('button', { name: 'Ganti stasiun' }));
    expect(location.setShowStationPicker).toHaveBeenCalledWith(true);
  });
});
