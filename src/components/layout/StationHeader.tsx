'use client';

import React from 'react';
import { MapPin, RefreshCw, AlertCircle, LocateFixed } from 'lucide-react';
import { useLocation } from '@/context/LocationContext';
import { BottomSheet } from '../common/BottomSheet';

interface StationHeaderProps {
  className?: string;
}

const OUTSIDE_PILOT_NOTICE = 'Anda berada di luar stasiun uji coba. Menampilkan stasiun terdekat.';

/**
 * Floating card with the detected (or chosen) station, a round "change station" button,
 * and a notice attached underneath when the user is outside the pilot stations or GPS failed.
 */
export const StationHeader: React.FC<StationHeaderProps> = ({ className = '' }) => {
  const {
    stations,
    selectedStation,
    selectStation,
    isLocating,
    isFarFromPilotStations,
    locationError,
    showStationPicker,
    setShowStationPicker,
  } = useLocation();

  const notice = isFarFromPilotStations ? OUTSIDE_PILOT_NOTICE : locationError;
  const label = isFarFromPilotStations ? 'Nearest Station' : 'Current Station';

  return (
    <>
      <section
        aria-label="Stasiun saat ini"
        className={`bg-white rounded-2xl shadow-lg border border-slate-200/70 overflow-hidden ${className}`}
      >
        <div className="flex items-center gap-3 pl-3.5 pr-2 py-2">
          <div className="w-9 h-9 rounded-full bg-[#011638] text-white flex items-center justify-center shrink-0">
            <MapPin size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1">
              {isLocating && <LocateFixed size={11} className="animate-pulse" aria-hidden="true" />}
              {isLocating ? 'Detecting location…' : label}
            </span>
            <h1 className="text-base font-bold text-navy truncate leading-tight">
              Stasiun {selectedStation.name}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setShowStationPicker(true)}
            aria-label="Ganti stasiun"
            title="Ganti stasiun"
            className="w-11 h-11 rounded-full bg-[#00628C] text-white flex items-center justify-center shrink-0 shadow-md hover:bg-[#004e70] active:scale-95 transition-all"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </div>

        {notice && (
          <div
            role="status"
            className={`flex items-start gap-2 px-3.5 py-2 text-xs font-medium border-t ${
              isFarFromPilotStations
                ? 'bg-[#FFF8D6] text-[#011638] border-[#FFD233]/40'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            <AlertCircle
              size={14}
              className={`shrink-0 mt-px ${isFarFromPilotStations ? 'text-[#9A6700]' : 'text-slate-500'}`}
              aria-hidden="true"
            />
            <span>{notice}</span>
          </div>
        )}
      </section>

      <BottomSheet
        isOpen={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        title="Pilih Stasiun KRL"
        description="Fasilitas water dispenser dan charging station saat ini tersedia di stasiun uji coba berikut:"
      >
        <div className="flex flex-col gap-2">
          {stations.map((st) => {
            const isSelected = selectedStation.id === st.id;
            return (
              <button
                key={st.id}
                onClick={() => selectStation(st)}
                className={`min-touch-target w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'border-[#011638] bg-[#011638]/5 font-semibold text-navy'
                    : 'border-slate-100 hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-navy">Stasiun {st.name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {st.lines.map((line) => (
                      <span
                        key={line}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-[#C8E6FF] text-[#00628C] font-medium"
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </div>

                {isSelected && <span className="text-xs font-bold text-[#00628C]">Terpilih</span>}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
};
