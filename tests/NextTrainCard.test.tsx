import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextTrainCard } from '@/components/trains/NextTrainCard';

// Thursday 2026-12-03 04:36:30 WIB
const NOW = new Date('2026-12-02T21:36:30Z');
const STORAGE_KEY = 'findtofill.nextTrain.Tebet';

describe('NextTrainCard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('shows one slide per direction with time and note', () => {
    render(<NextTrainCard stationName="Tebet" now={NOW} />);
    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByText('±2 mnt · 04.38')).toBeInTheDocument();
    expect(screen.getByText('perkiraan dari jadwal KAI')).toBeInTheDocument();
  });

  it('shows waiting text', () => {
    render(<NextTrainCard stationName="Tebet" now={NOW} />);
    const south = screen.getByRole('group', { name: 'Kereta berikutnya arah Bogor/Depok/Nambo' });
    expect(south).toHaveTextContent('di Manggarai, berangkat 05.00');
    expect(south).toHaveTextContent('±27 mnt · 05.03');
  });

  it('renders nothing for a station without timetable', () => {
    const { container } = render(<NextTrainCard stationName="Juanda" now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('dot buttons switch the slide and remember it', async () => {
    const { unmount } = render(<NextTrainCard stationName="Tebet" now={NOW} />);
    const dot = screen.getByRole('button', { name: 'Tampilkan arah Manggarai/Jakarta Kota' });
    await userEvent.click(dot);
    expect(dot).toHaveAttribute('aria-current', 'true');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('Bogor Line|Manggarai/Jakarta Kota');

    unmount();
    render(<NextTrainCard stationName="Tebet" now={NOW} />);
    expect(screen.getByRole('button', { name: 'Tampilkan arah Manggarai/Jakarta Kota' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('dot buttons are at least 44 px wide', () => {
    render(<NextTrainCard stationName="Tebet" now={NOW} />);
    for (const dot of screen.getAllByRole('button', { name: /^Tampilkan arah/ })) {
      expect(dot).toHaveClass('w-11', 'h-11');
    }
  });

  it('a train that starts here waits at the station end and then departs', () => {
    const group = () => screen.getByRole('group', { name: 'Kereta berikutnya arah Tanah Abang/Kampung Bandan' });
    // 04:30 WIB: KA 5703 (Mri-Ak) leaves Manggarai at 04.37.
    const { rerender } = render(<NextTrainCard stationName="Manggarai" now={new Date('2026-12-02T21:30:00Z')} />);
    expect(group()).toHaveTextContent('berangkat dari Manggarai');
    expect(within(group()).getByTestId('train-icon').style.left).toContain('100%');
    // 04:37:20 WIB: departing now, not arriving.
    rerender(<NextTrainCard stationName="Manggarai" now={new Date('2026-12-02T21:37:20Z')} />);
    expect(group()).toHaveTextContent('Berangkat sekarang · 04.37');
    expect(group()).not.toHaveTextContent('Tiba sekarang');
  });

  it('works when storage throws', async () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<NextTrainCard stationName="Tebet" now={NOW} />);
    expect(screen.getAllByRole('group')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Tampilkan arah Manggarai/Jakarta Kota' }));
    expect(screen.getByRole('button', { name: 'Tampilkan arah Manggarai/Jakarta Kota' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});
