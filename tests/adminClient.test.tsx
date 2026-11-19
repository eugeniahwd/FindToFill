import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminService } from '@/lib/services/adminService';
import { adminErrorMessage } from '@/lib/admin/messages';
import { ApiRequestError } from '@/lib/services/apiClient';
import { ReportsModeration } from '@/components/admin/ReportsModeration';
import { ToastProvider } from '@/context/ToastContext';
import type { ModerationReport, Station } from '@/lib/types';

const fetchMock = jest.fn();
const respond = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);

describe('adminService (browser)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('sends the filters as a query string and skips empty ones', async () => {
    fetchMock.mockReturnValue(respond(200, { reports: [] }));
    await adminService.getReports({ stationId: 's1', status: 'broken' });
    await adminService.getReports({});
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/admin/reports?stationId=s1&status=broken', '/api/admin/reports']);
  });

  it('removes with DELETE and returns the removal', async () => {
    const removal = { id: 'r1', removedAt: 'now', removedBy: 'a1' };
    fetchMock.mockReturnValue(respond(200, { removal }));
    expect(await adminService.removeReview('r1')).toEqual(removal);
    expect(fetchMock.mock.calls[0]).toEqual(['/api/admin/reviews/r1', expect.objectContaining({ method: 'DELETE' })]);
  });

  it('adds a departure with POST JSON', async () => {
    fetchMock.mockReturnValue(respond(201, { schedule: { id: 'x' } }));
    await adminService.addDeparture('s1', { line: 'Bogor Line', direction: 'Bogor', dayType: 'weekday', departureTime: '05:30' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/admin/stations/s1/schedules');
    expect(JSON.parse(init.body)).toEqual({ line: 'Bogor Line', direction: 'Bogor', dayType: 'weekday', departureTime: '05:30' });
  });
});

describe('adminErrorMessage', () => {
  it.each([
    ['FORBIDDEN', /bukan admin/],
    ['CONFLICT', /sudah ada/],
    ['SERVICE_UNAVAILABLE', /tidak dapat dihubungi/],
  ])('maps %s', (code, expected) => {
    expect(adminErrorMessage(new ApiRequestError(400, code, 'x'))).toMatch(expected);
  });

  it('keeps the field name from a validation error', () => {
    expect(adminErrorMessage(new ApiRequestError(400, 'VALIDATION_ERROR', 'departureTime: Use HH:MM'))).toContain('departureTime');
  });
});

describe('ReportsModeration', () => {
  const stations: Station[] = [{ id: 's1', name: 'Tebet', lines: [], latitude: 0, longitude: 0, isPilot: true }];
  const report: ModerationReport = {
    id: 'r1', facilityId: 'f1', userId: 'u1', userName: 'budi', status: 'broken', photoUrl: 'https://signed/p.jpg',
    note: 'Kran patah', createdAt: new Date().toISOString(), removedAt: null, removedBy: null,
    facilityName: 'Water Dispenser Gate A', stationId: 's1', stationName: 'Tebet',
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(adminService, 'getReports').mockResolvedValue([report]);
  });

  const renderTab = () =>
    render(
      <ToastProvider>
        <ReportsModeration stations={stations} />
      </ToastProvider>,
    );

  it('lists reports with facility, station, and reporter, and refetches when a filter changes', async () => {
    renderTab();
    expect(await screen.findByText('Water Dispenser Gate A')).toBeInTheDocument();
    expect(screen.getByText(/Stasiun Tebet · budi/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Tebet' }));
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Filter status' })).getByRole('radio', { name: /Broken/i }));
    expect(jest.mocked(adminService.getReports).mock.calls.at(-1)?.[0]).toEqual({ stationId: 's1', status: 'broken' });
  });

  it('asks before Remove, then marks the card as removed (no restore button)', async () => {
    jest.spyOn(adminService, 'removeReport').mockResolvedValue({ id: 'r1', removedAt: new Date().toISOString(), removedBy: 'a1' });
    renderTab();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/tidak bisa dibatalkan/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(adminService.removeReport).toHaveBeenCalledWith('r1');
    expect(await screen.findByText(/Dihapus/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Pulihkan|Approve|Restore/i })).not.toBeInTheDocument();
  });

  it('shows a retry button when loading fails', async () => {
    jest.mocked(adminService.getReports).mockRejectedValue(new Error('down'));
    renderTab();
    expect(await screen.findByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
