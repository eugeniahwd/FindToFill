import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EffectiveStatus } from '@/lib/types';

describe('StatusBadge Component', () => {
  const statuses: { status: EffectiveStatus; expectedText: string }[] = [
    { status: 'available', expectedText: 'Available' },
    { status: 'empty', expectedText: 'Empty' },
    { status: 'broken', expectedText: 'Broken' },
    { status: 'under_maintenance', expectedText: 'Under Maintenance' },
    { status: 'unknown', expectedText: 'No recent report' },
  ];

  statuses.forEach(({ status, expectedText }) => {
    it(`renders correct text, role, and accessible label for "${status}"`, () => {
      render(<StatusBadge status={status} />);
      const badge = screen.getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(expectedText);
      expect(badge).toHaveAttribute('aria-label', `Status: ${expectedText}`);
    });
  });
});
