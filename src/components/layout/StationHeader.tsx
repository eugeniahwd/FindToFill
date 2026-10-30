'use client';

import React from 'react';
import { MapPin, ChevronDown, AlertCircle } from 'lucide-react';
import { useLocation } from '@/context/LocationContext';
import { BottomSheet } from '../common/BottomSheet';
import { MOCK_STATIONS } from '@/lib/mock/data';

interface StationHeaderProps {
  className?: string;
}

export const StationHeader: React.FC<StationHeaderProps> = ({ className = '' }) => {
  const {
    selectedStation,
    selectStation,
    isFarFromPilotStations,
    locationError,
    showStationPicker,
    setShowStationPicker,
  } = useLocation();

  return (
    <>
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {/* Warning bar if user is far from pilot stations */}
        {isFarFromPilotStations && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFF8D6] text-[#011638] rounded-xl text-xs font-medium border border-[#FFD233]/40">
            <AlertCircle size={14} className="text-[#9A6700] shrink-0" />
            <span className="flex-1">
              Anda berada di luar stasiun uji coba. Menampilkan stasiun terdekat:
            </span>
          </div>
        )}

        {/* Warning if GPS is denied */}
        {locationError && !isFarFromPilotStations && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium">
            <AlertCircle size={14} className="text-slate-500 shrink-0" />
            <span className="flex-1 truncate">{locationError}</span>
          </div>
        )}

        {/* Main Station Selector Bar */}
        <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#011638]/5 flex items-center justify-center text-[#011638] shrink-0">
              <MapPin size={18} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase block">
                Current Station
              </span>
              <h2 className="text-base font-bold text-navy truncate">
                Stasiun {selectedStation.name}
              </h2>
            </div>
          </div>

          <button
            onClick={() => setShowStationPicker(true)}
            aria-label="Ganti stasiun saat ini"
            className="min-touch-target flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold transition-colors"
          >
            <span>Change</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Station Picker Bottom Sheet */}
      <BottomSheet
        isOpen={showStationPicker}
        onClose={() => setShowStationPicker(false)}
        title="Pilih Stasiun KRL"
        description="Fasilitas water dispenser dan charging station saat ini tersedia di stasiun uji coba berikut:"
      >
        <div className="flex flex-col gap-2">
          {MOCK_STATIONS.map((st) => {
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
                  <div className="font-bold text-sm text-navy">
                    Stasiun {st.name}
                  </div>
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

                {isSelected && (
                  <span className="text-xs font-bold text-[#00628C]">
                    Terpilih
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
};
