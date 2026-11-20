'use client';

import React from 'react';
import { useLocation } from '@/context/LocationContext';
import { BottomSheet } from '../common/BottomSheet';

/** Bottom sheet listing the pilot stations; opened through setShowStationPicker on any page. */
export const StationPickerSheet: React.FC = () => {
  const { stations, selectedStation, selectStation, showStationPicker, setShowStationPicker } = useLocation();

  return (
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
  );
};
