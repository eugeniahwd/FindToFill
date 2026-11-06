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
  /** Draw the KRL Commuter Line tracks in their line colours. */
  showKrlLines?: boolean;
  /** Open a Leaflet popup on facility click. Turn off when the page shows its own detail view. */
  showFacilityPopups?: boolean;
  scrollWheelZoom?: boolean;
  /** Rounded corners for card-style maps; full-screen maps turn this off. */
  rounded?: boolean;
  /**
   * Corner for the zoom buttons and OSM attribution. Full-screen maps with a floating header
   * and chatbot button use 'bottomleft' so neither is covered.
   */
  controlsPosition?: 'default' | 'bottomleft';
  className?: string;
}

const MARKER_BASE_STYLE =
  'width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
const DROPLET_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>';
const BOLT_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';

const FacilitySummary: React.FC<{ facility: FacilityWithStatus }> = ({ facility }) => (
  <div className="min-w-[160px] flex flex-col gap-1.5">
    <div className="font-bold text-xs text-navy leading-snug">{facility.name}</div>
    <div className="text-[11px] text-slate-500 whitespace-normal">
      {facility.locationDetail || facility.platform}
    </div>
    <div className="pt-1 flex items-center justify-between gap-2">
      <StatusBadge status={facility.currentStatus} size="sm" />
      {facility.distanceMeters !== undefined && (
        <span className="text-[11px] font-bold text-[#00628C]">
          {formatDistance(facility.distanceMeters)}
        </span>
      )}
    </div>
  </div>
);

// Internal leaflet component that executes strictly on client
const LeafletInnerMap = dynamic(
  () =>
    Promise.all([import('react-leaflet'), import('@/lib/map/krlGeometry')]).then(
      ([mod, krl]) => {
        const {
          MapContainer,
          TileLayer,
          Marker,
          Popup,
          Tooltip,
          CircleMarker,
          Polyline,
          ZoomControl,
          AttributionControl,
          useMap,
        } = mod;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const L = require('leaflet') as typeof import('leaflet');
        const krlLayers = krl.getKrlLineLayers();

        // Water: navy circle + droplet. Charging: yellow circle + lightning (UI_SPEC).
        const waterIcon = L.divIcon({
          className: 'custom-water-marker',
          html: `<div style="${MARKER_BASE_STYLE}background-color:#011638;color:#ffffff;">${DROPLET_SVG}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
          tooltipAnchor: [0, -18],
        });
        const chargingIcon = L.divIcon({
          className: 'custom-charging-marker',
          html: `<div style="${MARKER_BASE_STYLE}background-color:#FFD233;color:#011638;">${BOLT_SVG}</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -18],
          tooltipAnchor: [0, -18],
        });

        // Recenter only when the target actually changes, so panning is not undone on re-render.
        const RecenterMap = ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) => {
          const map = useMap();
          useEffect(() => {
            map.setView([lat, lng], zoom);
          }, [lat, lng, zoom, map]);
          return null;
        };

        const KrlLines: React.FC = () => (
          <>
            {/* White casing first so coloured lines stay readable on the base map. */}
            {krlLayers.map((line) => (
              <Polyline
                key={`${line.id}-casing`}
                positions={line.paths}
                interactive={false}
                pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
              />
            ))}
            {krlLayers.map((line) => (
              <Polyline
                key={line.id}
                positions={line.paths}
                pathOptions={{ color: line.color, weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              >
                <Tooltip sticky>
                  <span className="text-xs font-bold" style={{ color: line.color }}>
                    {line.name}
                  </span>
                </Tooltip>
              </Polyline>
            ))}
          </>
        );

        const InnerMap: React.FC<MapViewProps> = ({
          center,
          zoom = 16,
          facilities = [],
          userCoords,
          onSelectFacility,
          stations = [],
          onSelectStation,
          showKrlLines = false,
          showFacilityPopups = true,
          scrollWheelZoom = false,
          rounded = true,
          controlsPosition = 'default',
        }) => (
          <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={scrollWheelZoom}
            zoomControl={controlsPosition === 'default'}
            attributionControl={controlsPosition === 'default'}
            className={`w-full h-full ${rounded ? 'rounded-2xl' : ''}`}
          >
            {controlsPosition === 'bottomleft' && (
              <>
                <ZoomControl position="bottomleft" />
                <AttributionControl position="bottomleft" />
              </>
            )}
            <RecenterMap lat={center[0]} lng={center[1]} zoom={zoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showKrlLines && <KrlLines />}

            {/* Blue dot for User Location */}
            {userCoords && (
              <CircleMarker
                center={[userCoords.latitude, userCoords.longitude]}
                radius={8}
                pathOptions={{ fillColor: '#00628C', fillOpacity: 1, color: '#ffffff', weight: 2 }}
              >
                <Popup>
                  <div className="text-xs font-bold text-navy">Lokasi Anda</div>
                </Popup>
              </CircleMarker>
            )}

            {/* Station markers */}
            {stations.map((st) => (
              <CircleMarker
                key={st.id}
                center={[st.latitude, st.longitude]}
                radius={12}
                pathOptions={{ fillColor: '#011638', fillOpacity: 0.15, color: '#011638', weight: 2 }}
                eventHandlers={{ click: () => onSelectStation?.(st) }}
              >
                <Tooltip direction="top" offset={[0, -10]}>
                  <span className="text-xs font-bold text-navy">Stasiun {st.name}</span>
                </Tooltip>
              </CircleMarker>
            ))}

            {/* Facility markers: hover shows a summary, click opens the detail view */}
            {facilities.map((fac) => (
              <Marker
                key={fac.id}
                position={[fac.latitude, fac.longitude]}
                icon={fac.type === 'water' ? waterIcon : chargingIcon}
                title={fac.name}
                eventHandlers={{ click: () => onSelectFacility?.(fac) }}
              >
                <Tooltip direction="top" className="facility-tooltip">
                  <FacilitySummary facility={fac} />
                </Tooltip>
                {showFacilityPopups && (
                  <Popup>
                    <div className="p-1">
                      <FacilitySummary facility={fac} />
                    </div>
                  </Popup>
                )}
              </Marker>
            ))}
          </MapContainer>
        );

        return InnerMap;
      },
    ),
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
