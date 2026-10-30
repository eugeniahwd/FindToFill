'use client';

import React, { useState } from 'react';
import { Droplet, Zap, Compass } from 'lucide-react';
import { FacilityWithStatus, StationLayout } from '@/lib/types';
import { StatusBadge } from '../common/StatusBadge';
import { BottomSheet } from '../common/BottomSheet';
import { formatTimeAgo } from '@/lib/utils/status';

interface StationLayoutMapProps {
  stationName: string;
  layouts: StationLayout[];
  facilities: FacilityWithStatus[];
}

export const StationLayoutMap: React.FC<StationLayoutMapProps> = ({
  stationName,
  layouts,
  facilities,
}) => {
  const [activeLevelIndex, setActiveLevelIndex] = useState(0);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithStatus | null>(null);

  const currentLayout = layouts[activeLevelIndex] || layouts[0];

  // Filter facilities on this level (or show all if level matching is loose)
  const currentLevelFacilities = facilities.filter((f) => {
    if (!currentLayout) return true;
    if (!f.level) return true;
    return (
      f.level.toLowerCase().includes(currentLayout.level.toLowerCase().slice(0, 2)) ||
      currentLayout.level.toLowerCase().includes(f.level.toLowerCase().slice(0, 2))
    );
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Level Tabs */}
      {layouts.length > 1 && (
        <div
          role="tablist"
          aria-label="Pilihan Lantai Denah"
          className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl"
        >
          {layouts.map((layout, idx) => {
            const isActive = idx === activeLevelIndex;
            return (
              <button
                key={layout.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveLevelIndex(idx)}
                className={`min-touch-target flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-navy shadow-xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                {layout.level}
              </button>
            );
          })}
        </div>
      )}

      {/* Schematic Floor Plan Canvas */}
      <div className="relative w-full aspect-[4/3] bg-slate-50 border-2 border-slate-200 rounded-2xl overflow-hidden p-3 shadow-inner">
        {/* Compass / Orientation */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 backdrop-blur-xs">
          <Compass size={12} className="text-[#00628C]" />
          <span>Utara ▲</span>
        </div>

        {/* Floor Schematic Drawing (Divs & Blocks representing station layout) */}
        <div className="w-full h-full relative rounded-xl border border-dashed border-slate-300 p-2 bg-[#f4f7f6]">
          {/* Platform tracks / blocks */}
          <div className="absolute top-8 left-4 right-4 h-10 bg-slate-200/80 rounded-lg flex items-center justify-between px-3 text-[10px] font-bold text-slate-600">
            <span>◄ Jalur 1 & 2 (Peron Arah Bogor)</span>
            <span className="px-1.5 py-0.5 rounded bg-white/80 text-slate-500 text-[9px]">Platform</span>
          </div>

          <div className="absolute top-24 left-4 right-4 h-14 bg-white/90 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-center px-4">
            <span className="text-[11px] font-bold text-navy">Concourse {stationName} • Area Transit</span>
            <span className="text-[9px] text-slate-400">Eskalator • Lift Prioritas • Tap In/Out</span>
          </div>

          <div className="absolute bottom-8 left-4 right-4 h-10 bg-slate-200/80 rounded-lg flex items-center justify-between px-3 text-[10px] font-bold text-slate-600">
            <span>Jalur 3 & 4 (Peron Arah Jakarta Kota) ►</span>
            <span className="px-1.5 py-0.5 rounded bg-white/80 text-slate-500 text-[9px]">Platform</span>
          </div>

          {/* Exits indicators */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 px-1.5 py-1 bg-teal/10 border border-teal/30 rounded text-[9px] font-bold text-[#00628C]">
            Pintu Barat
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-1 bg-teal/10 border border-teal/30 rounded text-[9px] font-bold text-[#00628C]">
            Pintu Timur
          </div>

          {/* Interactive Facility Markers positioned with layoutX and layoutY */}
          {currentLevelFacilities.map((fac) => {
            const isWater = fac.type === 'water';
            const left = `${fac.layoutX ?? 50}%`;
            const top = `${fac.layoutY ?? 50}%`;

            return (
              <button
                key={fac.id}
                onClick={() => setSelectedFacility(fac)}
                style={{ left, top }}
                aria-label={`${fac.name} (${fac.type})`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 active:scale-95 ${
                  isWater ? 'bg-[#011638] text-white' : 'bg-[#FFD233] text-[#011638]'
                }`}
              >
                {isWater ? (
                  <Droplet size={15} />
                ) : (
                  <Zap size={15} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend & Layout Notes */}
      <div className="flex items-center justify-between px-2 py-1 bg-white rounded-xl border border-slate-100 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className="w-3.5 h-3.5 rounded-full bg-[#011638] flex items-center justify-center text-white text-[9px]">
              💧
            </span>
            <span>Water</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className="w-3.5 h-3.5 rounded-full bg-[#FFD233] flex items-center justify-center text-[#011638] text-[9px]">
              ⚡
            </span>
            <span>Charging</span>
          </div>
        </div>

        <span className="text-[11px] text-slate-400">
          Ketuk pin fasilitas untuk detail
        </span>
      </div>

      {/* Selected Marker Detail Sheet */}
      {selectedFacility && (
        <BottomSheet
          isOpen={!!selectedFacility}
          onClose={() => setSelectedFacility(null)}
          title={selectedFacility.name}
          description={selectedFacility.locationDetail || selectedFacility.platform}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <StatusBadge status={selectedFacility.currentStatus} />
              <span className="text-xs text-slate-500">
                {formatTimeAgo(selectedFacility.lastReportedAt)}
              </span>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {selectedFacility.locationDetail || 'Lokasi berada di lantai peron stasiun.'}
            </p>

            <div className="flex gap-2 pt-2">
              <a
                href={`/report/${selectedFacility.id}`}
                className="min-touch-target flex-1 py-2 px-3 bg-[#FFD233] text-[#011638] text-xs font-bold rounded-xl text-center flex items-center justify-center"
              >
                Laporkan Kondisi
              </a>
              <button
                onClick={() => setSelectedFacility(null)}
                className="min-touch-target px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
};
