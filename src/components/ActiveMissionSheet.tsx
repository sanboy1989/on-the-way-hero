'use client';

import { useState } from 'react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Mission } from '@/types/mission';

function centsToCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// ── Status timeline steps ─────────────────────────────────────────────────────

const STEPS: { status: Mission['status']; label: string; icon: string }[] = [
  { status: 'Accepted',  label: 'Accepted',     icon: '✓' },
  { status: 'PickedUp',  label: 'Picked Up',    icon: '📦' },
  { status: 'Delivered', label: 'Delivered',    icon: '🏠' },
  { status: 'Completed', label: 'Completed',    icon: '🎉' },
];

const STATUS_ORDER: Record<string, number> = {
  Accepted: 0, PickedUp: 1, Delivered: 2, Completed: 3,
};

// ── Action button ─────────────────────────────────────────────────────────────

interface ActionButtonProps {
  mission: Mission;
}

function ActionButton({ mission }: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  async function update(fields: Record<string, unknown>) {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'missions', mission.id), fields);
    } finally {
      setLoading(false);
    }
  }

  if (mission.status === 'Accepted') {
    return (
      <button
        onClick={() => update({ status: 'PickedUp', pickedUpAt: Timestamp.fromDate(new Date()) })}
        disabled={loading}
        style={btnStyle}
      >
        {loading ? 'Updating…' : '📦 Confirm Picked Up'}
      </button>
    );
  }

  if (mission.status === 'PickedUp') {
    return (
      <button
        onClick={() => update({ status: 'Delivered', deliveredAt: Timestamp.fromDate(new Date()) })}
        disabled={loading}
        style={btnStyle}
      >
        {loading ? 'Updating…' : '🏠 Confirm Delivered'}
      </button>
    );
  }

  if (mission.status === 'Delivered') {
    return (
      <div
        style={{
          background:   '#1a2a1a',
          border:       '1px solid #22c55e44',
          borderRadius: 12,
          padding:      '12px 16px',
          textAlign:    'center',
          color:        '#22C55E',
          fontSize:     13,
          fontWeight:   600,
        }}
      >
        ✓ Delivered — awaiting buyer confirmation
        <p style={{ color: '#555', fontSize: 11, fontWeight: 400, marginTop: 4, marginBottom: 0 }}>
          Auto-confirms in 48 hours if no response
        </p>
      </div>
    );
  }

  return null;
}

const btnStyle: React.CSSProperties = {
  width:        '100%',
  padding:      14,
  borderRadius: 12,
  border:       'none',
  background:   'var(--color-primary)',
  color:        '#fff',
  fontSize:     15,
  fontWeight:   700,
  cursor:       'pointer',
};

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  mission: Mission;
  onClose: () => void;
}

export default function ActiveMissionSheet({ mission, onClose }: Props) {
  const currentStep = STATUS_ORDER[mission.status] ?? 0;

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         2500,
        display:        'flex',
        flexDirection:  'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }}
      />

      {/* Sheet */}
      <div
        style={{
          position:      'relative',
          background:    '#161616',
          borderRadius:  '20px 20px 0 0',
          maxHeight:     '88dvh',
          overflowY:     'auto',
          animation:     'slideUp 0.25s cubic-bezier(0.32,0,0.67,0) both',
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
          <div>
            <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: 0 }}>
              ACTIVE MISSION
            </p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: '3px 0 0' }}>
              {mission.title}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '20px 20px 40px' }}>

          {/* ── Status timeline ──────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            {STEPS.map((step, i) => {
              const done    = STATUS_ORDER[step.status] <= currentStep;
              const current = STATUS_ORDER[step.status] === currentStep;
              return (
                <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                  {/* Circle */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{
                        width:      32,
                        height:     32,
                        borderRadius: '50%',
                        background:   done ? 'var(--color-primary)' : '#2a2a2a',
                        border:       current ? '2px solid var(--color-primary)' : '2px solid transparent',
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        fontSize:     14,
                        color:        done ? '#fff' : '#444',
                        transition:   'all 0.2s',
                        flexShrink:   0,
                      }}
                    >
                      {step.icon}
                    </div>
                    <span style={{ fontSize: 9, color: done ? 'var(--color-primary)' : '#444', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {step.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div
                      style={{
                        flex:       1,
                        height:     2,
                        background: STATUS_ORDER[STEPS[i + 1].status] <= currentStep
                          ? 'var(--color-primary)' : '#2a2a2a',
                        margin:     '0 4px',
                        marginBottom: 18,
                        transition: 'background 0.2s',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Route + navigation ───────────────────────────────────── */}
          <div
            style={{
              background:   '#0d0d0d',
              border:       '1px solid #2a2a2a',
              borderRadius: 12,
              overflow:     'hidden',
              marginBottom: 16,
            }}
          >
            {/* Pickup */}
            <div
              style={{
                display:       'flex',
                alignItems:    'center',
                justifyContent:'space-between',
                padding:       '12px 14px',
                borderBottom:  '1px solid #2a2a2a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22C55E', flexShrink: 0, display: 'inline-block' }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#888', fontSize: 10, fontWeight: 700, margin: 0 }}>PICKUP</p>
                  <p style={{ color: '#fff', fontSize: 13, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mission.pickupAddress}
                  </p>
                </div>
              </div>
              <a
                href={mapsUrl(mission.pickupCoords.latitude, mission.pickupCoords.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background:   'var(--color-primary)',
                  border:       'none',
                  borderRadius: 8,
                  padding:      '6px 12px',
                  color:        '#fff',
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                  textDecoration: 'none',
                  flexShrink:   0,
                  marginLeft:   10,
                }}
              >
                Navigate
              </a>
            </div>

            {/* Dropoff */}
            <div
              style={{
                display:       'flex',
                alignItems:    'center',
                justifyContent:'space-between',
                padding:       '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ color: '#888', fontSize: 10, fontWeight: 700, margin: 0 }}>DROP-OFF</p>
                  <p style={{ color: '#fff', fontSize: 13, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mission.dropoffAddress}
                  </p>
                </div>
              </div>
              <a
                href={mapsUrl(mission.dropoffCoords.latitude, mission.dropoffCoords.longitude)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background:   '#3B82F6',
                  border:       'none',
                  borderRadius: 8,
                  padding:      '6px 12px',
                  color:        '#fff',
                  fontSize:     12,
                  fontWeight:   600,
                  cursor:       'pointer',
                  textDecoration: 'none',
                  flexShrink:   0,
                  marginLeft:   10,
                }}
              >
                Navigate
              </a>
            </div>
          </div>

          {/* ── Financials ───────────────────────────────────────────── */}
          <div
            style={{
              background:   '#0d0d0d',
              border:       '1px solid #2a2a2a',
              borderRadius: 12,
              padding:      14,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: '#888' }}>Advanced upfront</span>
              <span style={{ color: '#f87171', fontWeight: 700 }}>{centsToCAD(mission.itemPrice)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, paddingTop: 8, borderTop: '1px solid #2a2a2a' }}>
              <span style={{ color: '#fff', fontWeight: 700 }}>You earn on completion</span>
              <span style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: 15 }}>
                {centsToCAD(mission.heroEarning)}
              </span>
            </div>
          </div>

          {/* ── Action button ─────────────────────────────────────────── */}
          <ActionButton mission={mission} />
        </div>
      </div>
    </div>
  );
}
