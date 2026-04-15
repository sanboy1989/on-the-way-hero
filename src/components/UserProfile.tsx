'use client';

import { useState, useEffect, useRef } from 'react';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc, deleteDoc, Timestamp, onSnapshot, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useThemeStore } from '@/store/themeStore';
import type { ColorMode } from '@/store/themeStore';
import { useMyMissions } from '@/hooks/useMyMissions';
import EditMissionForm     from '@/components/EditMissionForm';
import MasterPage          from '@/components/MasterPage';
import VerifyIdentitySheet from '@/components/VerifyIdentitySheet';
import type { Mission } from '@/types/mission';

// ── Admin ─────────────────────────────────────────────────────────────────────

const ADMIN_UIDS = new Set([
  'ijghwu7cQNYNQOqChAG4QuYFXrI3',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type VerificationStatus = 'none' | 'pending' | 'verified';

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

function centsToCAD(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }
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

function MissionHistoryCard({ mission, role, onEdit }: {
  mission: Mission;
  role:    'hero' | 'buyer';
  onEdit?: () => void;
}) {
  const [confirming,    setConfirming]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const { label, color } = STATUS_CONFIG[mission.status];

  async function handleDelete() {
    setDeleting(true);
    try { await deleteDoc(doc(db, 'missions', mission.id)); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  async function handleConfirmReceived() {
    setConfirming(true);
    try {
      await updateDoc(doc(db, 'missions', mission.id), {
        status: 'Completed', completedAt: Timestamp.fromDate(new Date()),
      });
    } finally { setConfirming(false); }
  }

  return (
    <div style={{ background: 'var(--otw-card)', border: '1px solid var(--otw-border)', borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <p style={{ color: 'var(--otw-text)', fontWeight: 600, fontSize: 13, margin: 0, flex: 1, lineHeight: 1.4 }}>{mission.title}</p>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${color}22`, color, border: `1px solid ${color}44`, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: 'var(--otw-sub)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.pickupAddress}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: 'var(--otw-sub)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.dropoffAddress}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--otw-muted)', fontSize: 11 }}>{formatDate(mission.createdAt)}</span>
        {role === 'hero' ? (
          <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 13 }}>
            {mission.status === 'Completed' ? `Earned ${centsToCAD(mission.heroEarning)}` : `Earning ${centsToCAD(mission.heroEarning)}`}
          </span>
        ) : (
          <span style={{ color: 'var(--otw-sub)', fontWeight: 600, fontSize: 13 }}>
            Cost {centsToCAD(mission.itemPrice + mission.deliveryFee)}
          </span>
        )}
      </div>
      {role === 'buyer' && mission.status === 'Delivered' && (
        <button onClick={handleConfirmReceived} disabled={confirming}
          style={{ marginTop: 10, width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: confirming ? 'not-allowed' : 'pointer', opacity: confirming ? 0.7 : 1 }}>
          {confirming ? 'Confirming…' : '✓ Confirm Received — Release Payment'}
        </button>
      )}
      {role === 'buyer' && mission.status === 'Open' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={onEdit}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid var(--otw-border)', background: 'transparent', color: 'var(--otw-sub)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ✏️ Edit
          </button>
          {confirmDelete ? (
            <>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--otw-border)', background: 'transparent', color: 'var(--otw-sub)', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ef44444a', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              🗑 Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyHistory({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 24px', color: 'var(--otw-muted)', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
      <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>No {label} yet</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface UserProfileProps {
  user:    User;
  onClose: () => void;
}

export default function UserProfile({ user, onClose }: UserProfileProps) {
  const [tab,          setTab]         = useState<'hero' | 'buyer'>('hero');
  const [editMission,  setEditMission] = useState<Mission | null>(null);
  const [showMaster,   setShowMaster]  = useState(false);
  const [showVerify,   setShowVerify]  = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<VerificationStatus>('none');
  const [uploadingPic, setUploadingPic] = useState(false);
  const [localPhotoURL, setLocalPhotoURL] = useState<string | null>(null);

  const { colorMode, setColorMode } = useThemeStore();
  const install = useInstall();
  const { heroMissions, buyerMissions, loading } = useMyMissions(user.uid);
  const picRef = useRef<HTMLInputElement>(null);

  // Read verification status from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const status = snap.data()?.verificationStatus as VerificationStatus | undefined;
      setVerifyStatus(status ?? 'none');
    });
    return unsub;
  }, [user.uid]);

  const photoURL = localPhotoURL ?? user.photoURL;

  async function handleProfilePicChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPic(true);
    try {
      // Compress to ≤ 256 px, quality 0.8 — keeps base64 well under Firestore 1 MB limit
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const blobUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(blobUrl);
          const MAX = 256;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('load failed')); };
        img.src = blobUrl;
      });
      await updateProfile(user, { photoURL: dataUrl });
      await setDoc(doc(db, 'users', user.uid), { photoURL: dataUrl }, { merge: true });
      setLocalPhotoURL(dataUrl);
    } finally {
      setUploadingPic(false);
    }
  }

  const verifyLabel: Record<VerificationStatus, { text: string; color: string; icon: string }> = {
    none:     { text: 'Not verified',    color: '#555',    icon: '○' },
    pending:  { text: 'Under review',    color: '#EAB308', icon: '⏳' },
    verified: { text: 'Verified',        color: '#3B82F6', icon: '✓' },
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

      <div style={{ position: 'relative', background: 'var(--otw-panel)', borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto', animation: 'slideUp 0.28s cubic-bezier(0.32,0,0.67,0) both' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--otw-handle)', margin: '12px auto 0' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--otw-border)' }}>
          <span style={{ color: 'var(--otw-text)', fontWeight: 700, fontSize: 16 }}>Profile</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--otw-sub)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* ── User info ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 20px 16px', borderBottom: '1px solid var(--otw-border)' }}>
          {/* Avatar — tappable to change */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => picRef.current?.click()}
              disabled={uploadingPic}
              style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', position: 'relative', width: 56, height: 56 }}
            >
              {photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoURL} alt={user.displayName ?? 'User'} width={56} height={56}
                  style={{ borderRadius: '50%', display: 'block', border: `2px solid var(--color-primary)`, opacity: uploadingPic ? 0.5 : 1 }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--otw-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: `2px solid var(--color-primary)` }}>
                  👤
                </div>
              )}
              {/* Camera overlay */}
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                📷
              </div>
            </button>
            <input ref={picRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePicChange} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <p style={{ color: 'var(--otw-text)', fontWeight: 700, fontSize: 17, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.displayName ?? 'Hero'}
              </p>
              {verifyStatus === 'verified' && (
                <span style={{ color: '#3B82F6', fontSize: 16, flexShrink: 0 }} title="Identity Verified">✓</span>
              )}
              {verifyStatus === 'pending' && (
                <span style={{ color: '#EAB308', fontSize: 13, flexShrink: 0 }}>⏳</span>
              )}
            </div>
            <p style={{ color: 'var(--otw-sub)', fontSize: 12, margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.email}
            </p>
          </div>
        </div>

        {/* ── Mission history ────────────────────────────────────────────── */}
        <div style={{ padding: '16px 20px 0' }}>
          <p style={{ color: 'var(--otw-sub)', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>MISSION HISTORY</p>

          <div style={{ display: 'flex', background: 'var(--otw-card)', borderRadius: 10, padding: 3, marginBottom: 12 }}>
            {(['hero', 'buyer'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: tab === t ? 'var(--color-primary)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--otw-sub)',
                fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {t === 'hero' ? '🏍️ As Hero' : '📦 As Buyer'}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px solid var(--color-primary)`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : tab === 'hero' ? (
            heroMissions.length === 0
              ? <EmptyHistory label="hero missions" />
              : heroMissions.map((m) => <MissionHistoryCard key={m.id} mission={m} role="hero" />)
          ) : (
            buyerMissions.length === 0
              ? <EmptyHistory label="buyer requests" />
              : buyerMissions.map((m) => (
                  <MissionHistoryCard key={m.id} mission={m} role="buyer" onEdit={() => setEditMission(m)} />
                ))
          )}
        </div>

        {/* ── Settings ──────────────────────────────────────────────────── */}
        <div style={{ padding: '0 20px 40px', borderTop: '1px solid var(--otw-border)' }}>
          <p style={{ color: 'var(--otw-sub)', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: '20px 0 14px' }}>SETTINGS</p>

          {/* Display mode */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: 'var(--otw-text)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Display Mode</p>
            <div style={{ display: 'flex', background: 'var(--otw-card)', borderRadius: 12, padding: 4, border: '1px solid var(--otw-border)' }}>
              {(['dark', 'light'] as ColorMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setColorMode(mode)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 9, border: 'none',
                    background: colorMode === mode ? 'var(--color-primary)' : 'transparent',
                    color: colorMode === mode ? '#fff' : 'var(--otw-sub)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
                </button>
              ))}
            </div>
          </div>

          {/* Identity verification */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: 'var(--otw-text)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Identity Verification</p>
            <div style={{ background: 'var(--otw-card)', border: '1px solid var(--otw-border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🪪</span>
                  <div>
                    <p style={{ color: 'var(--otw-text)', fontWeight: 600, fontSize: 13, margin: 0 }}>Real-name verification</p>
                    <p style={{ color: verifyLabel[verifyStatus].color, fontSize: 12, margin: '2px 0 0', fontWeight: 600 }}>
                      {verifyLabel[verifyStatus].icon} {verifyLabel[verifyStatus].text}
                    </p>
                  </div>
                </div>
                {verifyStatus === 'none' && (
                  <button
                    onClick={() => setShowVerify(true)}
                    style={{ padding: '7px 14px', borderRadius: 9, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Verify
                  </button>
                )}
                {verifyStatus === 'verified' && (
                  <span style={{ color: '#3B82F6', fontSize: 22, fontWeight: 900 }}>✓</span>
                )}
              </div>
            </div>
          </div>

          {/* Install */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: 'var(--otw-text)', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Install App</p>
            {install.isInstalled ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#22C55E', fontSize: 13, fontWeight: 600 }}>
                <span>✓</span><span>App is installed</span>
              </div>
            ) : install.prompt ? (
              <button onClick={install.triggerInstall} style={{ background: 'var(--color-primary)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⊕</span> Add to Home Screen
              </button>
            ) : install.isIOS ? (
              <div>
                <button onClick={() => install.setShowIOSTip((v) => !v)} style={{ background: 'var(--color-primary)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⊕</span> How to Add to Home Screen
                </button>
                {install.showIOSTip && (
                  <div style={{ marginTop: 12, background: 'var(--otw-card)', borderRadius: 12, padding: '14px 16px', border: `1px solid var(--color-primary)44` }}>
                    <ol style={{ color: 'var(--otw-sub)', fontSize: 13, lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
                      <li>Open in <strong style={{ color: 'var(--otw-text)' }}>Safari</strong></li>
                      <li>Tap <strong style={{ color: 'var(--otw-text)' }}>Share ⎙</strong> at the bottom</li>
                      <li>Tap <strong style={{ color: 'var(--otw-text)' }}>"Add to Home Screen"</strong></li>
                      <li>Tap <strong style={{ color: 'var(--color-primary)' }}>Add</strong></li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--otw-muted)', fontSize: 12 }}>Open in Chrome or Safari to install.</p>
            )}
          </div>

          {/* Master Page — admin only */}
          {ADMIN_UIDS.has(user.uid) && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setShowMaster(true)}
                style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--otw-border)', background: 'transparent', color: 'var(--otw-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span>🗂</span> Master Page
              </button>
            </div>
          )}

          {/* Sign out */}
          <button onClick={() => signOut(auth)}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px solid var(--otw-border)', background: 'transparent', color: '#ef4444', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {editMission && <EditMissionForm mission={editMission} onClose={() => setEditMission(null)} />}
      {showMaster  && <MasterPage onClose={() => setShowMaster(false)} />}
      {showVerify  && (
        <VerifyIdentitySheet
          user={user}
          onClose={() => setShowVerify(false)}
          onDone={() => setVerifyStatus('pending')}
        />
      )}
    </div>
  );
}
