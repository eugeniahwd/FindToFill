import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewSheet } from '@/components/review/ReviewSheet';
import { ToastProvider } from '@/context/ToastContext';
import { reviewService } from '@/lib/services/reviewService';
import type { FacilityWithStatus, Review } from '@/lib/types';

jest.mock('@/lib/services/reviewService', () => ({ reviewService: { submitReview: jest.fn() } }));

const facility = (id: string, type: 'water' | 'charging', name: string) =>
  ({ id, type, name, stationId: 's1', latitude: 0, longitude: 0, isActive: true }) as FacilityWithStatus;

const facilities = [
  facility('c1', 'charging', 'Charging Corner'),
  facility('w1', 'water', 'Water Station A'),
  facility('w2', 'water', 'Water Station B'),
];
const myReview: Review = { id: 'rev-1', facilityId: 'w2', userId: 'u1', rating: 2, comment: 'Airnya hangat', createdAt: 'now' };

function renderSheet(props: Partial<React.ComponentProps<typeof ReviewSheet>> = {}) {
  const onSaved = jest.fn();
  render(
    <ToastProvider>
      <ReviewSheet
        title="Ulasan"
        facilities={facilities}
        myReviews={[myReview]}
        onClose={jest.fn()}
        onSaved={onSaved}
        {...props}
      />
    </ToastProvider>,
  );
  return { onSaved };
}

describe('ReviewSheet', () => {
  it('lists water facilities first and marks the ones the user already reviewed', () => {
    renderSheet();
    const options = screen.getAllByRole('radio', { name: /Station|Corner/ });
    expect(options.map((o) => o.textContent)).toEqual([
      'Water Station A',
      'Water Station BSudah diulas',
      'Charging Corner',
    ]);
  });

  it('starts as a new review for an unreviewed facility', () => {
    renderSheet();
    expect(screen.getByRole('button', { name: 'Kirim Ulasan' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ulasan Anda/)).toHaveValue('');
  });

  it('prefills the review and shows "Perbarui Ulasan" when an already reviewed facility is picked', async () => {
    renderSheet();
    await userEvent.click(screen.getByRole('radio', { name: /Water Station B/ }));

    expect(screen.getByLabelText(/Ulasan Anda/)).toHaveValue('Airnya hangat');
    expect(screen.getByRole('radio', { name: '2 bintang' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Perbarui Ulasan' })).toBeInTheDocument();
  });

  it('opens straight on the facility from the Edit button', () => {
    renderSheet({ initialFacilityId: 'w2' });
    expect(screen.getByRole('radio', { name: /Water Station B/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Perbarui Ulasan' })).toBeInTheDocument();
  });

  it('shows the stamp toast with an icon instead of an emoji', async () => {
    jest.mocked(reviewService.submitReview).mockResolvedValue({
      review: { ...myReview, id: 'rev-2', facilityId: 'w1' },
      created: true,
      stampAwarded: true,
    });
    const { onSaved } = renderSheet();
    await userEvent.type(screen.getByLabelText(/Ulasan Anda/), 'Segar');
    await userEvent.click(screen.getByRole('button', { name: 'Kirim Ulasan' }));

    expect(await screen.findByText('Ulasan terkirim! Stamp fasilitas diperoleh.')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });
});
