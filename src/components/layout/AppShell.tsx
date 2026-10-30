'use client';

import React from 'react';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-100 w-full overflow-x-hidden">
      {/* Phone container constrained to max-w-md (390px-448px) and centered */}
      <div className="w-full max-w-md mx-auto min-h-[100dvh] bg-page-tint flex flex-col relative shadow-md pb-24 min-w-0">
        {/* Content Area */}
        <main className="flex-1 flex flex-col w-full min-w-0">{children}</main>

        {/* Global Bottom Navigation */}
        <BottomNav />
      </div>
    </div>
  );
};
