'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import type { LoadState } from './useAdminList';

interface ListStatesProps {
  state: LoadState;
  isEmpty: boolean;
  emptyText: string;
  onRetry: () => void;
  children: React.ReactNode;
}

/** Loading, error (with retry), and empty states shared by the admin lists. */
export function ListStates({ state, isEmpty, emptyText, onRetry, children }: ListStatesProps) {
  if (state === 'loading') {
    return <p className="text-xs text-slate-500 text-center py-6">Memuat data...</p>;
  }
  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <p className="text-xs text-slate-600">Data gagal dimuat. Server atau database mungkin sedang tidak tersedia.</p>
        <button
          type="button"
          onClick={onRetry}
          className="min-touch-target px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5"
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Coba lagi</span>
        </button>
      </div>
    );
  }
  if (isEmpty) return <p className="text-xs text-slate-500 text-center py-6">{emptyText}</p>;
  return <>{children}</>;
}
