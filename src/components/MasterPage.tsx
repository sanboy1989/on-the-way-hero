'use client';

import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAllMissions } from '@/hooks/useAllMissions';
import EditMissionForm from '@/components/EditMissionForm';
import type { Mission } from '@/types/mission';

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_STATUSES: Mission['status'][] = [
  'Open', 'Accepted', 'PickedUp', 'Delivered', 'Completed', 'Cancelled', 'Disputed',
];

const STATUS_COLOR: Record<Mission['status'], string> = {
  Open:      '#22C55E',
  Accepted:  '#3B82F6',
  PickedUp:  '#A855F7',
  Delivered: '#EAB308',
  Completed: '#6B7280',
  Cancelled: '#EF4444',
  Disputed:  '#F97316',
};

const FILTERS = [
  { label: 'All',      statuses: null                                    },
  { label: 'Open',     statuses: ['Open']                                },
  { label: 'Active',   statuses: ['Accepted', 'PickedUp', 'Delivered']   },
  { label: 'Done',     statuses: ['Completed', 'Cancelled', 'Disputed']  },
] as const;

function centsToCAD(c: number) { return `$${(c / 100).toFixed(2)}`; }
function shortDate(d: Date)    { return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); }
function shortUid(uid: string | null) { return uid ? uid.slice(0, 6) + '…' : '—'; }

// ── Mission row ───────────────────────────────────────────────────────────────

function MissionRow({
  mission,
  onEdit,
  onDeleted,
}: {
  mission:   Mission;
  onEdit:    () => void;
  onDeleted: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [statusSaving,  setStatusSaving]  = useState(false);

  async function handleStatusChange(newStatus: Mission['status']) {
    setStatusSaving(true);
    try { await updateDoc(doc(db, 'missions', mission.id), { status: newStatus }); }
    finally { setStatusSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'missions', mission.id));
      onDeleted();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const color = STATUS_COLOR[mission.status];

  return (
    <div
      style={{
        background:   'var(--otw-card)',
        border:       '1px solid #2a2a2a',
        borderRadius: 12,
        padding:      '12px 14px',
        marginBottom: 10,
      }}
    >
      {/* Title + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <p style={{ flex: 1, color: '#fff', fontWeight: 600, fontSize: 13, margin: 0, lineHeight: 1.4 }}>
          {mission.title}
        </p>

        {/* Inline status dropdown */}
        <select
          value={mission.status}
          disabled={statusSaving}
          onChange={(e) => handleStatusChange(e.target.value as Mission['status'])}
          style={{
            background:   `${color}22`,
            color,
            border:       `1px solid ${color}44`,
            borderRadius: 99,
            padding:      '2px 8px',
            fontSize:     11,
            fontWeight:   700,
            cursor:       'pointer',
            flexShrink:   0,
          }}
        >
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s} style={{ background: 'var(--otw-panel)', color: '#fff' }}>{s}</option>
          ))}
        </select>
      </div>

      {/* Route */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#888', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.pickupAddress}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, display: 'inline-block' }} />
          <span style={{ color: '#888', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission.dropoffAddress}</span>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: '#555', marginBottom: 10, flexWrap: 'wrap' }}>
        <span>Buyer: <span style={{ color: '#888' }}>{shortUid(mission.buyerId)}</span></span>
        <span>Hero: <span style={{ color: '#888' }}>{shortUid(mission.heroId)}</span></span>
        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{centsToCAD(mission.itemPrice)} advance</span>
        <span style={{ color: '#22C55E', fontWeight: 700 }}>+{centsToCAD(mission.heroEarning)} earn</span>
        <span style={{ marginLeft: 'auto' }}>{shortDate(mission.createdAt)}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onEdit}
          style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #3a3a3a', background: 'transparent', color: '#ccc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          ✏️ Edit
        </button>

        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #3a3a3a', background: 'transparent', color: '#888', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #ef44444a', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            🗑 Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MasterPage({ onClose }: { onClose: () => void }) {
  const { missions, loading } = useAllMissions();
  const [filter,      setFilter]      = useState<typeof FILTERS[number]['label']>('All');
  const [editMission, setEditMission] = useState<Mission | null>(null);

  const filtered = filter === 'All'
    ? missions
    : missions.filter((m) => {
        const f = FILTERS.find((x) => x.label === filter);
        return f?.statuses?.includes(m.status as never);
      });

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 2800, display: 'flex', flexDirection: 'column' }}>
        {/* Backdrop */}
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />

        {/* Panel — full height */}
        <div
          style={{
            position:      'relative',
            background:    'var(--otw-panel)',
            borderRadius:  '20px 20px 0 0',
            marginTop:     '6dvh',
            flex:          1,
            display:       'flex',
            flexDirection: 'column',
            animation:     'slideUp 0.28s cubic-bezier(0.32,0,0.67,0) both',
            overflow:      'hidden',
          }}
        >
          {/* Handle */}
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--otw-handle)', margin: '12px auto 0', flexShrink: 0 }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--otw-border)', flexShrink: 0 }}>
            <div>
              <p style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: 0 }}>ADMIN</p>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: '2px 0 0' }}>
                Master Page <span style={{ color: '#555', fontWeight: 400, fontSize: 13 }}>({missions.length} total)</span>
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', padding: '10px 16px', gap: 8, borderBottom: '1px solid var(--otw-border)', flexShrink: 0 }}>
            {FILTERS.map((f) => {
              const count = f.statuses
                ? missions.filter((m) => (f.statuses as readonly string[]).includes(m.status)).length
                : missions.length;
              return (
                <button
                  key={f.label}
                  onClick={() => setFilter(f.label)}
                  style={{
                    padding:      '6px 12px',
                    borderRadius: 8,
                    border:       'none',
                    background:   filter === f.label ? 'var(--color-primary)' : '#2a2a2a',
                    color:        filter === f.label ? '#fff' : '#888',
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       'pointer',
                  }}
                >
                  {f.label} {count > 0 && <span style={{ opacity: 0.75 }}>({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Mission list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 40px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--color-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: '#555' }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>📭</p>
                <p style={{ fontSize: 13 }}>No missions in this category</p>
              </div>
            ) : (
              filtered.map((m) => (
                <MissionRow
                  key={m.id}
                  mission={m}
                  onEdit={() => setEditMission(m)}
                  onDeleted={() => setEditMission(null)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit form mounts on top */}
      {editMission && (
        <EditMissionForm mission={editMission} onClose={() => setEditMission(null)} />
      )}
    </>
  );
}
