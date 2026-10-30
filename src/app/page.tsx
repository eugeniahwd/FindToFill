'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MessageSquareText, Sparkles, MapPin, ChevronRight, User } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { StationHeader } from '@/components/layout/StationHeader';
import { FilterChips, FilterValue } from '@/components/common/FilterChips';
import { FacilityCard } from '@/components/facility/FacilityCard';
import { MapView } from '@/components/map/MapView';
import { EmptyState } from '@/components/common/EmptyState';
import { FacilityCardSkeleton } from '@/components/common/LoadingSkeleton';
import { useLocation } from '@/context/LocationContext';
import { useAuth } from '@/context/AuthContext';
import { stationService } from '@/lib/services/stationService';
import { FacilityWithStatus } from '@/lib/types';

export default function HomePage() {
  const { selectedStation, coords } = useLocation();
  const { user } = useAuth();

  const [facilities, setFacilities] = useState<FacilityWithStatus[]>([]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStationFacilities() {
      setIsLoading(true);
      try {
        const data = await stationService.getStationFacilities(
          selectedStation.id,
          coords
        );
        if (isMounted) {
          // Sort by distance ascending
          const sorted = [...data].sort((a, b) => {
            const distA = a.distanceMeters ?? Infinity;
            const distB = b.distanceMeters ?? Infinity;
            return distA - distB;
          });
          setFacilities(sorted);
        }
      } catch (err) {
        console.error('Failed to load facilities', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadStationFacilities();
    return () => {
      isMounted = false;
    };
  }, [selectedStation.id, coords]);

  // Filter facilities based on selected chip
  const filteredFacilities = useMemo(() => {
    return facilities.filter((fac) => {
      if (filter === 'water') return fac.type === 'water';
      if (filter === 'charging') return fac.type === 'charging';
      if (filter === 'available') return fac.currentStatus === 'available';
      return true; // 'all'
    });
  }, [facilities, filter]);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4">
      {/* Top Bar: Logo & Profile Avatar */}
      <header className="flex items-center justify-between pt-1">
        <Logo size="sm" />
        <a
          href="/profile"
          className="min-touch-target flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          aria-label="Profil Pengguna"
        >
          <div className="w-6 h-6 rounded-full bg-[#00628C] text-white flex items-center justify-center text-xs font-bold">
            {user ? user.displayName.slice(0, 1).toUpperCase() : <User size={13} />}
          </div>
          <span className="text-xs font-semibold max-w-[80px] truncate text-navy">
            {user ? user.displayName.split(' ')[0] : 'Tamu'}
          </span>
        </a>
      </header>

      {/* Current Station Header Card */}
      <StationHeader />

      {/* Interactive Map Preview Card */}
      <section
        aria-label="Peta Stasiun"
        className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs relative"
      >
        <MapView
          center={[selectedStation.latitude, selectedStation.longitude]}
          zoom={16}
          facilities={filteredFacilities}
          userCoords={coords}
          className="h-44 w-full"
        />
        <div className="p-2.5 bg-white flex items-center justify-between border-t border-slate-100">
          <span className="text-xs font-bold text-navy flex items-center gap-1">
            <MapPin size={14} className="text-[#00628C]" />
            Area Stasiun {selectedStation.name}
          </span>
          <a
            href={`/stations/${selectedStation.id}`}
            className="min-touch-target text-xs font-semibold text-[#00628C] hover:underline flex items-center gap-0.5"
          >
            <span>Denah & Detail</span>
            <ChevronRight size={14} />
          </a>
        </div>
      </section>

      {/* Filter Chips */}
      <section aria-label="Filter Tipe Fasilitas">
        <FilterChips selected={filter} onChange={setFilter} />
      </section>

      {/* Nearest Facilities List */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy flex items-center gap-1.5">
            <Sparkles size={16} className="text-[#9A6700]" />
            <span>Nearest Facilities</span>
          </h2>
          <span className="text-[11px] font-medium text-slate-500">
            {filteredFacilities.length} fasilitas ditemukan
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <FacilityCardSkeleton />
            <FacilityCardSkeleton />
          </div>
        ) : filteredFacilities.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filteredFacilities.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Tidak Ada Fasilitas Sesuai Filter"
            message={`Belum ada fasilitas dengan status '${filter}' di Stasiun ${selectedStation.name}.`}
            actionLabel="Tampilkan Semua Fasilitas"
            onAction={() => setFilter('all')}
          />
        )}
      </section>

      {/* Floating Chatbot Assistant Button */}
      <div className="sticky bottom-20 self-end z-30 -mt-12 pointer-events-none">
        <a
          href="/chatbot"
          aria-label="Buka AI Asisten Chatbot"
          className="pointer-events-auto min-touch-target flex items-center gap-2 py-2.5 px-4 rounded-full bg-[#011638] text-white shadow-xl hover:bg-[#002255] active:scale-95 transition-all border-2 border-white"
        >
          <div className="w-6 h-6 rounded-full bg-[#FFD233] text-[#011638] flex items-center justify-center font-bold">
            <MessageSquareText size={15} />
          </div>
          <span className="text-xs font-bold">Tanya AI</span>
        </a>
      </div>
    </div>
  );
}
