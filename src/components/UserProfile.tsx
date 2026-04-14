'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useThemeStore, THEME_PRESETS } from '@/store/themeStore';
import { useMyMissions } from '@/hooks/useMyMissions';
import type { Mission } from '@/types/mission';

// ── Install-app detection ─────────────────────────────────────────────────────

type IOSNav = Navigator & { standalone?: boolean };
type DeferredPrompt = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function useInstall() {
  const [prompt,      setPrompt]      = useState<DeferredPrompt | null>(null);
  const [isIOS,       setIsIOS]       = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSTip,  setShowIOSTip]  = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as IOSNav).standalone === true;
    if (standalone) { setIsInstalled(true); return; }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) { setIsIOS(true); return; }
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as unknown as DeferredPrompt); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function triggerInstall() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setIsInstalled(true);
    setPrompt(null);
  }

  return { prompt, isIOS, isInstalled, showIOSTip, setShowIOSTip, triggerInstall };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function centsToCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Mission['status'], { label: string; color: string }> = {
  Open:      { label: 'Open',      color: '#22C55E' },
  Accepted:  { label: 'Accepted',  color: '#3B82F6' },
  PickedUp:  { label: 'Picked Up', color: '#A855F7' },
  Delivered: { label: 'Delivered', color: '#EAB308' },
  Completed: { label: 'Completed', color: '#6B7280' },
  Cancelled: { label: 'Cancelled', color: '#EF4444' },
  Disputed:  { label: 'Disputed',  color: '#F97316' },
};

// ── Mission history card ──────────────────────────────────────────────────────

function MissionHistoryCard({
  mission,
  role,
}: {
  mission: Mission;
  role:    'hero' | 'buyer';
}) {
  const [confirming, setConfirming] = useState(false);
  const { label, color } = STATUS_CONFIG[mission.status];

  async function handleConfirmReceived() {
    setConfirming(true);
    try {
      await updateDoc(doc(db, 'missions', mission.id), {
        status:      'Completed',
        completedAt: Timestamp.fromDate(new Date()),
      });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      style={{
        background:   '#0d0d0d',
        border:       '1px solid #2a2a2a',
        borderRadius: 12,
        padding:      '12px 14px',
        marginBottom: 10,
      }}
    >
      {/* Title + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <p style={{ color: '#fff', fontWeight: 600, fontSize: 13, margin: 0, flex: 1, lineHeight: 1.4 }}>
          {mission.title}
        </p>
        <span
          style={{
            fontSize:        11,
            fontWeight:      700,
            padding:         '2px 8px',
            borderRadius:    99,
            background:      `${color}22`,
            color,
            border:          `1px solid ${color}44`,
            flexShrink:      0,
            whiteSpace:      'nowrap',
          }}
        >
          {label}
        </span>
      </div>

      {/* Route */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#888', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mission.pickupAddress}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#888', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mission.dropoffAddress}
          </span>
        </div>
      </div>

      {/* Financial summary + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#555', fontSize: 11 }}>{formatDate(mission.createdAt)}</span>
        {role === 'hero' ? (
          <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 13 }}>
            {mission.status === 'Completed' ? `Earned ${centsToCAD(mission.heroEarning)}` : `Earning ${centsToCAD(mission.heroEarning)}`}
          </span>
        ) : (
          <span style={{ color: '#aaa', fontWeight: 600, fontSize: 13 }}>
            Cost {centsToCAD(mission.itemPrice + mission.deliveryFee)}
          </span>
        )}
      </div>

      {/* Buyer: Confirm Received button when Delivered */}
      {role === 'buyer' && mission.status === 'Delivered' && (
        <button
          onClick={handleConfirmReceived}
          disabled={confirming}
          style={{
            marginTop:    10,
            width:        '100%',
            padding:      '10px',
            borderRadius: 10,
            border:       'none',
            background:   'var(--color-primary)',
            color:        '#fff',
            fontSize:     13,
            fontWeight:   700,
            cursor:       confirming ? 'not-allowed' : 'pointer',
            opacity:      confirming ? 0.7 : 1,
          }}
        >
          {confirming ? 'Confirming…' : '✓ Confirm Received — Release Payment'}
        </button>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyHistory({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', color: '#555', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#666', margin: 0 }}>No {label} yet</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface UserProfileProps {
  user:    User;
  onClose: () => void;
}

export default function UserProfile({ user, onClose }: UserProfileProps) {
  const [tab, setTab] = useState<'hero' | 'buyer'>('hero');
  const { primaryColor, setPrimaryColor } = useThemeStore();
  const install = useInstall();
  const { heroMissions, buyerMissions, loading } = useMyMissions(user.uid);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      {/* Panel */}
      <div
        style={{
          position:      'relative',
          background:    '#161616',
          borderRadius:  '20px 20px 0 0',
          maxHeight:     '90dvh',
          overflowY:     'auto',
          animation:     'slideUp 0.28s cubic-bezier(0.32,0,0.67,0) both',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#333', margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #2a2a2a' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Profile</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* ── User info ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 20px 16px', borderBottom: '1px solid #2a2a2a' }}>
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoURL} alt={user.displayName ?? 'User'} width={56} height={56}
              style={{ borderRadius: '50%', flexShrink: 0, border: `2px solid ${primaryColor}` }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
              👤
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 17, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.displayName ?? 'Hero'}
            </p>
            <p style={{ color: '#888', fontSize: 12, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </p>
          </div>
        </div>

        {/* ── Mission history ─────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px 0' }}>
          <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>MISSION HISTORY</p>

          {/* Tab switcher */}
          <div style={{ display: 'flex', background: '#0d0d0d', borderRadius: 10, padding: 3, marginBottom: 12 }}>
            {(['hero', 'buyer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  background: tab === t ? primaryColor : 'transparent',
                  color: tab === t ? '#fff' : '#666',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {t === 'hero' ? '🏍️ As Hero' : '📦 As Buyer'}
              </button>
            ))}
          </div>

          {/* Mission lists */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid ${primaryColor}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : tab === 'hero' ? (
            heroMissions.length === 0
              ? <EmptyHistory label="hero missions" />
              : heroMissions.map((m) => <MissionHistoryCard key={m.id} mission={m} role="hero" />)
          ) : (
            buyerMissions.length === 0
              ? <EmptyHistory label="buyer requests" />
              : buyerMissions.map((m) => <MissionHistoryCard key={m.id} mission={m} role="buyer" />)
          )}
        </div>

        {/* ── Settings ────────────────────────────────────────────────── */}
        <div style={{ padding: '0 20px 40px', borderTop: '1px solid #2a2a2a' }}>
          <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: '20px 0 14px' }}>SETTINGS</p>

          {/* Theme color */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#ccc', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>App Color</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {THEME_PRESETS.map((preset) => {
                const active = primaryColor === preset.value;
                return (
                  <button
                    key={preset.value}
                    onClick={() => setPrimaryColor(preset.value)}
                    title={preset.name}
                    style={{
                      width: 38, height: 38, borderRadius: '50%',
                      background: preset.value,
                      border:   active ? '3px solid #fff' : '3px solid transparent',
                      outline:  active ? `2px solid ${preset.value}` : 'none',
                      cursor:   'pointer', transition: 'transform 0.1s',
                      transform: active ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Install */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#ccc', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Install App</p>
            {install.isInstalled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22C55E', fontSize: 13, fontWeight: 600 }}>
                <span>✓</span><span>App is installed</span>
              </div>
            ) : install.prompt ? (
              <button onClick={install.triggerInstall} style={{ background: primaryColor, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⊕</span> Add to Home Screen
              </button>
            ) : install.isIOS ? (
              <div>
                <button onClick={() => install.setShowIOSTip((v) => !v)} style={{ background: primaryColor, border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⊕</span> How to Add to Home Screen
                </button>
                {install.showIOSTip && (
                  <div style={{ marginTop: 12, background: '#0d0d0d', borderRadius: 12, padding: '14px 16px', border: `1px solid ${primaryColor}44` }}>
                    <ol style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
                      <li>Open in <strong style={{ color: '#fff' }}>Safari</strong></li>
                      <li>Tap <strong style={{ color: '#fff' }}>Share ⎙</strong> at the bottom</li>
                      <li>Tap <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong></li>
                      <li>Tap <strong style={{ color: primaryColor }}>Add</strong></li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#555', fontSize: 12 }}>Open in Chrome or Safari to install.</p>
            )}
          </div>

          {/* Sign out */}
          <button
            onClick={() => signOut(auth)}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid #3a3a3a', background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
