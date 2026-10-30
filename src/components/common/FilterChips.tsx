'use client';

import React from 'react';
import { Droplet, Zap, CheckCircle2, Sparkles } from 'lucide-react';

export type FilterValue = 'all' | 'water' | 'charging' | 'available';

interface FilterChipsProps {
  selected: FilterValue;
  onChange: (value: FilterValue) => void;
  className?: string;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  selected,
  onChange,
  className = '',
}) => {
  const options: { id: FilterValue; label: string; icon: React.ReactNode }[] = [
    {
      id: 'all',
      label: 'All',
      icon: <Sparkles size={16} aria-hidden="true" />,
    },
    {
      id: 'water',
      label: 'Water Refill',
      icon: <Droplet size={16} className="text-[#00628C]" aria-hidden="true" />,
    },
    {
      id: 'charging',
      label: 'Charging',
      icon: <Zap size={16} className="text-[#9A6700]" aria-hidden="true" />,
    },
    {
      id: 'available',
      label: 'Available Only',
      icon: <CheckCircle2 size={16} className="text-[#2E7D32]" aria-hidden="true" />,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Filter fasilitas"
      className={`flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 ${className}`}
    >
      {options.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(opt.id)}
            className={`min-touch-target whitespace-nowrap px-3.5 py-2 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors border shrink-0 ${
              isSelected
                ? 'bg-[#011638] text-white border-[#011638] shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
