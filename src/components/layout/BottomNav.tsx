'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Home, Map, MessageSquareText, Award, User } from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Map', href: '/map', icon: Map },
  { label: 'Chatbot', href: '/chatbot', icon: MessageSquareText },
  { label: 'Stamps', href: '/community', icon: Award },
  { label: 'Profile', href: '/profile', icon: User },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  // Hide bottom nav on full forms like /report/[id] if preferred, or keep consistently
  const isReportPage = pathname.startsWith('/report');

  if (isReportPage) {
    return null;
  }

  return (
    <nav
      aria-label="Navigasi Utama"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg safe-bottom"
    >
      <div className="w-full max-w-md mx-auto flex items-center justify-around px-2 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          const Icon = item.icon;

          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`min-touch-target flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                isActive
                  ? 'bg-[#FFD233] text-[#011638] font-bold shadow-xs'
                  : 'text-slate-500 hover:text-navy'
              }`}
            >
              <Icon size={20} className="shrink-0" />
              <span className="text-[11px] tracking-tight mt-0.5">
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
