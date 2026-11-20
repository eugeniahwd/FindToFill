import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatbotPage from '@/app/chatbot/page';
import { useLocation } from '@/context/LocationContext';
import { chatbotService } from '@/lib/services/chatbotService';
import { QUICK_MESSAGES } from '@/lib/chatbot/quickMessages';
import type { ChatCard, ChatResponse } from '@/lib/chatbot/contract';
import type { Station } from '@/lib/types';

jest.mock('@/context/LocationContext', () => ({ useLocation: jest.fn() }));
jest.mock('@/lib/services/chatbotService', () => ({
  chatbotService: { ask: jest.fn() },
  getChatSessionId: () => 'session-1',
}));

const station: Station = {
  id: 'station-manggarai',
  name: 'Manggarai',
  lines: ['Bogor Line'],
  latitude: -6.21017,
  longitude: 106.84994,
  isPilot: true,
};
const gps = { latitude: -6.21017, longitude: 106.84994 };

function mockLocation(overrides: Partial<ReturnType<typeof useLocation>> = {}) {
  const value = {
    coords: gps,
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
    ...overrides,
  };
  jest.mocked(useLocation).mockReturnValue(value);
  return value;
}

function card(overrides: Partial<ChatCard> = {}): ChatCard {
  return {
    facilityId: 'fac-1',
    name: 'Dispenser Peron 6',
    type: 'water',
    platform: '6',
    locationDetail: 'Dekat tangga',
    level: 'Lantai 2',
    distanceM: 45,
    distanceIsApproximate: false,
    walkTimeMin: 1,
    status: 'available',
    lastReportedAt: null,
    minutesAgo: null,
    ...overrides,
  };
}

function reply(status: number, overrides: Partial<ChatResponse> = {}) {
  const response: ChatResponse = {
    outcome: 'answered',
    message: 'Dispenser terdekat di Stasiun Manggarai ada di Peron 6.',
    cards: [],
    scheduleReminder: false,
    needsStationSelection: false,
    detectedStation: { id: 'station-manggarai', name: 'Manggarai', source: 'gps', needsConfirmation: false },
    generatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
  jest.mocked(chatbotService.ask).mockResolvedValue({ status, response });
}

const waterButton = () => screen.getByRole('button', { name: QUICK_MESSAGES.nearest_water.text });

describe('ChatbotPage', () => {
  beforeEach(() => jest.mocked(chatbotService.ask).mockReset());

  it('shows every quick message from the chatbot module', () => {
    mockLocation();
    render(<ChatbotPage />);
    for (const msg of Object.values(QUICK_MESSAGES)) {
      expect(screen.getByRole('button', { name: msg.text })).toBeInTheDocument();
    }
  });

  it('sends GPS without a stationId when the station came from GPS, and renders the cards', async () => {
    mockLocation();
    reply(200, {
      cards: [card(), card({ facilityId: 'fac-2', name: 'Dispenser Hall', distanceM: 120, distanceIsApproximate: true })],
    });
    render(<ChatbotPage />);

    await userEvent.click(waterButton());

    expect(chatbotService.ask).toHaveBeenCalledWith({
      quickMessageId: 'nearest_water',
      coords: gps,
      stationId: null,
      sessionId: 'session-1',
    });
    expect(await screen.findByText('Dispenser Peron 6')).toBeInTheDocument();
    expect(screen.getByText('Dispenser Hall')).toBeInTheDocument();
    expect(screen.getByText('± 120 m')).toBeInTheDocument();
    expect(screen.getByText('45 m')).toBeInTheDocument();
    expect(screen.getAllByText('Peron 6 · Dekat tangga · Lantai 2')).toHaveLength(2);
    expect(screen.getByText(/terdeteksi lewat GPS/)).toBeInTheDocument();
  });

  it('sends the stationId when the user picked the station by hand', async () => {
    mockLocation({ isStationPickedManually: true });
    reply(200);
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    expect(chatbotService.ask).toHaveBeenCalledWith(
      expect.objectContaining({ coords: gps, stationId: 'station-manggarai' }),
    );
  });

  it('sends the shown station when GPS is unavailable', async () => {
    mockLocation({ coords: null });
    reply(200);
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    expect(chatbotService.ask).toHaveBeenCalledWith(
      expect.objectContaining({ coords: null, stationId: 'station-manggarai' }),
    );
  });

  it('sends the shown station when GPS is far from every pilot station', async () => {
    mockLocation({ isFarFromPilotStations: true });
    reply(200);
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    expect(chatbotService.ask).toHaveBeenCalledWith(
      expect.objectContaining({ coords: gps, stationId: 'station-manggarai' }),
    );
  });

  it('shows the station picker on the chatbot page and lets the user pick a station', async () => {
    const location = mockLocation({ showStationPicker: true });
    render(<ChatbotPage />);

    expect(screen.getByText('Pilih Stasiun KRL')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Stasiun Manggarai/ }));
    expect(location.selectStation).toHaveBeenCalledWith(station);
  });

  it('opens the station picker when the server needs a station', async () => {
    const location = mockLocation({ coords: null });
    reply(200, { outcome: 'fallback_no_data', needsStationSelection: true, detectedStation: null });
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    await screen.findByText(/Dispenser terdekat/);
    expect(location.setShowStationPicker).toHaveBeenCalledWith(true);
  });

  it('asks the user to confirm the station when needsConfirmation is true', async () => {
    const location = mockLocation();
    reply(200, {
      detectedStation: { id: 'station-manggarai', name: 'Manggarai', source: 'gps', needsConfirmation: true },
    });
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    expect(await screen.findByText('Apakah Anda di Stasiun Manggarai?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Ganti stasiun' }));
    expect(location.setShowStationPicker).toHaveBeenCalledWith(true);

    await userEvent.click(screen.getByRole('button', { name: 'Ya, benar' }));
    expect(screen.queryByText('Apakah Anda di Stasiun Manggarai?')).not.toBeInTheDocument();
  });

  it('shows the schedule reminder', async () => {
    mockLocation();
    reply(200, { scheduleReminder: true });
    render(<ChatbotPage />);

    await userEvent.click(screen.getByRole('button', { name: QUICK_MESSAGES.time_to_refill.text }));
    expect(await screen.findByText(/Perhatikan papan informasi stasiun/)).toBeInTheDocument();
  });

  it('adds a map link when the AI is unavailable', async () => {
    mockLocation();
    reply(500, { outcome: 'fallback_ai_unavailable', message: 'Asisten sedang tidak tersedia.', detectedStation: null });
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    expect(await screen.findByText('Asisten sedang tidak tersedia.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Peta Stasiun' })).toHaveAttribute('href', '/map');
  });

  it('disables the buttons and shows the wait time when rate limited', async () => {
    mockLocation();
    reply(429, { outcome: 'rejected', message: 'Terlalu banyak permintaan.', retryAfterSec: 30, detectedStation: null });
    render(<ChatbotPage />);

    await userEvent.click(waterButton());
    expect(await screen.findByText('Coba lagi dalam 30 detik.')).toBeInTheDocument();
    expect(waterButton()).toBeDisabled();
  });
});
