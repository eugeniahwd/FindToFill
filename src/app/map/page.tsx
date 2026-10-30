'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapView } from '@/components/map/MapView';
import { FilterChips, FilterValue } from '@/components/common/FilterChips';
import { FacilityCard } from '@/components/facility/FacilityCard';
import { useLocation } from '@/context/LocationContext';
import { stationService } from '@/lib/services/stationService';
import { Station, FacilityWithStatus } from '@/lib/types';
import { MapPin, ChevronUp, List } from 'lucide-react';

export default function MapPage() {
  const { selectedStation, selectStation, coords } = useLocation();

  const [stations, setStations] = useState<Station[]>([]);
  const [facilities, setFacilities] = useState<FacilityWithStatus[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);

  useEffect(() => {
    async function loadData() {
      const allStations = await stationService.getStations();
      setStations(allStations);

      const allFacs = await stationService.getStationFacilities(
        selectedStation.id,
        coords
      );
      setFacilities(allFacs);
    }
    loadData();
  }, [selectedStation.id, coords]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      if (filter === 'water') return fac.type === 'water';
      if (filter === 'charging') return fac.type === 'charging';
      if (filter === 'available') return fac.currentStatus === 'available';
      return true;
    });
  }, [facilities, filter]);

  return (
    <div className="flex-1 flex flex-col relative h-[calc(100dvh-4.5rem)] overflow-hidden">
      {/* Top Floating Controls */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-2">
        {/* Station Selector Bar */}
        <div className="flex items-center justify-between bg-white/95 backdrop-blur-sm px-3.5 py-2.5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={18} className="text-[#00628C] shrink-0" />
            <span className="font-bold text-xs sm:text-sm text-navy truncate">
              Stasiun {selectedStation.name}
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {stations.map((st) => (
              <button
                key={st.id}
                onClick={() => selectStation(st)}
                className={`min-touch-target px-2.5 py-1 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                  st.id === selectedStation.id
                    ? 'bg-[#011638] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {st.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Pills Floating */}
        <div className="bg-white/90 backdrop-blur-sm p-1 rounded-2xl shadow-sm border border-slate-200/60">
          <FilterChips selected={filter} onChange={setFilter} />
        </div>
      </div>

      {/* Full Screen Map View */}
      <div className="flex-1 w-full h-full">
        <MapView
          center={[selectedStation.latitude, selectedStation.longitude]}
          zoom={16}
          stations={stations}
          facilities={filteredFacilities}
          userCoords={coords}
          onSelectFacility={() => {
            setIsSheetExpanded(true);
          }}
          onSelectStation={(st) => selectStation(st)}
          className="w-full h-full"
        />
      </div>

      {/* Slide-Up Bottom Sheet Drawer with Facility List */}
      <div
        className={`absolute left-0 right-0 bottom-0 z-30 bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 transition-all duration-300 flex flex-col ${
          isSheetExpanded ? 'h-[65vh]' : 'h-24'
        }`}
      >
        {/* Drag Handle & Toggle Header */}
        <button
          onClick={() => setIsSheetExpanded((prev) => !prev)}
          className="min-touch-target w-full pt-2.5 pb-2 px-4 flex flex-col items-center justify-center shrink-0 hover:bg-slate-50 transition-colors"
          aria-label={isSheetExpanded ? 'Kecilkan daftar' : 'Buka daftar fasilitas'}
        >
          <div className="w-10 h-1.5 rounded-full bg-slate-300 mb-2" />
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-bold text-navy flex items-center gap-1.5">
              <List size={16} className="text-[#00628C]" />
              Fasilitas di Stasiun {selectedStation.name} ({filteredFacilities.length})
            </span>
            <span className="text-[11px] font-semibold text-[#00628C] flex items-center gap-0.5">
              {isSheetExpanded ? 'Tutup' : 'Lihat Semua'}
              <ChevronUp
                size={16}
                className={`transition-transform duration-300 ${
                  isSheetExpanded ? 'rotate-180' : ''
                }`}
              />
            </span>
          </div>
        </button>

        {/* Scrollable Facility List */}
        <div className="flex-1 overflow-y-auto p-4 pt-1 flex flex-col gap-3">
          {filteredFacilities.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </div>
      </div>
    </div>
  );
}
