'use client';

import React, { useState } from 'react';
import { Droplet, Zap, Compass, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { FacilityWithStatus, StationLayout } from '@/lib/types';
import { StatusBadge } from '../common/StatusBadge';
import { BottomSheet } from '../common/BottomSheet';
import { formatTimeAgo } from '@/lib/utils/status';

/** facilities.level defaults to 'L1' in the database. */
function facilityLevel(facility: FacilityWithStatus): string {
  return facility.level ?? 'L1';
}

export function stationLevels(layouts: StationLayout[], facilities: FacilityWithStatus[]): string[] {
  const levels = layouts.length > 0 ? layouts.map((l) => l.level) : facilities.map(facilityLevel);
  return [...new Set(levels)].sort();
}

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

  // Levels come from the layout images; until a station has any, from its facilities.
  const levels = stationLevels(layouts, facilities);
  const currentLevel = levels[activeLevelIndex] ?? levels[0];
  const currentLayout = layouts.find((l) => l.level === currentLevel);
  const levelFacilities = facilities.filter((f) => facilityLevel(f) === currentLevel);
  const placedFacilities = levelFacilities.filter((f) => f.layoutX !== undefined && f.layoutY !== undefined);
  const unplacedCount = levelFacilities.length - placedFacilities.length;

  const markers = placedFacilities.map((fac) => {
    const isWater = fac.type === 'water';
    return (
      <button
        key={fac.id}
        onClick={() => setSelectedFacility(fac)}
        style={{ left: `${fac.layoutX}%`, top: `${fac.layoutY}%` }}
        aria-label={`${fac.name} (${isWater ? 'Water' : 'Charging'})`}
        className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full flex items-center justify-center shadow-md border-2 border-white transition-transform hover:scale-110 active:scale-95 ${
          isWater ? 'bg-[#011638] text-white' : 'bg-[#FFD233] text-[#011638]'
        }`}
      >
        {isWater ? <Droplet size={16} /> : <Zap size={16} />}
      </button>
    );
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Level Tabs */}
      {levels.length > 1 && (
        <div
          role="tablist"
          aria-label="Pilihan Lantai Denah"
          className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl"
        >
          {levels.map((level, idx) => {
            const isActive = idx === activeLevelIndex;
            return (
              <button
                key={level}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveLevelIndex(idx)}
                className={`min-touch-target flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-navy shadow-xs'
                    : 'text-slate-600 hover:text-navy'
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      )}

      {currentLayout?.imageUrl ? (
        // Official layout image: markers use percentages of the image itself.
        <div className="relative w-full rounded-2xl overflow-hidden border-2 border-slate-200 bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentLayout.imageUrl}
            alt={`Denah Stasiun ${stationName} lantai ${currentLevel}`}
            className="block w-full h-auto"
          />
          {markers}
        </div>
      ) : (
      /* Schematic placeholder until the team uploads a layout image */
      <div className="relative w-full aspect-[4/3] bg-slate-50 border-2 border-slate-200 rounded-2xl overflow-hidden p-3 shadow-inner">
        {/* Compass / Orientation */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/80 px-2 py-1 rounded-md text-[10px] font-bold text-slate-500 backdrop-blur-xs">
          <Compass size={12} className="text-[#00628C]" />
          <span>Utara</span>
          <ArrowUp size={10} aria-hidden="true" />
        </div>

        {/* Floor Schematic Drawing (Divs & Blocks representing station layout) */}
        <div className="w-full h-full relative rounded-xl border border-dashed border-slate-300 p-2 bg-[#f4f7f6]">
          {/* Platform tracks / blocks */}
          <div className="absolute top-8 left-4 right-4 h-10 bg-slate-200/80 rounded-lg flex items-center justify-between px-3 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1">
              <ChevronLeft size={12} aria-hidden="true" />
              Jalur 1 & 2 (Peron Arah Bogor)
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/80 text-slate-500 text-[9px]">Platform</span>
          </div>

          <div className="absolute top-24 left-4 right-4 h-14 bg-white/90 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-center px-4">
            <span className="text-[11px] font-bold text-navy">Concourse {stationName} • Area Transit</span>
            <span className="text-[9px] text-slate-400">Eskalator • Lift Prioritas • Tap In/Out</span>
          </div>

          <div className="absolute bottom-8 left-4 right-4 h-10 bg-slate-200/80 rounded-lg flex items-center justify-between px-3 text-[10px] font-bold text-slate-600">
            <span className="flex items-center gap-1">
              Jalur 3 & 4 (Peron Arah Jakarta Kota)
              <ChevronRight size={12} aria-hidden="true" />
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/80 text-slate-500 text-[9px]">Platform</span>
          </div>

          {/* Exits indicators */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 px-1.5 py-1 bg-teal/10 border border-teal/30 rounded text-[9px] font-bold text-[#00628C]">
            Pintu Barat
          </div>
          <div className="absolute right-1 top-1/2 -translate-y-1/2 px-1.5 py-1 bg-teal/10 border border-teal/30 rounded text-[9px] font-bold text-[#00628C]">
            Pintu Timur
          </div>

          {/* Facility markers positioned with layoutX and layoutY */}
          {markers}
        </div>

        <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded-md bg-white/80 text-[9px] font-semibold text-slate-500">
          Denah ilustrasi
        </div>
      </div>
      )}

      {levelFacilities.length === 0 && (
        <p className="text-xs text-slate-500 text-center">Belum ada fasilitas di lantai ini.</p>
      )}
      {unplacedCount > 0 && (
        <p className="text-xs text-slate-500 text-center">
          {unplacedCount} fasilitas belum punya posisi di denah. Lihat di Daftar Fasilitas.
        </p>
      )}

      {/* Legend & Layout Notes */}
      <div className="flex items-center justify-between px-2 py-1 bg-white rounded-xl border border-slate-100 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className="w-4 h-4 rounded-full bg-[#011638] flex items-center justify-center text-white">
              <Droplet size={10} aria-hidden="true" />
            </span>
            <span>Water</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <span className="w-4 h-4 rounded-full bg-[#FFD233] flex items-center justify-center text-[#011638]">
              <Zap size={10} aria-hidden="true" />
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
