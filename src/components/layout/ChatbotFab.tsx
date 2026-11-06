'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';

/** Pages with their own fixed bottom button need the chatbot button lifted above it. */
const RAISED_PATH_PREFIXES = ['/stations/'];

function bottomOffset(pathname: string): string {
  if (pathname.startsWith('/report')) return '1rem'; // no bottom nav on the report form
  if (RAISED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return 'calc(var(--bottom-nav-height) + 5rem)';
  }
  return 'calc(var(--bottom-nav-height) + 1rem)';
}

/** Floating chatbot entry point, fixed on screen on every page except the chatbot itself. */
export const ChatbotFab: React.FC = () => {
  const pathname = usePathname();
  if (pathname.startsWith('/chatbot')) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 pointer-events-none"
      style={{ bottom: bottomOffset(pathname) }}
    >
      <div className="w-full max-w-md mx-auto flex justify-end px-4">
        <a
          href="/chatbot"
          aria-label="Buka AI Asisten Chatbot"
          className="pointer-events-auto w-14 h-14 rounded-full bg-[#011638] text-white shadow-xl border-2 border-white flex items-center justify-center hover:bg-[#002255] active:scale-95 transition-all"
        >
          <span className="w-9 h-9 rounded-full bg-[#FFD233] text-[#011638] flex items-center justify-center">
            <MessageSquareText size={20} aria-hidden="true" />
          </span>
        </a>
      </div>
    </div>
  );
};
