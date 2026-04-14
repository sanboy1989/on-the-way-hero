'use client';

/**
 * MissionMap — Leaflet + OpenStreetMap (free, no API key)
 * Dark tiles: CartoDB Dark Matter (free, no key required)
 *
 * This file is always loaded with { ssr: false } from MissionExplorer
 * because Leaflet requires window/document at import time.
 */

import { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Mission } from '@/types/mission';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  orange:  '#FF8C00',
  pickup:  '#22C55E',
  dropoff: '#3B82F6',
};

const CALGARY_CENTER: [number, number] = [51.0447, -114.0719];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Compute bearing in degrees from point A to point B (lat/lng). */
function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point 55% of the way from A to B. */
function along(
  a: [number, number],
  b: [number, number],
  t = 0.55,
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Leaflet DivIcon with an orange SVG arrowhead rotated to bearing. */
function arrowIcon(deg: number): L.DivIcon {
  return L.divIcon({
    html: `
      <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"
           style="overflow:visible">
        <polygon
          points="11,1 19,20 11,15 3,20"
          fill="${COLORS.orange}"
          stroke="${COLORS.orange}"
          stroke-linejoin="round"
          transform="rotate(${deg} 11 11)"
        />
      </svg>`,
    className: '',
    iconSize:   [22, 22],
    iconAnchor: [11, 11],
  });
}

// ─── Auto-locate sub-component ────────────────────────────────────────────────

function LocateUser() {
  const map = useMap();
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 11);
      },
      () => {
        map.setView(CALGARY_CENTER, 11); // fallback: Calgary centre
      },
      { timeout: 5000 },
    );
  }, [map]);
  return null;
}

// ─── PanTo selected mission ───────────────────────────────────────────────────

function PanTo({ mission }: { mission: Mission | null }) {
  const map = useMap();
  useEffect(() => {
    if (!mission) return;
    map.panTo([
      mission.pickupCoords.latitude,
      mission.pickupCoords.longitude,
    ]);
  }, [mission, map]);
  return null;
}

// ─── Main map component ───────────────────────────────────────────────────────

interface MissionMapProps {
  missions:         Mission[];
  selectedMission:  Mission | null;
  onSelect:         (m: Mission) => void;
}

export default function MissionMap({
  missions,
  selectedMission,
  onSelect,
}: MissionMapProps) {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <MapContainer
      center={CALGARY_CENTER}
      zoom={11}
      style={{ height: '100%', width: '100%', background: '#1a1a2e' }}
      ref={mapRef}
      zoomControl={true}
    >
      {/* ── Dark tile layer (CartoDB Dark Matter — free, no key) ───────── */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={19}
      />

      {/* ── Auto-locate + pan-to ──────────────────────────────────────── */}
      <LocateUser />
      <PanTo mission={selectedMission} />

      {/* ── One layer group per mission ───────────────────────────────── */}
      {missions.map((mission) => {
        const pickup:  [number, number] = [
          mission.pickupCoords.latitude,
          mission.pickupCoords.longitude,
        ];
        const dropoff: [number, number] = [
          mission.dropoffCoords.latitude,
          mission.dropoffCoords.longitude,
        ];
        const midPt    = along(pickup, dropoff, 0.55);
        const arrowDeg = bearing(pickup, dropoff);
        const isSelected = selectedMission?.id === mission.id;

        return (
          <div key={mission.id}>
            {/* Orange polyline pickup → dropoff */}
            <Polyline
              positions={[pickup, dropoff]}
              pathOptions={{
                color:   COLORS.orange,
                weight:  isSelected ? 4 : 2.5,
                opacity: isSelected ? 1 : 0.75,
              }}
              eventHandlers={{ click: () => onSelect(mission) }}
            />

            {/* Arrowhead marker at 55% along the line */}
            <Marker
              position={midPt}
              icon={arrowIcon(arrowDeg)}
              eventHandlers={{ click: () => onSelect(mission) }}
            />

            {/* Green pickup circle */}
            <CircleMarker
              center={pickup}
              radius={9}
              pathOptions={{
                fillColor:   COLORS.pickup,
                fillOpacity: 1,
                color:       '#fff',
                weight:      2,
              }}
              eventHandlers={{ click: () => onSelect(mission) }}
            >
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
                  <strong style={{ fontSize: 13 }}>{mission.title}</strong>
                  <p style={{ fontSize: 11, color: '#555', margin: '4px 0' }}>
                    Pickup: {mission.pickupAddress}
                  </p>
                  <p style={{ fontSize: 12, margin: 0 }}>
                    Advance:{' '}
                    <span style={{ color: '#dc2626', fontWeight: 700 }}>
                      {centsToCAD(mission.itemPrice)}
                    </span>
                  </p>
                  <p style={{ fontSize: 12, margin: '2px 0 0' }}>
                    You earn:{' '}
                    <span style={{ color: COLORS.orange, fontWeight: 700 }}>
                      {centsToCAD(mission.heroEarning)}
                    </span>
                  </p>
                </div>
              </Popup>
            </CircleMarker>

            {/* Blue dropoff circle */}
            <CircleMarker
              center={dropoff}
              radius={9}
              pathOptions={{
                fillColor:   COLORS.dropoff,
                fillOpacity: 1,
                color:       '#fff',
                weight:      2,
              }}
              eventHandlers={{ click: () => onSelect(mission) }}
            >
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'sans-serif' }}>
                  <strong style={{ fontSize: 13 }}>{mission.title}</strong>
                  <p style={{ fontSize: 11, color: '#555', margin: '4px 0' }}>
                    Drop-off: {mission.dropoffAddress}
                  </p>
                  <p style={{ fontSize: 12, margin: 0 }}>
                    📍 {mission.distanceKm} km route
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        );
      })}
    </MapContainer>
  );
}
