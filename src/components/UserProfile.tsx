'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useThemeStore, THEME_PRESETS } from '@/store/themeStore';

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

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as unknown as DeferredPrompt);
    };
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

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyHistory({ label }: { label: string }) {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '48px 24px',
        color:          '#555',
        textAlign:      'center',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#666' }}>No {label} yet</p>
      <p style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
        Your completed missions will appear here.
      </p>
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

  return (
    <div
      style={{
        position:  'fixed',
        inset:     0,
        zIndex:    2000,
        display:   'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
      />

      {/* Panel */}
      <div
        style={{
          position:     'relative',
          background:   '#161616',
          borderRadius: '20px 20px 0 0',
          maxHeight:    '90dvh',
          overflowY:    'auto',
          animation:    'slideUp 0.28s cubic-bezier(0.32,0,0.67,0) both',
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width:        40,
            height:       4,
            borderRadius: 2,
            background:   '#333',
            margin:       '12px auto 0',
          }}
        />

        {/* Close bar */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '12px 20px',
            borderBottom:   '1px solid #2a2a2a',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Profile</span>
          <button
            onClick={onClose}
            style={{
              background:   'none',
              border:       'none',
              color:        '#888',
              fontSize:     20,
              cursor:       'pointer',
              lineHeight:   1,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── User info ──────────────────────────────────────────────────── */}
        <div
          style={{
            display:       'flex',
            alignItems:    'center',
            gap:           16,
            padding:       '20px 20px 16px',
            borderBottom:  '1px solid #2a2a2a',
          }}
        >
          {user.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt={user.displayName ?? 'User'}
              width={56}
              height={56}
              style={{ borderRadius: '50%', flexShrink: 0, border: `2px solid ${primaryColor}` }}
            />
          ) : (
            <div
              style={{
                width:          56,
                height:         56,
                borderRadius:   '50%',
                background:     '#2a2a2a',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       24,
                flexShrink:     0,
              }}
            >
              👤
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                color:        '#fff',
                fontWeight:   700,
                fontSize:     17,
                margin:       0,
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.displayName ?? 'Hero'}
            </p>
            <p
              style={{
                color:        '#888',
                fontSize:     12,
                margin:       '3px 0 0',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.email}
            </p>
          </div>
        </div>

        {/* ── Mission history tabs ───────────────────────────────────────── */}
        <div style={{ padding: '16px 20px 0' }}>
          <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
            MISSION HISTORY
          </p>

          {/* Tab switcher */}
          <div
            style={{
              display:         'flex',
              background:      '#0d0d0d',
              borderRadius:    10,
              padding:         3,
              marginBottom:    4,
            }}
          >
            {(['hero', 'buyer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex:           1,
                  padding:        '8px 0',
                  borderRadius:   8,
                  border:         'none',
                  background:     tab === t ? primaryColor : 'transparent',
                  color:          tab === t ? '#fff' : '#666',
                  fontWeight:     600,
                  fontSize:       13,
                  cursor:         'pointer',
                  transition:     'all 0.15s',
                }}
              >
                {t === 'hero' ? '🏍️ As Hero' : '📦 As Buyer'}
              </button>
            ))}
          </div>

          {/* History list — stubs */}
          {tab === 'hero'  && <EmptyHistory label="hero missions" />}
          {tab === 'buyer' && <EmptyHistory label="buyer requests" />}
        </div>

        {/* ── Settings ──────────────────────────────────────────────────── */}
        <div
          style={{
            margin:       '0 0 0',
            padding:      '0 20px 40px',
            borderTop:    '1px solid #2a2a2a',
          }}
        >
          <p
            style={{
              color:         '#888',
              fontSize:      11,
              fontWeight:    700,
              letterSpacing: 1,
              margin:        '20px 0 14px',
            }}
          >
            SETTINGS
          </p>

          {/* — Theme color ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#ccc', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              App Color
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {THEME_PRESETS.map((preset) => {
                const active = primaryColor === preset.value;
                return (
                  <button
                    key={preset.value}
                    onClick={() => setPrimaryColor(preset.value)}
                    title={preset.name}
                    style={{
                      width:      38,
                      height:     38,
                      borderRadius: '50%',
                      background: preset.value,
                      border:     active ? '3px solid #fff' : '3px solid transparent',
                      outline:    active ? `2px solid ${preset.value}` : 'none',
                      cursor:     'pointer',
                      transition: 'transform 0.1s',
                      transform:  active ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* — Add to Home Screen ──────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: '#ccc', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              Install App
            </p>

            {install.isInstalled ? (
              <div
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         8,
                  color:       '#22C55E',
                  fontSize:    13,
                  fontWeight:  600,
                }}
              >
                <span>✓</span>
                <span>App is installed</span>
              </div>
            ) : install.prompt ? (
              // Android — native prompt
              <button
                onClick={install.triggerInstall}
                style={{
                  background:   primaryColor,
                  border:       'none',
                  borderRadius: 10,
                  padding:      '10px 20px',
                  color:        '#fff',
                  fontSize:     13,
                  fontWeight:   600,
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          8,
                }}
              >
                <span>⊕</span> Add to Home Screen
              </button>
            ) : install.isIOS ? (
              // iOS — step-by-step instructions
              <div>
                <button
                  onClick={() => install.setShowIOSTip((v) => !v)}
                  style={{
                    background:   primaryColor,
                    border:       'none',
                    borderRadius: 10,
                    padding:      '10px 20px',
                    color:        '#fff',
                    fontSize:     13,
                    fontWeight:   600,
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          8,
                  }}
                >
                  <span>⊕</span> How to Add to Home Screen
                </button>

                {install.showIOSTip && (
                  <div
                    style={{
                      marginTop:    12,
                      background:   '#0d0d0d',
                      borderRadius: 12,
                      padding:      '14px 16px',
                      border:       `1px solid ${primaryColor}44`,
                    }}
                  >
                    <ol
                      style={{
                        color:       '#ccc',
                        fontSize:    13,
                        lineHeight:  1.8,
                        margin:      0,
                        paddingLeft: 18,
                      }}
                    >
                      <li>Open this page in <strong style={{ color: '#fff' }}>Safari</strong></li>
                      <li>Tap the <strong style={{ color: '#fff' }}>Share</strong> button <span>⎙</span> at the bottom</li>
                      <li>Scroll down → tap <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong></li>
                      <li>Tap <strong style={{ color: primaryColor }}>Add</strong></li>
                    </ol>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ color: '#555', fontSize: 12 }}>
                Open in Chrome or Safari to install.
              </p>
            )}
          </div>

          {/* — Sign out ────────────────────────────────────────────────── */}
          <button
            onClick={() => signOut(auth)}
            style={{
              width:        '100%',
              padding:      '12px',
              borderRadius: 12,
              border:       '1px solid #3a3a3a',
              background:   'transparent',
              color:        '#ef4444',
              fontSize:     14,
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
