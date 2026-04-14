'use client';

/**
 * InstallButton — "Add to Home Screen" for PWA
 *
 * Android Chrome: captures the beforeinstallprompt event and shows a real button.
 * iOS Safari: detects standalone mode is NOT active and shows a tap-share instruction.
 * Already installed / other browser: renders nothing.
 */

import { useEffect, useState } from 'react';

type DeferredPrompt = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type IOSNav = Navigator & { standalone?: boolean };

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [isIOS,          setIsIOS]          = useState(false);
  const [showIOSTip,     setShowIOSTip]     = useState(false);
  const [hidden,         setHidden]         = useState(false);

  useEffect(() => {
    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = (navigator as IOSNav).standalone;
    if (ios && !standalone) {
      setIsIOS(true);
      return;
    }

    // Android / Chrome: capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as DeferredPrompt);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setHidden(true);
    setDeferredPrompt(null);
  }

  if (hidden) return null;

  // ── Android: real install button ────────────────────────────────────────────
  if (deferredPrompt) {
    return (
      <button
        onClick={handleInstall}
        title="Add to Home Screen"
        style={{
          background:   '#FF8C00',
          border:       'none',
          borderRadius: 10,
          padding:      '7px 14px',
          color:        '#fff',
          fontSize:     13,
          fontWeight:   600,
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          gap:          6,
          whiteSpace:   'nowrap',
        }}
      >
        <span style={{ fontSize: 16 }}>⊕</span> Install App
      </button>
    );
  }

  // ── iOS: tap-to-share instruction tip ───────────────────────────────────────
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSTip((v) => !v)}
          title="Add to Home Screen"
          style={{
            background:   '#FF8C00',
            border:       'none',
            borderRadius: 10,
            padding:      '7px 14px',
            color:        '#fff',
            fontSize:     13,
            fontWeight:   600,
            cursor:       'pointer',
            display:      'flex',
            alignItems:   'center',
            gap:          6,
          }}
        >
          <span style={{ fontSize: 16 }}>⊕</span> Install App
        </button>

        {showIOSTip && (
          <div
            style={{
              position:     'fixed',
              bottom:       72,
              left:         '50%',
              transform:    'translateX(-50%)',
              background:   '#1e1e1e',
              border:       '1px solid #FF8C00',
              borderRadius: 14,
              padding:      '16px 20px',
              width:        280,
              zIndex:       9999,
              boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* Close */}
            <button
              onClick={() => setShowIOSTip(false)}
              style={{
                position:   'absolute',
                top:        10,
                right:      12,
                background: 'none',
                border:     'none',
                color:      '#888',
                fontSize:   18,
                cursor:     'pointer',
              }}
            >
              ✕
            </button>

            <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 10px' }}>
              Add to Home Screen
            </p>
            <ol
              style={{
                color:      '#ccc',
                fontSize:   13,
                lineHeight: 1.7,
                margin:     0,
                paddingLeft: 18,
              }}
            >
              <li>Tap the <strong style={{ color: '#fff' }}>Share</strong> button <span style={{ fontSize: 16 }}>⎙</span> at the bottom of Safari</li>
              <li>Scroll down and tap <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong></li>
              <li>Tap <strong style={{ color: '#FF8C00' }}>Add</strong></li>
            </ol>

            {/* Arrow pointing down to Safari toolbar */}
            <div
              style={{
                position:   'absolute',
                bottom:     -10,
                left:       '50%',
                transform:  'translateX(-50%)',
                width:      0,
                height:     0,
                borderLeft: '10px solid transparent',
                borderRight:'10px solid transparent',
                borderTop:  '10px solid #FF8C00',
              }}
            />
          </div>
        )}
      </>
    );
  }

  return null;
}
