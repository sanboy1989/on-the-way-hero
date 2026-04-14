'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { Mission } from '@/types/mission';

// ── Leaflet needs window — load only on client, never SSR ────────────────────
const MissionMap = dynamic(() => import('./MissionMap'), {
  ssr:     false,
  loading: () => <MapLoadingScreen />,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  orange:  '#FF8C00',
  darkGray: '#333333',
  pickup:  '#22C55E',
  dropoff: '#3B82F6',
  cardBg:  '#1E1E1E',
  border:  '#2E2E2E',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function centsToCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeUntilDeadline(deadline: Date): string {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

// ─── Mock data (replace with Firestore query) ─────────────────────────────────

const MOCK_MISSIONS: Mission[] = [
  {
    id:             'msn_001',
    buyerId:        'user_abc',
    heroId:         null,
    title:          'IKEA KALLAX Shelf (White 4x4)',
    description:    'Found a great deal on Marketplace. Seller is in NE, I live in NW.',
    itemPhotoUrl:   null,
    marketplaceUrl: null,
    itemPrice:      8000,
    deliveryFee:    2500,
    platformFee:    125,
    heroEarning:    2375,
    pickupAddress:  'Taradale, NE Calgary, AB',
    pickupCoords:   { latitude: 51.1315, longitude: -113.9375 },
    dropoffAddress: 'Dalhousie, NW Calgary, AB',
    dropoffCoords:  { latitude: 51.1018, longitude: -114.1633 },
    pickupDeadline: new Date(Date.now() + 4 * 3_600_000),
    distanceKm:     18.4,
    status:         'Open',
    createdAt:      new Date(Date.now() - 30 * 60_000),
  },
  {
    id:             'msn_002',
    buyerId:        'user_def',
    heroId:         null,
    title:          'Dyson V8 Vacuum (Refurbished)',
    description:    'Seller in SE, need delivery to SW.',
    itemPhotoUrl:   null,
    marketplaceUrl: null,
    itemPrice:      18000,
    deliveryFee:    3000,
    platformFee:    150,
    heroEarning:    2850,
    pickupAddress:  'Mahogany, SE Calgary, AB',
    pickupCoords:   { latitude: 50.8939, longitude: -113.9672 },
    dropoffAddress: 'Marda Loop, SW Calgary, AB',
    dropoffCoords:  { latitude: 51.0278, longitude: -114.1022 },
    pickupDeadline: new Date(Date.now() + 2 * 3_600_000),
    distanceKm:     22.1,
    status:         'Open',
    createdAt:      new Date(Date.now() - 15 * 60_000),
  },
  {
    id:             'msn_003',
    buyerId:        'user_ghi',
    heroId:         null,
    title:          'Nintendo Switch OLED Bundle',
    description:    'Seller requires cash. Hero must advance $320. High value — bonus included.',
    itemPhotoUrl:   null,
    marketplaceUrl: null,
    itemPrice:      32000,
    deliveryFee:    4500,
    platformFee:    225,
    heroEarning:    4275,
    pickupAddress:  'Skyview Ranch, NE Calgary, AB',
    pickupCoords:   { latitude: 51.1499, longitude: -113.9607 },
    dropoffAddress: 'Tuscany, NW Calgary, AB',
    dropoffCoords:  { latitude: 51.1082, longitude: -114.2187 },
    pickupDeadline: new Date(Date.now() + 6 * 3_600_000),
    distanceKm:     25.3,
    status:         'Open',
    createdAt:      new Date(Date.now() - 5 * 60_000),
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MapLoadingScreen() {
  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ backgroundColor: '#1a1a2e' }}
    >
      <div className="text-center">
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
          style={{
            borderColor: `${COLORS.orange} transparent ${COLORS.orange} ${COLORS.orange}`,
          }}
        />
        <p className="text-sm text-gray-400">Loading map…</p>
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: 'map' | 'list';
  onChange: (v: 'map' | 'list') => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full p-1"
      style={{ backgroundColor: COLORS.border }}
    >
      {(['map', 'list'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
          style={{
            backgroundColor: view === v ? COLORS.orange : 'transparent',
            color:            view === v ? '#fff' : '#aaa',
          }}
        >
          {v === 'map' ? '🗺 Map' : '☰ List'}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Mission['status'] }) {
  const config: Record<Mission['status'], { label: string; color: string }> = {
    Open:      { label: 'Open',      color: '#22C55E' },
    Accepted:  { label: 'Accepted',  color: '#3B82F6' },
    PickedUp:  { label: 'Picked Up', color: '#A855F7' },
    Delivered: { label: 'Delivered', color: '#EAB308' },
    Completed: { label: 'Completed', color: '#6B7280' },
    Cancelled: { label: 'Cancelled', color: '#EF4444' },
    Disputed:  { label: 'Disputed',  color: '#F97316' },
  };
  const { label, color } = config[status];
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: `${color}22`,
        color,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}

function MissionCard({
  mission,
  isSelected,
  onSelect,
  onAccept,
}: {
  mission:    Mission;
  isSelected: boolean;
  onSelect:   () => void;
  onAccept:   (m: Mission) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="rounded-xl p-4 cursor-pointer transition-all duration-200 select-none"
      style={{
        backgroundColor: isSelected ? '#2a1a00' : COLORS.cardBg,
        border:    `1px solid ${isSelected ? COLORS.orange : COLORS.border}`,
        boxShadow: isSelected ? `0 0 0 1px ${COLORS.orange}44` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-white text-sm leading-tight flex-1">
          {mission.title}
        </h3>
        <StatusBadge status={mission.status} />
      </div>

      {/* Route */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: COLORS.pickup }}
          />
          <span className="text-gray-300 truncate">{mission.pickupAddress}</span>
        </div>
        <div className="ml-1 w-px h-3 bg-gray-600" />
        <div className="flex items-center gap-2 text-xs">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: COLORS.dropoff }}
          />
          <span className="text-gray-300 truncate">{mission.dropoffAddress}</span>
        </div>
      </div>

      {/* Distance + Deadline */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
        <span>📍 {mission.distanceKm} km</span>
        <span>⏰ {timeUntilDeadline(mission.pickupDeadline)}</span>
      </div>

      {/* Financials */}
      <div
        className="rounded-lg p-3 mb-3 space-y-1.5"
        style={{ backgroundColor: '#0d0d0d', border: `1px solid ${COLORS.border}` }}
      >
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">You advance upfront</span>
          <span className="font-bold text-red-400">{centsToCAD(mission.itemPrice)}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Delivery fee offered</span>
          <span className="text-gray-300">{centsToCAD(mission.deliveryFee)}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400">Platform fee (5%)</span>
          <span className="text-gray-500">− {centsToCAD(mission.platformFee)}</span>
        </div>
        <div
          className="border-t pt-1.5 flex justify-between items-center"
          style={{ borderColor: COLORS.border }}
        >
          <span className="text-xs font-semibold text-gray-300">
            You earn after delivery
          </span>
          <span
            className="text-sm font-extrabold"
            style={{ color: COLORS.orange }}
          >
            {centsToCAD(mission.heroEarning)}
          </span>
        </div>
      </div>

      {/* Accept button */}
      {mission.status === 'Open' && (
        <button
          onClick={(e) => { e.stopPropagation(); onAccept(mission); }}
          className="w-full py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: COLORS.orange }}
        >
          Accept Mission
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MissionExplorer() {
  const [view, setView]                 = useState<'map' | 'list'>('map');
  const [missions]                      = useState<Mission[]>(MOCK_MISSIONS);
  const [selectedMission, setSelected]  = useState<Mission | null>(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false); // collapsed by default on mobile

  const handleAccept = useCallback((mission: Mission) => {
    // TODO: call Firebase Function completeMission(missionId)
    alert(
      `Mission accepted!\n\nYou advance: ${centsToCAD(mission.itemPrice)}\nYou earn: ${centsToCAD(mission.heroEarning)} after delivery.`,
    );
  }, []);

  return (
    <div
      className="flex flex-col h-screen w-full"
      style={{ backgroundColor: COLORS.darkGray, color: '#fff' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: '#1a1a1a', borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl font-black" style={{ color: COLORS.orange }}>
            On The Way
          </span>
          <span className="text-xl font-black text-white">Hero</span>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </header>

      {/* ── Legend bar (map only) ───────────────────────────────────────── */}
      {view === 'map' && (
        <div
          className="flex items-center gap-4 px-4 py-2 text-xs flex-shrink-0"
          style={{ backgroundColor: '#161616', borderBottom: `1px solid ${COLORS.border}` }}
        >
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.pickup }} />
            Pickup
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.dropoff }} />
            Drop-off
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5" style={{ backgroundColor: COLORS.orange }} />
            Route
          </span>
          <span className="ml-auto text-gray-600 text-xs">© OpenStreetMap</span>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map view */}
        {view === 'map' && (
          <div className="flex-1 relative overflow-hidden">

            {/* Full-bleed map */}
            <MissionMap
              missions={missions}
              selectedMission={selectedMission}
              onSelect={(m) => { setSelected(m); setSidebarOpen(true); }}
            />

            {/* ── Floating toggle button ─────────────────────────────────── */}
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="absolute bottom-6 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: COLORS.orange }}
            >
              {sidebarOpen ? (
                <>
                  <span>✕</span>
                  <span>Hide List</span>
                </>
              ) : (
                <>
                  <span>☰</span>
                  <span>{missions.length} Missions</span>
                </>
              )}
            </button>

            {/* ── Slide-up mission list panel (overlay on mobile) ────────── */}
            {sidebarOpen && (
              <div
                className="absolute bottom-0 left-0 right-0 z-[999] flex flex-col rounded-t-2xl overflow-hidden"
                style={{
                  backgroundColor: '#161616',
                  borderTop: `1px solid ${COLORS.border}`,
                  maxHeight: '60vh',
                }}
              >
                {/* Drag handle + header */}
                <div
                  className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-pointer"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className="mx-auto w-10 h-1 rounded-full bg-gray-600 mb-1 absolute left-1/2 -translate-x-1/2 top-2" />
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-1">
                    {missions.length} Open Mission{missions.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-500 text-sm">✕</span>
                </div>

                {/* Scrollable cards */}
                <div className="overflow-y-auto px-3 py-3 space-y-3">
                  {missions.map((m) => (
                    <MissionCard
                      key={m.id}
                      mission={m}
                      isSelected={selectedMission?.id === m.id}
                      onSelect={() => setSelected(m)}
                      onAccept={handleAccept}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {missions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-semibold">No open missions nearby</p>
                <p className="text-sm mt-1">Check back soon!</p>
              </div>
            ) : (
              missions.map((m) => (
                <MissionCard
                  key={m.id}
                  mission={m}
                  isSelected={selectedMission?.id === m.id}
                  onSelect={() => setSelected(m)}
                  onAccept={handleAccept}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
