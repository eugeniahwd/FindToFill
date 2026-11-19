'use client';

import React from 'react';

export interface ChipOption {
  value: string;
  label: string;
}

interface AdminChipsProps {
  label: string;
  options: ChipOption[];
  /** null = "Semua" (no filter) when `allLabel` is given. */
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
}

/** Horizontal, scrollable single-choice chips for the admin filters. */
export function AdminChips({ label, options, value, onChange, allLabel }: AdminChipsProps) {
  const all = allLabel ? [{ value: '', label: allLabel }, ...options] : options;
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
      {all.map((option) => {
        const selected = (value ?? '') === option.value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value || null)}
            className={`min-touch-target px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
              selected ? 'bg-[#011638] text-white border-[#011638]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
