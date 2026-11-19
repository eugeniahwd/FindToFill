'use client';

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { BottomSheet } from '../common/BottomSheet';

interface ConfirmSheetProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Asks before a Remove or delete. There is no undo, so every destructive admin action goes through this. */
export function ConfirmSheet({ title, message, confirmLabel, onConfirm, onClose }: ConfirmSheetProps) {
  const [isWorking, setIsWorking] = useState(false);

  const confirm = async () => {
    setIsWorking(true);
    try {
      await onConfirm();
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-touch-target flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={isWorking}
            className="min-touch-target flex-1 py-2.5 rounded-xl bg-[#BA1A1A] text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span>{isWorking ? 'Memproses...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
