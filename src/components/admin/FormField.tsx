'use client';

import React from 'react';

export const inputClass =
  'w-full min-h-[44px] px-3 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#00628C]';

interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function FormField({ id, label, hint, children }: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

/** "" -> undefined, otherwise a finite number or NaN (rejected by the form before sending). */
export function toNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  return Number(value.replace(',', '.'));
}
