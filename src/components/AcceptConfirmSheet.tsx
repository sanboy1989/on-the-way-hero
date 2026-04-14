'use client';

import { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Mission } from '@/types/mission';

function centsToCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface Props {
  mission: Mission;
  heroId:  string;
  onClose: () => void;
}

export default function AcceptConfirmSheet({ mission, heroId, onClose }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'missions', mission.id), {
        heroId,
        status:     'Accepted',
        acceptedAt: Timestamp.fromDate(new Date()),
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         3000,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}
      />

      {/* Sheet */}
      <div
        style={{
          position:     'relative',
          background:   '#161616',
          borderRadius: '20px 20px 0 0',
          padding:      '0 0 40px',
          animation:    'slideUp 0.25s cubic-bezier(0.32,0,0.67,0) both',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#333', margin: '12px auto 0' }} />

        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '14px 20px',
            borderBottom:   '1px solid #2a2a2a',
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Accept Mission?</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 20px 0' }}>
          {/* Mission title */}
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {mission.title}
          </p>

          {/* Route */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: '#aaa', fontSize: 13 }}>{mission.pickupAddress}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
              <span style={{ color: '#aaa', fontSize: 13 }}>{mission.dropoffAddress}</span>
            </div>
          </div>

          {/* Financial breakdown */}
          <div
            style={{
              background:   '#0d0d0d',
              border:       '1px solid #2a2a2a',
              borderRadius: 12,
              padding:      14,
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#aaa', fontSize: 13 }}>You advance upfront</span>
              <span style={{ color: '#f87171', fontWeight: 700, fontSize: 13 }}>{centsToCAD(mission.itemPrice)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#aaa', fontSize: 13 }}>Platform fee (5%)</span>
              <span style={{ color: '#555', fontSize: 13 }}>− {centsToCAD(mission.platformFee)}</span>
            </div>
            <div
              style={{
                display:        'flex',
                justifyContent: 'space-between',
                paddingTop:     10,
                borderTop:      '1px solid #2a2a2a',
              }}
            >
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>You earn after delivery</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 16 }}>
                {centsToCAD(mission.heroEarning)}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div
            style={{
              background:   '#2a1500',
              border:       '1px solid #ff8c0044',
              borderRadius: 10,
              padding:      '10px 14px',
              marginBottom: 20,
              display:      'flex',
              gap:          10,
              alignItems:   'flex-start',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <p style={{ color: '#ffb347', fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              You must pay <strong>{centsToCAD(mission.itemPrice)}</strong> cash to the seller upfront.
              This will be refunded to you plus your <strong>{centsToCAD(mission.heroEarning)}</strong> earnings after delivery is confirmed.
            </p>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex:         1,
                padding:      13,
                borderRadius: 12,
                border:       '1px solid #3a3a3a',
                background:   'transparent',
                color:        '#aaa',
                fontSize:     14,
                fontWeight:   600,
                cursor:       'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              style={{
                flex:         2,
                padding:      13,
                borderRadius: 12,
                border:       'none',
                background:   'var(--color-primary)',
                color:        '#fff',
                fontSize:     14,
                fontWeight:   700,
                cursor:       loading ? 'not-allowed' : 'pointer',
                opacity:      loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Accepting…' : "Accept Mission"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
