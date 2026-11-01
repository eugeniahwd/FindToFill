'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { WifiOff } from 'lucide-react';
import { Station } from '@/lib/types';
import { stationService } from '@/lib/services/stationService';
import { findNearestStation } from '@/lib/utils/geo';
import { EmptyState } from '@/components/common/EmptyState';
import { ListSkeleton } from '@/components/common/LoadingSkeleton';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationContextValue {
  coords: Coordinates | null;
  isLocating: boolean;
  locationError: string | null;
  /** Pilot stations from the database, sorted by name. */
  stations: Station[];
  detectedStation: Station | null;
  selectedStation: Station;
  selectStation: (station: Station) => void;
  isFarFromPilotStations: boolean;
  distanceToSelectedStationM: number | null;
  showStationPicker: boolean;
  setShowStationPicker: (show: boolean) => void;
  requestLocation: () => void;
}

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export const LocationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [detectedStation, setDetectedStation] = useState<Station | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isFarFromPilotStations, setIsFarFromPilotStations] = useState<boolean>(false);
  const [showStationPicker, setShowStationPicker] = useState<boolean>(false);

  // Load pilot stations once (and again on "Coba lagi").
  useEffect(() => {
    let isMounted = true;
    setStationsError(null);
    stationService
      .getStations()
      .then((all) => {
        if (!isMounted) return;
        const pilots = all.filter((s) => s.isPilot);
        setStations(pilots);
        setSelectedStation((current) => current ?? pilots[0] ?? null);
        if (pilots.length === 0) setStationsError('Belum ada data stasiun uji coba.');
      })
      .catch(() => {
        if (isMounted) setStationsError('Data stasiun belum bisa dimuat. Periksa koneksi lalu coba lagi.');
      });
    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  // GPS is only used here to pick the nearest station; it is never sent to the server.
  const resolvePosition = useCallback(
    (latitude: number, longitude: number) => {
      setCoords({ latitude, longitude });
      setLocationError(null);

      const match = findNearestStation(latitude, longitude, stations);
      if (match) {
        setDetectedStation(match.station);
        setSelectedStation(match.station);
        setIsFarFromPilotStations(!match.isWithinRadius);
      }
      setIsLocating(false);
    },
    [stations],
  );

  const requestLocation = useCallback(() => {
    setIsLocating(true);
    setLocationError(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setIsLocating(false);
      setShowStationPicker(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolvePosition(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.warn('Geolocation error or denied:', error.message);
        setLocationError(
          error.code === 1
            ? 'Akses lokasi ditolak. Silakan pilih stasiun secara manual.'
            : 'Gagal mendeteksi lokasi otomatis.'
        );
        setIsLocating(false);
        // If permission denied or unavailable, show bottom sheet to pick manually
        setShowStationPicker(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, [resolvePosition]);

  // Detect the nearest station as soon as the station list is available.
  const hasStations = stations.length > 0;
  useEffect(() => {
    if (hasStations) requestLocation();
  }, [hasStations, requestLocation]);

  const selectStation = (station: Station) => {
    setSelectedStation(station);
    setShowStationPicker(false);
  };

  if (!selectedStation) {
    return (
      <StationsLoadingGate error={stationsError} onRetry={() => setLoadAttempt((n) => n + 1)} />
    );
  }

  const distanceToSelectedStationM = coords
    ? findNearestStation(coords.latitude, coords.longitude, [selectedStation])?.distanceMeters ?? null
    : null;

  return (
    <LocationContext.Provider
      value={{
        coords,
        isLocating,
        locationError,
        stations,
        detectedStation,
        selectedStation,
        selectStation,
        isFarFromPilotStations,
        distanceToSelectedStationM,
        showStationPicker,
        setShowStationPicker,
        requestLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

/** Shown until the station list loads (e.g. a paused free-tier database shows the retry state). */
const StationsLoadingGate: React.FC<{ error: string | null; onRetry: () => void }> = ({ error, onRetry }) => (
  <main className="min-h-dvh flex flex-col justify-center p-4 max-w-md mx-auto w-full">
    {error ? (
      <EmptyState
        icon={WifiOff}
        title="Tidak Dapat Memuat Stasiun"
        message={error}
        actionLabel="Coba lagi"
        onAction={onRetry}
      />
    ) : (
      <div role="status" aria-label="Memuat data stasiun">
        <ListSkeleton count={3} />
      </div>
    )}
  </main>
);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
