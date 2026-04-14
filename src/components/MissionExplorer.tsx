'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore }              from '@/store/authStore';
import { useMissions, seedMissions } from '@/hooks/useMissions';
import { useActiveMission }          from '@/hooks/useActiveMission';
import UserProfile                   from '@/components/UserProfile';
import PostMissionForm               from '@/components/PostMissionForm';
import AcceptConfirmSheet            from '@/components/AcceptConfirmSheet';
import ActiveMissionSheet            from '@/components/ActiveMissionSheet';
import type { Mission }              from '@/types/mission';

// ── Leaflet needs window — load only on client, never SSR ────────────────────
const MissionMap = dynamic(() => import('./MissionMap'), {
  ssr:     false,
  loading: () => <MapLoadingScreen />,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  primary:  'var(--color-primary)',
  darkGray: '#333333',
  pickup:   '#22C55E',
  dropoff:  '#3B82F6',
  cardBg:   '#1E1E1E',
  border:   '#2E2E2E',
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function MapLoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#1a1a2e' }}>
      <div className="text-center">
        <div
          className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: `${COLORS.primary} transparent ${COLORS.primary} ${COLORS.primary}` }}
        />
        <p className="text-sm text-gray-400">Loading map…</p>
      </div>
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: 'map' | 'list'; onChange: (v: 'map' | 'list') => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full p-1" style={{ backgroundColor: COLORS.border }}>
      {(['map', 'list'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
          style={{
            backgroundColor: view === v ? COLORS.primary : 'transparent',
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
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}44` }}
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
  currentUserId,
  hasActiveMission,
}: {
  mission:          Mission;
  isSelected:       boolean;
  onSelect:         () => void;
  onAccept:         (m: Mission) => void;
  currentUserId:    string | null;
  hasActiveMission: boolean;
}) {
  const isOwnMission  = currentUserId === mission.buyerId;
  const canAccept     = mission.status === 'Open' && !isOwnMission && !hasActiveMission;
  const blockedReason = mission.status === 'Open' && !isOwnMission && hasActiveMission;

  return (
    <div
      onClick={onSelect}
      className="rounded-xl p-4 cursor-pointer transition-all duration-200 select-none"
      style={{
        backgroundColor: isSelected ? '#2a1a00' : COLORS.cardBg,
        border:    `1px solid ${isSelected ? COLORS.primary : COLORS.border}`,
        boxShadow: isSelected ? `0 0 0 1px ${COLORS.primary}44` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-white text-sm leading-tight flex-1">{mission.title}</h3>
        <StatusBadge status={mission.status} />
      </div>

      {/* Route */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS.pickup }} />
          <span className="text-gray-300 truncate">{mission.pickupAddress}</span>
        </div>
        <div className="ml-1 w-px h-3 bg-gray-600" />
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS.dropoff }} />
          <span className="text-gray-300 truncate">{mission.dropoffAddress}</span>
        </div>
      </div>

      {/* Distance + Deadline + Delivery time */}
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3 flex-wrap">
        <span>📍 {mission.distanceKm} km</span>
        <span>⏰ {timeUntilDeadline(mission.pickupDeadline)}</span>
        {mission.expectedDeliveryTime && (
          <span style={{ color: '#EAB308' }}>
            🕐 by {mission.expectedDeliveryTime.toLocaleString('en-CA', {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            })}
          </span>
        )}
      </div>

      {/* Marketplace link */}
      {mission.marketplaceUrl && (
        <a
          href={mission.marketplaceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs font-semibold mb-3"
          style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
        >
          <span>🔗</span> View item listing
        </a>
      )}

      {/* Financials */}
      <div className="rounded-lg p-3 mb-3 space-y-1.5" style={{ backgroundColor: '#0d0d0d', border: `1px solid ${COLORS.border}` }}>
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
        <div className="border-t pt-1.5 flex justify-between items-center" style={{ borderColor: COLORS.border }}>
          <span className="text-xs font-semibold text-gray-300">You earn after delivery</span>
          <span className="text-sm font-extrabold" style={{ color: COLORS.primary }}>
            {centsToCAD(mission.heroEarning)}
          </span>
        </div>
      </div>

      {/* Accept button / states */}
      {canAccept && (
        <button
          onClick={(e) => { e.stopPropagation(); onAccept(mission); }}
          className="w-full py-2 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-75"
          style={{ backgroundColor: COLORS.primary }}
        >
          Accept Mission
        </button>
      )}
      {isOwnMission && mission.status === 'Open' && (
        <p className="text-center text-xs text-gray-600 mt-1">Your posted mission</p>
      )}
      {blockedReason && (
        <p className="text-center text-xs text-gray-600 mt-1">Complete your active mission first</p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MissionExplorer() {
  const [view, setView]                   = useState<'map' | 'list'>('map');
  const [selectedMission, setSelected]    = useState<Mission | null>(null);
  const [sidebarOpen, setSidebarOpen]     = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showPostForm, setShowPostForm]   = useState(false);
  const [confirmMission, setConfirm]      = useState<Mission | null>(null);
  const [showActive, setShowActive]       = useState(false);
  const [seeding, setSeeding]             = useState(false);

  const { user }                          = useAuthStore();
  const { missions, loading, error }      = useMissions();
  const activeMission                     = useActiveMission(user?.uid ?? null);

  async function handleSeed() {
    setSeeding(true);
    try { await seedMissions(); } finally { setSeeding(false); }
  }

  const cardProps = (m: Mission) => ({
    mission:          m,
    isSelected:       selectedMission?.id === m.id,
    onSelect:         () => setSelected(m),
    onAccept:         (mission: Mission) => setConfirm(mission),
    currentUserId:    user?.uid ?? null,
    hasActiveMission: !!activeMission,
  });

  return (
    <div className="flex flex-col h-screen w-full" style={{ backgroundColor: COLORS.darkGray, color: '#fff' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 gap-3"
        style={{ backgroundColor: '#1a1a1a', borderBottom: `1px solid ${COLORS.border}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/apple-touch-icon.png" alt="OTW Hero" width={36} height={36} style={{ borderRadius: 9, flexShrink: 0 }} />
        <ViewToggle view={view} onChange={setView} />
        {user && (
          <button
            onClick={() => setShowProfile(true)}
            style={{
              background: 'none', border: `2px solid ${COLORS.border}`, borderRadius: '50%',
              padding: 0, cursor: 'pointer', width: 36, height: 36, overflow: 'hidden',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {user.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt={user.displayName ?? 'User'} width={36} height={36} style={{ display: 'block', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: 18, color: '#aaa' }}>👤</span>
            )}
          </button>
        )}
      </header>

      {/* ── Active Mission Banner ───────────────────────────────────────── */}
      {activeMission && (
        <button
          onClick={() => setShowActive(true)}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '10px 16px',
            background:     'var(--color-primary)',
            border:         'none',
            cursor:         'pointer',
            flexShrink:     0,
            width:          '100%',
            textAlign:      'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🏍️</span>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 12, margin: 0 }}>ACTIVE MISSION</p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeMission.title}
              </p>
            </div>
          </div>
          <span style={{ color: '#fff', fontSize: 18, fontWeight: 300 }}>›</span>
        </button>
      )}

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
            <span className="inline-block w-6 h-0.5" style={{ backgroundColor: COLORS.primary }} />
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
            <MissionMap
              missions={missions}
              selectedMission={selectedMission}
              onSelect={(m) => { setSelected(m); setSidebarOpen(true); }}
            />

            {/* Floating missions toggle */}
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="absolute bottom-6 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all active:scale-95"
              style={{ backgroundColor: COLORS.primary }}
            >
              {sidebarOpen ? (
                <><span>✕</span><span>Hide List</span></>
              ) : (
                <><span>☰</span><span>{loading ? '…' : `${missions.length} Missions`}</span></>
              )}
            </button>

            {/* Slide-up panel */}
            {sidebarOpen && (
              <div
                className="absolute bottom-0 left-0 right-0 z-[999] flex flex-col rounded-t-2xl overflow-hidden"
                style={{ backgroundColor: '#161616', borderTop: `1px solid ${COLORS.border}`, maxHeight: '60vh' }}
              >
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
                <div className="overflow-y-auto px-3 py-3 space-y-3">
                  {missions.map((m) => <MissionCard key={m.id} {...cardProps(m)} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: `${COLORS.primary} transparent ${COLORS.primary} ${COLORS.primary}` }} />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <p className="text-2xl mb-2">⚠️</p>
                <p className="text-red-400 text-sm font-semibold">Failed to load missions</p>
                <p className="text-gray-600 text-xs mt-1">{error}</p>
              </div>
            ) : missions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-semibold">No open missions nearby</p>
                <p className="text-sm mt-1 mb-4">Check back soon!</p>
                <button
                  onClick={handleSeed}
                  disabled={seeding}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white opacity-70 hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  {seeding ? 'Adding…' : '+ Seed test missions'}
                </button>
              </div>
            ) : (
              missions.map((m) => <MissionCard key={m.id} {...cardProps(m)} />)
            )}
          </div>
        )}
      </div>

      {/* ── Post Mission FAB ────────────────────────────────────────────── */}
      {user && (
        <button
          onClick={() => setShowPostForm(true)}
          style={{
            position: 'fixed', bottom: 24, left: 16, zIndex: 1000,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 9999,
            background: COLORS.primary, color: '#fff',
            fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
          <span>Post</span>
        </button>
      )}

      {/* ── Overlays ────────────────────────────────────────────────────── */}
      {showProfile && user && (
        <UserProfile user={user} onClose={() => setShowProfile(false)} />
      )}
      {showPostForm && (
        <PostMissionForm onClose={() => setShowPostForm(false)} />
      )}
      {confirmMission && user && (
        <AcceptConfirmSheet
          mission={confirmMission}
          heroId={user.uid}
          onClose={() => setConfirm(null)}
        />
      )}
      {showActive && activeMission && (
        <ActiveMissionSheet
          mission={activeMission}
          onClose={() => setShowActive(false)}
        />
      )}
    </div>
  );
}
