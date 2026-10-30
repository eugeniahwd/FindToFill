import React from 'react';
import { LucideIcon, Search } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Search,
  title,
  message,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 bg-white rounded-2xl border border-slate-100 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Icon size={28} aria-hidden="true" />
      </div>
      <h3 className="text-base font-bold text-navy mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-slate-500 max-w-xs mb-4 leading-relaxed">
        {message}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="min-touch-target px-4 py-2 bg-[#FFD233] text-[#011638] font-semibold text-sm rounded-xl shadow-xs hover:bg-[#ffe066] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
