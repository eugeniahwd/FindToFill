import React from 'react';

export const FacilityCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs animate-pulse flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded-md w-3/4" />
            <div className="h-3 bg-slate-100 rounded-md w-1/2" />
          </div>
        </div>
        <div className="w-20 h-6 bg-slate-200 rounded-full shrink-0" />
      </div>

      <div className="h-3 bg-slate-100 rounded-md w-2/3" />

      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        <div className="h-4 bg-slate-200 rounded-md w-24" />
        <div className="h-8 bg-slate-200 rounded-xl w-20" />
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <FacilityCardSkeleton key={i} />
      ))}
    </div>
  );
};
