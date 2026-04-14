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

// ── Leaflet: client-only ──────────────────────────────────────────────────────

const MissionMap = dynamic(() => import('./MissionMap'), {
  ssr:     false,
  loading: () => (
    <div style={{ height: '100%', width: '100%', background: '#e8ecef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#999' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
        <p style={{ fontSize: 13, margin: 0 }}>Loading map…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function centsToCAD(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

function timeUntilDeadline(deadline: Date): string {
  const diff = deadline.getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m left` : `${mins}m left`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Mission['status'] }) {
  const cfg: Record<Mission['status'], { label: string; color: string }> = {
    Open:      { label: 'Open',      color: '#22C55E' },
    Accepted:  { label: 'Accepted',  color: '#3B82F6' },
    PickedUp:  { label: 'Picked Up', color: '#A855F7' },
    Delivered: { label: 'Delivered', color: '#EAB308' },
    Completed: { label: 'Completed', color: '#6B7280' },
    Cancelled: { label: 'Cancelled', color: '#EF4444' },
    Disputed:  { label: 'Disputed',  color: '#F97316' },
  };
  const { label, color } = cfg[status];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${color}22`, color, border: `1px solid ${color}44` }}>
      {label}
    </span>
  );
}

// ── Mission card ──────────────────────────────────────────────────────────────

function MissionCard({
  mission, isSelected, onSelect, onAccept, currentUserId, hasActiveMission,
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
      style={{
        background:   isSelected ? '#2a1a00' : '#1E1E1E',
        border:       `1px solid ${isSelected ? 'var(--color-primary)' : '#2E2E2E'}`,
        borderRadius: 16,
        padding:      16,
        marginBottom: 12,
        cursor:       'pointer',
        boxShadow:    isSelected ? `0 0 0 1px var(--color-primary)44` : '0 1px 4px rgba(0,0,0,0.08)',
        transition:   'all 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <h3 style={{ fontWeight: 700, color: '#fff', fontSize: 14, lineHeight: 1.3, flex: 1, margin: 0 }}>{mission.title}</h3>
        <StatusBadge status={mission.status} />
      </div>

      {/* Route */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#aaa', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.pickupAddress}</span>
        </div>
        <div style={{ marginLeft: 4, width: 2, height: 10, background: '#333', marginBottom: 6 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#aaa', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.dropoffAddress}</span>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#666', marginBottom: 10, flexWrap: 'wrap' }}>
        <span>📍 {mission.distanceKm} km</span>
        <span>⏰ {timeUntilDeadline(mission.pickupDeadline)}</span>
        {mission.expectedDeliveryTime && (
          <span style={{ color: '#EAB308' }}>
            🕐 by {mission.expectedDeliveryTime.toLocaleString('en-CA', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
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
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'none', marginBottom: 10 }}
        >
          <span>🔗</span> View item listing
        </a>
      )}

      {/* Financials */}
      <div style={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#777' }}>You advance upfront</span>
          <span style={{ color: '#f87171', fontWeight: 700 }}>{centsToCAD(mission.itemPrice)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#777' }}>Delivery fee</span>
          <span style={{ color: '#aaa' }}>{centsToCAD(mission.deliveryFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: '#777' }}>Platform fee (5%)</span>
          <span style={{ color: '#555' }}>− {centsToCAD(mission.platformFee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, paddingTop: 8, borderTop: '1px solid #2a2a2a' }}>
          <span style={{ color: '#ccc' }}>You earn</span>
          <span style={{ color: 'var(--color-primary)' }}>{centsToCAD(mission.heroEarning)}</span>
        </div>
      </div>

      {/* CTA */}
      {canAccept && (
        <button
          onClick={(e) => { e.stopPropagation(); onAccept(mission); }}
          style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Accept Mission
        </button>
      )}
      {isOwnMission && mission.status === 'Open' && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#555', margin: '4px 0 0' }}>Your posted mission</p>
      )}
      {blockedReason && (
        <p style={{ textAlign: 'center', fontSize: 12, color: '#555', margin: '4px 0 0' }}>Complete your active mission first</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MissionExplorer() {
  const [view,           setView]      = useState<'map' | 'list'>('map');
  const [selectedMission, setSelected] = useState<Mission | null>(null);
  const [showProfile,    setShowProfile]   = useState(false);
  const [showPostForm,   setShowPostForm]  = useState(false);
  const [confirmMission, setConfirm]       = useState<Mission | null>(null);
  const [showActive,     setShowActive]    = useState(false);
  const [seeding,        setSeeding]       = useState(false);

  const { user }                     = useAuthStore();
  const { missions, loading, error } = useMissions();
  const activeMission                = useActiveMission(user?.uid ?? null);

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

  // Layout constants
  const HEADER_TOP  = 16;
  const HEADER_H    = 58;
  const BANNER_H    = activeMission ? 54 : 0;
  const LIST_TOP    = HEADER_TOP + HEADER_H + 8 + BANNER_H + (BANNER_H > 0 ? 8 : 0);

  return (
    <div style={{ position: 'relative', height: '100dvh', overflow: 'hidden', background: '#e8ecef' }}>

      {/* ── Full-screen map ──────────────────────────────────────────── */}
      {view === 'map' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <MissionMap
            missions={missions}
            selectedMission={selectedMission}
            onSelect={(m) => setSelected(m)}
          />
        </div>
      )}

      {/* ── List view ────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div
          style={{
            position:   'absolute',
            inset:      0,
            background: '#f0f0f0',
            overflowY:  'auto',
            paddingTop: LIST_TOP,
            paddingBottom: 100,
            paddingLeft:  14,
            paddingRight: 14,
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontSize: 28, margin: '0 0 8px' }}>⚠️</p>
              <p style={{ color: '#ef4444', fontSize: 14, fontWeight: 600 }}>Failed to load missions</p>
              <p style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{error}</p>
            </div>
          ) : missions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
              <p style={{ fontSize: 36, margin: '0 0 10px' }}>📭</p>
              <p style={{ fontWeight: 600, fontSize: 14 }}>No open missions nearby</p>
              <p style={{ fontSize: 13, marginTop: 4, marginBottom: 20 }}>Check back soon!</p>
              <button
                onClick={handleSeed}
                disabled={seeding}
                style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: seeding ? 0.7 : 1 }}
              >
                {seeding ? 'Adding…' : '+ Seed test missions'}
              </button>
            </div>
          ) : (
            missions.map((m) => <MissionCard key={m.id} {...cardProps(m)} />)
          )}
        </div>
      )}

      {/* ── Floating header ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top:      HEADER_TOP,
          left:     14,
          right:    14,
          zIndex:   2000,
        }}
      >
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            gap:            10,
            background:     'rgba(255,255,255,0.96)',
            borderRadius:   999,
            padding:        '10px 10px 10px 14px',
            boxShadow:      '0 4px 24px rgba(0,0,0,0.13)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/apple-touch-icon.png"
            alt="OTW Hero"
            width={34}
            height={34}
            style={{ borderRadius: 9, flexShrink: 0 }}
          />

          {/* Map / List toggle */}
          <div
            style={{
              flex:         1,
              display:      'flex',
              background:   '#efefef',
              borderRadius: 999,
              padding:      3,
            }}
          >
            {(['map', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  flex:         1,
                  padding:      '7px 0',
                  borderRadius: 999,
                  border:       'none',
                  background:   view === v ? '#fff' : 'transparent',
                  color:        view === v ? '#111' : '#999',
                  fontWeight:   view === v ? 700 : 500,
                  fontSize:     13,
                  cursor:       'pointer',
                  transition:   'all 0.15s',
                  boxShadow:    view === v ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                {v === 'map' ? 'Map' : 'List'}
              </button>
            ))}
          </div>

          {/* Avatar */}
          <button
            onClick={() => setShowProfile(true)}
            style={{
              width:        38,
              height:       38,
              borderRadius: '50%',
              overflow:     'hidden',
              flexShrink:   0,
              border:       'none',
              padding:      0,
              cursor:       'pointer',
              background:   '#ddd',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
            }}
          >
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt={user.displayName ?? 'User'} width={38} height={38} style={{ display: 'block' }} />
            ) : (
              <span style={{ fontSize: 18, color: '#aaa' }}>👤</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Active mission banner ─────────────────────────────────────── */}
      {activeMission && (
        <button
          onClick={() => setShowActive(true)}
          style={{
            position:       'absolute',
            top:            HEADER_TOP + HEADER_H + 8,
            left:           14,
            right:          14,
            zIndex:         1999,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '10px 16px',
            background:     'var(--color-primary)',
            borderRadius:   14,
            border:         'none',
            cursor:         'pointer',
            boxShadow:      '0 4px 16px rgba(0,0,0,0.2)',
            textAlign:      'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🏍️</span>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, margin: 0 }}>ACTIVE MISSION</p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, margin: 0, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeMission.title}
              </p>
            </div>
          </div>
          <span style={{ color: '#fff', fontSize: 20, fontWeight: 300 }}>›</span>
        </button>
      )}

      {/* ── Bottom bar + FAB (map view) ───────────────────────────────── */}
      {view === 'map' && (
        <div
          style={{
            position:   'absolute',
            bottom:     28,
            left:       14,
            right:      14,
            zIndex:     1999,
            display:    'flex',
            alignItems: 'center',
            gap:        12,
          }}
        >
          {/* Info pill */}
          <button
            onClick={() => setView('list')}
            style={{
              flex:           1,
              background:     'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(10px)',
              borderRadius:   999,
              padding:        '15px 20px',
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              boxShadow:      '0 4px 24px rgba(0,0,0,0.15)',
              border:         'none',
              cursor:         'pointer',
              textAlign:      'left',
            }}
          >
            <span style={{ color: '#bbb', fontSize: 16, lineHeight: 1 }}>⌃</span>
            <span style={{ color: '#333', fontSize: 13, fontWeight: 600 }}>
              {loading
                ? 'Loading…'
                : `${missions.length} mission${missions.length !== 1 ? 's' : ''} waiting nearby`}
            </span>
          </button>

          {/* FAB */}
          {user && (
            <button
              onClick={() => setShowPostForm(true)}
              style={{
                width:          56,
                height:         56,
                borderRadius:   '50%',
                background:     'var(--color-primary)',
                border:         'none',
                color:          '#fff',
                fontSize:       32,
                fontWeight:     300,
                cursor:         'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                boxShadow:      '0 4px 20px rgba(0,0,0,0.28)',
                flexShrink:     0,
                lineHeight:     1,
              }}
            >
              +
            </button>
          )}
        </div>
      )}

      {/* ── Bottom bar (list view): Back to Map + FAB ────────────────── */}
      {view === 'list' && (
        <div
          style={{
            position:   'absolute',
            bottom:     28,
            left:       14,
            right:      14,
            zIndex:     1999,
            display:    'flex',
            alignItems: 'center',
            gap:        12,
          }}
        >
          <button
            onClick={() => setView('map')}
            style={{
              flex:           1,
              background:     'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(10px)',
              borderRadius:   999,
              padding:        '15px 20px',
              display:        'flex',
              alignItems:     'center',
              gap:            10,
              boxShadow:      '0 4px 24px rgba(0,0,0,0.15)',
              border:         'none',
              cursor:         'pointer',
              textAlign:      'left',
            }}
          >
            <span style={{ color: '#bbb', fontSize: 16, lineHeight: 1 }}>⌄</span>
            <span style={{ color: '#333', fontSize: 13, fontWeight: 600 }}>Back to Map</span>
          </button>
          {user && (
            <button
              onClick={() => setShowPostForm(true)}
              style={{
                width:          56,
                height:         56,
                borderRadius:   '50%',
                background:     'var(--color-primary)',
                border:         'none',
                color:          '#fff',
                fontSize:       32,
                fontWeight:     300,
                cursor:         'pointer',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                boxShadow:      '0 4px 20px rgba(0,0,0,0.28)',
                flexShrink:     0,
                lineHeight:     1,
              }}
            >
              +
            </button>
          )}
        </div>
      )}

      {/* ── Overlays ─────────────────────────────────────────────────── */}
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
