'use client';

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged in AuthProvider will update the store
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      // Ignore user-cancelled popup
      if (!msg.includes('popup-closed-by-user')) {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight:       '100dvh',
        background:      '#111111',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '24px',
        fontFamily:      'system-ui, sans-serif',
      }}
    >
      {/* Logo / branding */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div
          style={{
            width:        80,
            height:       80,
            borderRadius: '50%',
            background:   '#FF8C00',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            margin:       '0 auto 20px',
            fontSize:     36,
          }}
        >
          🏍️
        </div>
        <h1
          style={{
            color:        '#FF8C00',
            fontSize:     28,
            fontWeight:   700,
            margin:       0,
            letterSpacing: '-0.5px',
          }}
        >
          On The Way Hero
        </h1>
        <p
          style={{
            color:     '#888',
            fontSize:  14,
            marginTop: 8,
          }}
        >
          Calgary community errand delivery
        </p>
      </div>

      {/* Sign-in card */}
      <div
        style={{
          background:   '#1e1e1e',
          border:       '1px solid #2a2a2a',
          borderRadius: 16,
          padding:      '32px 28px',
          width:        '100%',
          maxWidth:     360,
          textAlign:    'center',
        }}
      >
        <h2
          style={{
            color:      '#ffffff',
            fontSize:   18,
            fontWeight: 600,
            margin:     '0 0 8px',
          }}
        >
          Sign in to continue
        </h2>
        <p
          style={{
            color:        '#888',
            fontSize:     13,
            margin:       '0 0 28px',
            lineHeight:   1.5,
          }}
        >
          Find missions near you or post your own errand
        </p>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          style={{
            width:          '100%',
            padding:        '14px 20px',
            borderRadius:   12,
            border:         '1px solid #3a3a3a',
            background:     loading ? '#2a2a2a' : '#ffffff',
            color:          '#111111',
            fontSize:       15,
            fontWeight:     600,
            cursor:         loading ? 'not-allowed' : 'pointer',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            12,
            transition:     'opacity 0.15s',
            opacity:        loading ? 0.6 : 1,
          }}
        >
          {/* Google G logo */}
          {!loading && (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>

        {error && (
          <p
            style={{
              color:     '#ef4444',
              fontSize:  13,
              marginTop: 16,
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            color:      '#555',
            fontSize:   11,
            marginTop:  24,
            lineHeight: 1.6,
          }}
        >
          By signing in you agree to our Terms of Service.
          <br />
          Your location is only used to show nearby missions.
        </p>
      </div>
    </div>
  );
}
