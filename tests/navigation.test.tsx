import React from 'react';
import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/layout/BottomNav';
import { ChatbotFab } from '@/components/layout/ChatbotFab';

let mockPathname = '/';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('BottomNav', () => {
  it('shows Home, Maps, Stamp, and Profile (no Chatbot item)', () => {
    mockPathname = '/';
    render(<BottomNav />);
    const labels = screen.getAllByRole('link').map((link) => link.textContent);
    expect(labels).toEqual(['Home', 'Maps', 'Stamp', 'Profile']);
  });

  it('marks Stamp active on the community page and links to the stamp tab', () => {
    mockPathname = '/community';
    render(<BottomNav />);
    const stamp = screen.getByRole('link', { name: 'Stamp' });
    expect(stamp).toHaveAttribute('aria-current', 'page');
    expect(stamp).toHaveAttribute('href', '/community?tab=stamps');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('is hidden on the report form', () => {
    mockPathname = '/report/abc';
    const { container } = render(<BottomNav />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ChatbotFab', () => {
  it.each(['/', '/map', '/profile', '/community', '/stations/xyz', '/report/abc'])(
    'is shown on %s',
    (path) => {
      mockPathname = path;
      render(<ChatbotFab />);
      expect(screen.getByRole('link', { name: 'Buka AI Asisten Chatbot' })).toHaveAttribute('href', '/chatbot');
    },
  );

  it('is hidden on the chatbot page itself', () => {
    mockPathname = '/chatbot';
    const { container } = render(<ChatbotFab />);
    expect(container).toBeEmptyDOMElement();
  });
});
