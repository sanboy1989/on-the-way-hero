'use client';

import { useState, useRef } from 'react';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '@/lib/firebase';

interface Props {
  user:    User;
  onClose: () => void;
  onDone:  () => void;
}

const LEGAL_TEXT = `IDENTITY VERIFICATION AGREEMENT

Last updated: April 2026

By uploading your photo ID, you agree to the following terms:

1. Purpose
Your government-issued photo ID is collected solely to verify your real identity on the On The Way Hero platform. This protects buyers, heroes, and the broader community.

2. What We Collect
A photo of one government-issued ID (e.g. driver's licence, passport). No financial information is collected through this process.

3. Data Storage & Security
Your ID image is stored in encrypted cloud storage (Google Firebase). It is never stored on-device and is transmitted over secure HTTPS connections.

4. Access
Only authorised On The Way Hero administrators may access your ID document for the sole purpose of verification. Your ID will never be shared with other users or third parties.

5. Retention
Your ID document will be retained for as long as your account remains active, or for up to 2 years after account closure, as required by applicable law. You may request deletion at any time by contacting support.

6. No Sale of Data
Your personal information, including your ID image, will never be sold, rented, or traded to any third party.

7. Your Rights
Under applicable privacy law you have the right to access, correct, or request deletion of your personal data. Contact us at privacy@onthewayhero.ca to exercise these rights.

8. Consent
By tapping "I Agree & Upload ID" below, you expressly consent to On The Way Hero collecting, storing, and using your ID document strictly as described above.`;

// Compress image using canvas and return base64 JPEG string
async function compressImage(file: File, maxPx = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      // Remove the data URL prefix ("data:image/jpeg;base64,") — store raw base64 only
      const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      resolve(base64);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
    img.src = url;
  });
}

export default function VerifyIdentitySheet({ user, onClose, onDone }: Props) {
  const [step,      setStep]      = useState<'legal' | 'upload' | 'done'>('legal');
  const [agreed,    setAgreed]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const base64 = await compressImage(file);
      // Rough size check — Firestore doc limit is 1 MB
      if (base64.length > 900_000) {
        setError('Image is too large even after compression. Please use a lower-resolution photo.');
        return;
      }
      await setDoc(doc(db, 'users', user.uid), {
        verificationStatus:        'pending',
        verificationSubmittedAt:   Timestamp.fromDate(new Date()),
        idImageBase64:             base64,
        displayName:               user.displayName,
        email:                     user.email,
      }, { merge: true });
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 4000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} />

      <div style={{ position: 'relative', background: 'var(--otw-panel)', borderRadius: '20px 20px 0 0', maxHeight: '92dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s cubic-bezier(0.32,0,0.67,0) both' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--otw-handle)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--otw-border)', flexShrink: 0 }}>
          <div>
            <p style={{ color: 'var(--otw-sub)', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: 0 }}>ACCOUNT</p>
            <p style={{ color: 'var(--otw-text)', fontWeight: 700, fontSize: 16, margin: '2px 0 0' }}>Verify Identity</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--otw-sub)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 20px 40px' }}>

          {/* ── Legal step ─────────────────────────────────────────────── */}
          {step === 'legal' && (
            <>
              {/* Why verify */}
              <div style={{ background: '#1a2a1a', border: '1px solid #22c55e33', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
                <p style={{ color: '#22C55E', fontWeight: 700, fontSize: 13, margin: '0 0 6px' }}>🛡 Why verify?</p>
                <p style={{ color: 'var(--otw-sub)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  Real-name verification builds trust between buyers and heroes. Verified users receive a blue checkmark and unlock higher advance limits.
                </p>
              </div>

              {/* Legal scroll box */}
              <div
                style={{
                  background:  'var(--otw-card)',
                  border:      '1px solid var(--otw-border)',
                  borderRadius: 12,
                  padding:     '14px 16px',
                  marginBottom: 16,
                  maxHeight:   240,
                  overflowY:   'auto',
                }}
              >
                <pre style={{ color: 'var(--otw-sub)', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                  {LEGAL_TEXT}
                </pre>
              </div>

              {/* Agree checkbox */}
              <label
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 20 }}
              >
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{ width: 18, height: 18, marginTop: 2, accentColor: 'var(--color-primary)', flexShrink: 0 }}
                />
                <span style={{ color: 'var(--otw-sub)', fontSize: 13, lineHeight: 1.5 }}>
                  I have read and agree to the Identity Verification Agreement. I consent to On The Way Hero collecting and storing my photo ID for verification purposes.
                </span>
              </label>

              <button
                onClick={() => setStep('upload')}
                disabled={!agreed}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: agreed ? 'pointer' : 'not-allowed', opacity: agreed ? 1 : 0.4 }}
              >
                I Agree — Continue to Upload
              </button>
            </>
          )}

          {/* ── Upload step ────────────────────────────────────────────── */}
          {step === 'upload' && (
            <>
              <div style={{ background: 'var(--otw-card)', border: '1px solid var(--otw-border)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                <p style={{ color: 'var(--otw-text)', fontWeight: 700, fontSize: 14, margin: '0 0 8px' }}>Upload a photo of your ID</p>
                <p style={{ color: 'var(--otw-sub)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  Accepted: Driver's licence, passport, or government ID card. Make sure all four corners are visible and the text is clear.
                </p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFile}
              />

              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  width: '100%', padding: 14, borderRadius: 12, border: `2px dashed var(--color-primary)`,
                  background: 'transparent', color: 'var(--color-primary)', fontSize: 15, fontWeight: 700,
                  cursor: uploading ? 'not-allowed' : 'pointer', marginBottom: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}
              >
                {uploading ? (
                  <>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                    Uploading…
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </>
                ) : (
                  <><span style={{ fontSize: 20 }}>📷</span> Take Photo / Choose File</>
                )}
              </button>

              {error && <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{error}</p>}

              <p style={{ color: 'var(--otw-muted)', fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
                Your ID is encrypted and only viewable by authorised admins. It will never be shared with other users.
              </p>
            </>
          )}

          {/* ── Done step ──────────────────────────────────────────────── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <p style={{ color: 'var(--otw-text)', fontWeight: 700, fontSize: 18, margin: '0 0 8px' }}>Submitted!</p>
              <p style={{ color: 'var(--otw-sub)', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
                Your ID has been received. Our team will review it within 24–48 hours. You&apos;ll receive a blue ✓ on your profile once verified.
              </p>
              <button
                onClick={() => { onDone(); onClose(); }}
                style={{ padding: '13px 32px', borderRadius: 12, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
