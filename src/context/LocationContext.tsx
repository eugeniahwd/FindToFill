'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Station } from '@/lib/types';
import { MOCK_STATIONS } from '@/lib/mock/data';
import { findNearestStation } from '@/lib/utils/geo';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationContextValue {
  coords: Coordinates | null;
  isLocating: boolean;
  locationError: string | null;
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
  const [detectedStation, setDetectedStation] = useState<Station | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station>(MOCK_STATIONS[0]);
  const [isFarFromPilotStations, setIsFarFromPilotStations] = useState<boolean>(false);
  const [showStationPicker, setShowStationPicker] = useState<boolean>(false);

  const resolvePosition = useCallback((latitude: number, longitude: number) => {
    setCoords({ latitude, longitude });
    setLocationError(null);

    const match = findNearestStation(latitude, longitude, MOCK_STATIONS);
    if (match) {
      setDetectedStation(match.station);
      setSelectedStation(match.station);
      setIsFarFromPilotStations(!match.isWithinRadius);
    }
    setIsLocating(false);
  }, []);

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
        // Fallback default: Manggarai with permission denied note
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

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const selectStation = (station: Station) => {
    setSelectedStation(station);
    setShowStationPicker(false);
  };

  const distanceToSelectedStationM = coords
    ? findNearestStation(coords.latitude, coords.longitude, [selectedStation])?.distanceMeters ?? null
    : null;

  return (
    <LocationContext.Provider
      value={{
        coords,
        isLocating,
        locationError,
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

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
