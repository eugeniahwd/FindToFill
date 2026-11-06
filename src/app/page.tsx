'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Loader2, AlertCircle, Info } from 'lucide-react';
import { StationHeader } from '@/components/layout/StationHeader';
import { FacilityCard } from '@/components/facility/FacilityCard';
import { MapView } from '@/components/map/MapView';
import { BottomSheet } from '@/components/common/BottomSheet';
import { useLocation } from '@/context/LocationContext';
import { stationService } from '@/lib/services/stationService';
import { FacilityWithStatus } from '@/lib/types';

type LoadState = 'loading' | 'ready' | 'error';

const HOME_MAP_ZOOM = 18;

export default function HomePage() {
  const { stations, selectedStation, selectStation, coords } = useLocation();

  const [facilities, setFacilities] = useState<FacilityWithStatus[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedFacility, setSelectedFacility] = useState<FacilityWithStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoadState('loading');
    stationService
      .getStationFacilities(selectedStation.id, coords)
      .then((data) => {
        if (!isMounted) return;
        setFacilities(data);
        setLoadState('ready');
      })
      .catch(() => {
        if (isMounted) setLoadState('error');
      });
    return () => {
      isMounted = false;
    };
  }, [selectedStation.id, coords, loadAttempt]);

  const retry = useCallback(() => setLoadAttempt((n) => n + 1), []);

  return (
    <div className="fixed inset-0 z-0 w-full max-w-md mx-auto map-under-nav">
      {/* Full-screen map with KRL lines, pilot stations, and facility markers */}
      <MapView
        center={[selectedStation.latitude, selectedStation.longitude]}
        zoom={HOME_MAP_ZOOM}
        facilities={facilities}
        stations={stations}
        userCoords={coords}
        onSelectFacility={setSelectedFacility}
        onSelectStation={selectStation}
        showKrlLines
        showFacilityPopups={false}
        scrollWheelZoom
        rounded={false}
        controlsPosition="bottomleft"
        className="h-full w-full"
      />

      {/* Floating station card on top of the map */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-col gap-2 pt-[env(safe-area-inset-top)]">
        <StationHeader />
        <FacilityLoadStatus state={loadState} isEmpty={facilities.length === 0} onRetry={retry} />
      </div>

      {/* Facility detail, opened by clicking a marker */}
      <BottomSheet
        isOpen={selectedFacility !== null}
        onClose={() => setSelectedFacility(null)}
        title={selectedFacility?.name ?? ''}
        description={`Stasiun ${selectedStation.name}`}
      >
        {selectedFacility && (
          <div className="flex flex-col gap-3">
            <FacilityCard facility={selectedFacility} className="border-slate-200" />
            <a
              href={`/stations/${selectedFacility.stationId}`}
              className="min-touch-target flex items-center justify-center gap-1 rounded-xl border border-slate-200 text-sm font-semibold text-[#00628C] hover:bg-slate-50"
            >
              <span>Lihat denah & detail stasiun</span>
              <ChevronRight size={16} aria-hidden="true" />
            </a>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

interface FacilityLoadStatusProps {
  state: LoadState;
  isEmpty: boolean;
  onRetry: () => void;
}

/** Small pill under the station card for loading, error, and empty states. */
const FacilityLoadStatus: React.FC<FacilityLoadStatusProps> = ({ state, isEmpty, onRetry }) => {
  const pill = 'self-start flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 shadow-md text-xs font-medium';

  if (state === 'loading') {
    return (
      <div role="status" className={`${pill} text-slate-600`}>
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        <span>Memuat fasilitas…</span>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div role="alert" className={`${pill} text-[#BA1A1A]`}>
        <AlertCircle size={14} aria-hidden="true" />
        <span>Fasilitas belum bisa dimuat.</span>
        <button type="button" onClick={onRetry} className="min-touch-target -my-3 px-1 font-bold text-[#00628C] underline">
          Coba lagi
        </button>
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div role="status" className={`${pill} text-slate-600`}>
        <Info size={14} aria-hidden="true" />
        <span>Belum ada fasilitas di stasiun ini.</span>
      </div>
    );
  }
  return null;
};
