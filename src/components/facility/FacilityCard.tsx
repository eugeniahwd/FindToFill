'use client';

import React, { useState } from 'react';
import { Droplet, Zap, Navigation, Image as ImageIcon, Flag, Clock } from 'lucide-react';
import { FacilityWithStatus } from '@/lib/types';
import { StatusBadge } from '../common/StatusBadge';
import { formatDistance } from '@/lib/utils/geo';
import { formatTimeAgo } from '@/lib/utils/status';
import { BottomSheet } from '../common/BottomSheet';

interface FacilityCardProps {
  facility: FacilityWithStatus;
  onNavigate?: (facility: FacilityWithStatus) => void;
  className?: string;
}

export const FacilityCard: React.FC<FacilityCardProps> = ({
  facility,
  onNavigate,
  className = '',
}) => {
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const isWater = facility.type === 'water';
  const Icon = isWater ? Droplet : Zap;

  const iconBg = isWater ? 'bg-[#011638] text-white' : 'bg-[#FFD233] text-[#011638]';

  return (
    <>
      <article
        className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-xs flex flex-col gap-3 transition-shadow hover:shadow-md ${className}`}
        aria-label={`Fasilitas ${facility.name}`}
      >
        {/* Header row: Icon, Name, Distance & Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs ${iconBg}`}
              aria-hidden="true"
            >
              <Icon size={20} />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-navy leading-snug truncate">
                {facility.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                {facility.locationDetail || facility.platform || 'Di dalam stasiun'}
              </p>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-end gap-1">
            <StatusBadge status={facility.currentStatus} size="sm" />
            {facility.distanceMeters !== undefined && (
              <span className="text-xs font-bold text-[#00628C]">
                {formatDistance(facility.distanceMeters)}
              </span>
            )}
          </div>
        </div>

        {/* Level and Time info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-50">
          <span className="inline-flex items-center gap-1 font-medium text-slate-600">
            {facility.level || 'L1'}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
            <Clock size={12} className="shrink-0" />
            {formatTimeAgo(facility.lastReportedAt)}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {/* Navigate button (Teal #00628C) */}
          <button
            onClick={() => {
              if (onNavigate) {
                onNavigate(facility);
              } else {
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${facility.latitude},${facility.longitude}`,
                  '_blank'
                );
              }
            }}
            className="min-touch-target flex-1 py-2 px-3 rounded-xl bg-[#00628C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs hover:bg-[#004e70] transition-colors"
          >
            <Navigation size={14} />
            <span>Navigate</span>
          </button>

          {/* View photo if present */}
          {facility.lastPhotoUrl && (
            <button
              onClick={() => setShowPhotoModal(true)}
              className="min-touch-target p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              aria-label="Lihat foto kondisi fasilitas"
            >
              <ImageIcon size={15} />
              <span className="hidden sm:inline">Foto</span>
            </button>
          )}

          {/* Report button */}
          <a
            href={`/report/${facility.id}`}
            className="min-touch-target px-3 py-2 rounded-xl bg-[#FFF8D6] hover:bg-[#ffe066] text-[#011638] text-xs font-semibold flex items-center justify-center gap-1 border border-[#FFD233]/50 transition-colors"
            aria-label="Laporkan kondisi fasilitas ini"
          >
            <Flag size={14} className="text-[#9A6700]" />
            <span>Report</span>
          </a>
        </div>
      </article>

      {/* Photo Modal */}
      {facility.lastPhotoUrl && (
        <BottomSheet
          isOpen={showPhotoModal}
          onClose={() => setShowPhotoModal(false)}
          title={`Foto: ${facility.name}`}
          description={`Dilaporkan ${formatTimeAgo(facility.lastReportedAt)}`}
        >
          <div className="flex flex-col gap-3">
            <div className="rounded-xl overflow-hidden bg-slate-100 aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={facility.lastPhotoUrl}
                alt={`Kondisi ${facility.name}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <StatusBadge status={facility.currentStatus} size="sm" />
              <span>Lokasi: {facility.locationDetail}</span>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
};
