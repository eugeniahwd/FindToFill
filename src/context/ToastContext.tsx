'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container pinned to top of mobile screen */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50 pointer-events-none flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const bgClass =
            toast.type === 'success'
              ? 'bg-[#E8F5E9] border-[#2E7D32]/30 text-[#2E7D32]'
              : toast.type === 'error'
              ? 'bg-[#FDECEA] border-[#BA1A1A]/30 text-[#BA1A1A]'
              : 'bg-[#FFF8D6] border-[#FFD233]/40 text-[#011638]';

          const Icon =
            toast.type === 'success'
              ? CheckCircle2
              : toast.type === 'error'
              ? AlertCircle
              : Info;

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-md transition-all ${bgClass}`}
            >
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <Icon size={18} className="shrink-0" />
                <span>{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="Tutup notifikasi"
                className="p-1 rounded-full hover:bg-black/5 min-w-[32px] min-h-[32px] flex items-center justify-center shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
