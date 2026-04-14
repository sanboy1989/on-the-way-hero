'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import AddressField        from '@/components/AddressField';
import type { AddressResult } from '@/hooks/useAddressSearch';

// ─── Validation schema ────────────────────────────────────────────────────────

const schema = z.object({
  title:          z.string().min(3, 'At least 3 characters'),
  description:    z.string().optional(),
  marketplaceUrl: z.string().optional(),
  itemPrice:      z.coerce.number().min(0.01, 'Required'),
  deliveryFee:    z.coerce.number().min(1.00, 'Minimum $1.00'),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function centsToCAD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}


// ─── Deadline options ─────────────────────────────────────────────────────────

const DEADLINES = [
  { label: '2h',  hours: 2  },
  { label: '4h',  hours: 4  },
  { label: '8h',  hours: 8  },
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function PostMissionForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();

  // Address state
  const [pickupQuery,  setPickupQuery]  = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [pickup,       setPickup]       = useState<AddressResult | null>(null);
  const [dropoff,      setDropoff]      = useState<AddressResult | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);

  const pickupSearch  = useAddressSearch(pickup  ? '' : pickupQuery);
  const dropoffSearch = useAddressSearch(dropoff ? '' : dropoffQuery);

  // Deadline state
  const [deadlineHours, setDeadlineHours] = useState(4);

  // Expected delivery time (datetime-local string, default 4h from now)
  function defaultDeliveryTime() {
    return new Date(Date.now() + 4 * 3_600_000).toISOString().slice(0, 16);
  }
  const [expectedDeliveryTime, setExpectedDeliveryTime] = useState(defaultDeliveryTime);

  // Form
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { deadlineHours: 4 } as unknown as FormValues });

  // Live fee calculation
  const watchedItem    = watch('itemPrice')   ?? 0;
  const watchedFee     = watch('deliveryFee') ?? 0;
  const platformFee    = Math.round(Number(watchedFee)  * 100 * 0.05);
  const heroEarning    = Math.round(Number(watchedFee)  * 100) - platformFee;
  const itemPriceCents = Math.round(Number(watchedItem) * 100);

  // Handlers
  function handlePickupSelect(r: AddressResult) {
    setPickup(r);
    setPickupQuery(r.shortName);
    pickupSearch.clearResults();
  }
  function handleDropoffSelect(r: AddressResult) {
    setDropoff(r);
    setDropoffQuery(r.shortName);
    dropoffSearch.clearResults();
  }

  async function onSubmit(values: FormValues) {
    // Validate addresses
    if (!pickup || !dropoff) {
      setAddressError('Please select both pickup and drop-off addresses.');
      return;
    }
    setAddressError(null);

    // Validate with Zod
    const result = schema.safeParse(values);
    if (!result.success) {
      for (const issue of result.error.issues) {
        setError(issue.path[0] as keyof FormValues, { message: issue.message });
      }
      return;
    }

    // Derived values
    const deliveryFeeCents = Math.round(values.deliveryFee * 100);
    const pFee             = Math.round(deliveryFeeCents * 0.05);
    const hEarning         = deliveryFeeCents - pFee;
    const distanceKm       = Math.round(
      haversineKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng) * 10,
    ) / 10;
    const now = new Date();

    await addDoc(collection(db, 'missions'), {
      buyerId:              user!.uid,
      heroId:               null,
      title:                values.title.trim(),
      description:          values.description?.trim() ?? '',
      itemPhotoUrl:         null,
      marketplaceUrl:       values.marketplaceUrl?.trim() || null,
      expectedDeliveryTime: expectedDeliveryTime
        ? Timestamp.fromDate(new Date(expectedDeliveryTime))
        : null,
      itemPrice:        Math.round(values.itemPrice * 100),
      deliveryFee:      deliveryFeeCents,
      platformFee:      pFee,
      heroEarning:      hEarning,
      pickupAddress:    pickup.shortName,
      pickupCoords:     { latitude: pickup.lat, longitude: pickup.lng },
      dropoffAddress:   dropoff.shortName,
      dropoffCoords:    { latitude: dropoff.lat, longitude: dropoff.lng },
      pickupDeadline:   Timestamp.fromDate(new Date(now.getTime() + deadlineHours * 3_600_000)),
      distanceKm,
      status:           'Open',
      createdAt:        Timestamp.fromDate(now),
      acceptedAt:       null,
      pickedUpAt:       null,
      deliveredAt:      null,
      completedAt:      null,
      cancelledAt:      null,
      pickupPhotoUrl:   null,
      deliveryPhotoUrl: null,
      escrowTxId:       null,
      payoutTxId:       null,
    });

    onClose();
  }

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         2000,
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

      {/* Panel */}
      <div
        style={{
          position:     'relative',
          background:   'var(--otw-panel)',
          borderRadius: '20px 20px 0 0',
          maxHeight:    '92dvh',
          display:      'flex',
          flexDirection:'column',
          animation:    'slideUp 0.28s cubic-bezier(0.32,0,0.67,0) both',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--otw-handle)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            padding:        '12px 20px',
            borderBottom:   '1px solid #2a2a2a',
            flexShrink:     0,
          }}
        >
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Post a Mission</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable form body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          style={{ overflowY: 'auto', padding: '20px 20px 40px', flex: 1 }}
        >

          {/* ── Item name ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              ITEM NAME
            </label>
            <input
              type="text"
              className="otw-input"
              placeholder="e.g. IKEA KALLAX Shelf (White 4×4)"
              {...register('title')}
              style={{
                width: '100%', background: 'var(--otw-card)',
                border: '1px solid var(--otw-border)', borderRadius: 10,
                padding: '12px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box',
              }}
            />
            {errors.title && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{errors.title.message}</p>}
          </div>

          {/* ── Description ───────────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              DESCRIPTION <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional)</span>
            </label>
            <textarea
              className="otw-input"
              placeholder="Any details about the item or pickup…"
              rows={2}
              {...register('description')}
              style={{
                width: '100%', background: 'var(--otw-card)',
                border: '1px solid var(--otw-border)', borderRadius: 10,
                padding: '12px 14px', color: '#fff', fontSize: 14,
                resize: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── Marketplace URL ───────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              MARKETPLACE LINK <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(optional)</span>
            </label>
            <input
              type="url"
              className="otw-input"
              placeholder="https://www.facebook.com/marketplace/…"
              {...register('marketplaceUrl')}
              style={{
                width: '100%', background: 'var(--otw-card)',
                border: '1px solid var(--otw-border)', borderRadius: 10,
                padding: '12px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box',
              }}
            />
            <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>Let the hero know exactly what to buy</p>
          </div>

          {/* ── Addresses ─────────────────────────────────────────────── */}
          <AddressField
            label="PICKUP ADDRESS"
            placeholder="Search pickup location…"
            query={pickupQuery}
            onQuery={setPickupQuery}
            results={pickupSearch.results}
            loading={pickupSearch.loading}
            selected={pickup}
            onSelect={handlePickupSelect}
            onClear={() => { setPickup(null); setPickupQuery(''); }}
          />

          <AddressField
            label="DROP-OFF ADDRESS"
            placeholder="Search drop-off location…"
            query={dropoffQuery}
            onQuery={setDropoffQuery}
            results={dropoffSearch.results}
            loading={dropoffSearch.loading}
            selected={dropoff}
            onSelect={handleDropoffSelect}
            onClear={() => { setDropoff(null); setDropoffQuery(''); }}
            error={addressError ?? undefined}
          />

          {/* ── Pickup deadline ────────────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              PICKUP DEADLINE
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {DEADLINES.map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setDeadlineHours(d.hours)}
                  style={{
                    flex:         1,
                    padding:      '9px 0',
                    borderRadius: 10,
                    border:       `1px solid ${deadlineHours === d.hours ? 'var(--color-primary)' : '#2a2a2a'}`,
                    background:   deadlineHours === d.hours ? 'var(--color-primary)' : '#0d0d0d',
                    color:        deadlineHours === d.hours ? '#fff' : '#888',
                    fontSize:     13,
                    fontWeight:   600,
                    cursor:       'pointer',
                    transition:   'all 0.15s',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Expected delivery time ────────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
              EXPECTED DELIVERY TIME
            </label>
            <input
              type="datetime-local"
              value={expectedDeliveryTime}
              min={new Date().toISOString().slice(0, 16)}
              onChange={(e) => setExpectedDeliveryTime(e.target.value)}
              style={{
                width: '100%', background: 'var(--otw-card)',
                border: '1px solid var(--otw-border)', borderRadius: 10,
                padding: '12px 14px', color: '#fff', fontSize: 14,
                boxSizing: 'border-box', colorScheme: 'dark',
              }}
            />
            <p style={{ color: '#555', fontSize: 11, marginTop: 4 }}>When do you need this delivered?</p>
          </div>

          {/* ── Pricing ───────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {/* Item price */}
            <div>
              <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                ITEM PRICE ($)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}>
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="otw-input"
                  placeholder="0.00"
                  {...register('itemPrice')}
                  style={{
                    width: '100%', background: 'var(--otw-card)',
                    border: '1px solid var(--otw-border)', borderRadius: 10,
                    padding: '12px 14px 12px 26px', color: '#fff', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
              {errors.itemPrice && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 3 }}>{errors.itemPrice.message}</p>}
            </div>

            {/* Delivery fee */}
            <div>
              <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
                DELIVERY FEE ($)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none' }}>
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="otw-input"
                  placeholder="0.00"
                  {...register('deliveryFee')}
                  style={{
                    width: '100%', background: 'var(--otw-card)',
                    border: '1px solid var(--otw-border)', borderRadius: 10,
                    padding: '12px 14px 12px 26px', color: '#fff', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
              {errors.deliveryFee && <p style={{ color: '#ef4444', fontSize: 11, marginTop: 3 }}>{errors.deliveryFee.message}</p>}
            </div>
          </div>

          {/* ── Fee breakdown ──────────────────────────────────────────── */}
          <div
            style={{
              background:   '#0d0d0d',
              border:       '1px solid #2a2a2a',
              borderRadius: 12,
              padding:      '14px',
              marginBottom: 24,
            }}
          >
            <p style={{ color: '#666', fontSize: 11, fontWeight: 700, letterSpacing: 1, margin: '0 0 10px' }}>
              FEE BREAKDOWN
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#888' }}>You advance upfront</span>
              <span style={{ color: '#f87171', fontWeight: 700 }}>{centsToCAD(itemPriceCents)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: '#888' }}>Platform fee (5%)</span>
              <span style={{ color: '#555' }}>− {centsToCAD(platformFee)}</span>
            </div>
            <div
              style={{
                display:       'flex',
                justifyContent:'space-between',
                fontSize:      13,
                fontWeight:    700,
                paddingTop:    8,
                borderTop:     '1px solid #2a2a2a',
                marginTop:     4,
              }}
            >
              <span style={{ color: '#ccc' }}>Hero earns</span>
              <span style={{ color: 'var(--color-primary)' }}>{centsToCAD(heroEarning)}</span>
            </div>
          </div>

          {/* ── Submit ────────────────────────────────────────────────── */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width:        '100%',
              padding:      '14px',
              borderRadius: 12,
              border:       'none',
              background:   'var(--color-primary)',
              color:        '#fff',
              fontSize:     15,
              fontWeight:   700,
              cursor:       isSubmitting ? 'not-allowed' : 'pointer',
              opacity:      isSubmitting ? 0.7 : 1,
              transition:   'opacity 0.15s',
            }}
          >
            {isSubmitting ? 'Posting…' : 'Post Mission'}
          </button>
        </form>
      </div>
    </div>
  );
}
