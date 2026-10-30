'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { FacilityWithStatus, Station } from '@/lib/types';
import { StatusBadge } from '../common/StatusBadge';
import { formatDistance } from '@/lib/utils/geo';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  facilities?: FacilityWithStatus[];
  userCoords?: { latitude: number; longitude: number } | null;
  onSelectFacility?: (facility: FacilityWithStatus) => void;
  stations?: Station[];
  onSelectStation?: (station: Station) => void;
  className?: string;
}

// Internal leaflet component that executes strictly on client
const LeafletInnerMap = dynamic(
  () =>
    import('react-leaflet').then((mod) => {
      const { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } = mod;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require('leaflet');

      // Create custom DivIcon for water (navy circle + droplet)
      const waterIcon = L.divIcon({
        className: 'custom-water-marker',
        html: `
          <div style="
            background-color: #011638;
            color: #ffffff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      // Create custom DivIcon for charging (yellow circle + lightning)
      const chargingIcon = L.divIcon({
        className: 'custom-charging-marker',
        html: `
          <div style="
            background-color: #FFD233;
            color: #011638;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      // Recenter helper component
      const RecenterMap = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
        const map = useMap();
        useEffect(() => {
          map.setView(center, zoom);
        }, [center, zoom, map]);
        return null;
      };

      const InnerMap: React.FC<MapViewProps> = ({
        center,
        zoom = 16,
        facilities = [],
        userCoords,
        onSelectFacility,
        stations = [],
        onSelectStation,
      }) => {
        return (
          <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={false}
            className="w-full h-full rounded-2xl"
          >
            <RecenterMap center={center} zoom={zoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Blue dot for User Location */}
            {userCoords && (
              <CircleMarker
                center={[userCoords.latitude, userCoords.longitude]}
                radius={8}
                pathOptions={{
                  fillColor: '#00628C',
                  fillOpacity: 1,
                  color: '#ffffff',
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-xs font-bold text-navy">Lokasi Anda</div>
                </Popup>
              </CircleMarker>
            )}

            {/* Station center markers if provided */}
            {stations.map((st) => (
              <CircleMarker
                key={st.id}
                center={[st.latitude, st.longitude]}
                radius={12}
                pathOptions={{
                  fillColor: '#011638',
                  fillOpacity: 0.15,
                  color: '#011638',
                  weight: 2,
                }}
                eventHandlers={{
                  click: () => onSelectStation && onSelectStation(st),
                }}
              >
                <Popup>
                  <div className="text-xs font-bold text-navy">
                    Stasiun {st.name}
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Facility Markers */}
            {facilities.map((fac) => {
              const icon = fac.type === 'water' ? waterIcon : chargingIcon;
              return (
                <Marker
                  key={fac.id}
                  position={[fac.latitude, fac.longitude]}
                  icon={icon}
                  eventHandlers={{
                    click: () => onSelectFacility && onSelectFacility(fac),
                  }}
                >
                  <Popup>
                    <div className="p-1 min-w-[160px] flex flex-col gap-1.5">
                      <div className="font-bold text-xs text-navy leading-snug">
                        {fac.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {fac.locationDetail || fac.platform}
                      </div>
                      <div className="pt-1 flex items-center justify-between">
                        <StatusBadge status={fac.currentStatus} size="sm" />
                        {fac.distanceMeters !== undefined && (
                          <span className="text-[11px] font-bold text-[#00628C]">
                            {formatDistance(fac.distanceMeters)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        );
      };

      return InnerMap;
    }),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[220px] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs font-medium animate-pulse">
        Memuat Peta...
      </div>
    ),
  }
);

export const MapView: React.FC<MapViewProps> = (props) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={`w-full min-h-[200px] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs ${props.className || ''}`}>
        Memuat Peta...
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden ${props.className || 'h-48'}`}>
      <LeafletInnerMap {...props} />
    </div>
  );
};
