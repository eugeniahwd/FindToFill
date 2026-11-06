'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { House, Map, Stamp, User, type LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  /** Path prefix that marks this item active (defaults to href). */
  matchPath?: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: House },
  { label: 'Maps', href: '/map', icon: Map },
  { label: 'Stamp', href: '/community?tab=stamps', matchPath: '/community', icon: Stamp },
  { label: 'Profile', href: '/profile', icon: User },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  const path = item.matchPath ?? item.href;
  return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  // The report form is a focused flow with its own back button.
  if (pathname.startsWith('/report')) return null;

  return (
    <nav
      aria-label="Navigasi Utama"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg"
    >
      <div className="w-full max-w-md mx-auto h-[var(--bottom-nav-height)] pb-[env(safe-area-inset-bottom)] flex items-center justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(item, pathname);
          const Icon = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`min-touch-target flex flex-col items-center justify-center py-1 px-4 rounded-2xl transition-all ${
                isActive
                  ? 'bg-[#FFD233] text-[#011638] font-bold shadow-xs'
                  : 'text-slate-500 hover:text-navy'
              }`}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              <span className="text-[11px] tracking-tight mt-0.5">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
