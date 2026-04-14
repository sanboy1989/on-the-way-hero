'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Mission } from '@/types/mission';

// ── Firestore → Mission converter ─────────────────────────────────────────────

export function fromDoc(doc: QueryDocumentSnapshot<DocumentData>): Mission {
  const d = doc.data();
  return {
    ...(d as Omit<Mission, 'id' | 'pickupDeadline' | 'expectedDeliveryTime' | 'createdAt'>),
    id:                   doc.id,
    pickupDeadline:       (d.pickupDeadline as Timestamp).toDate(),
    expectedDeliveryTime: d.expectedDeliveryTime ? (d.expectedDeliveryTime as Timestamp).toDate() : null,
    createdAt:            (d.createdAt as Timestamp).toDate(),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'missions'),
      where('status', '==', 'Open'),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setMissions(snap.docs.map(fromDoc));
        setLoading(false);
      },
      (err) => {
        console.error('[useMissions]', err);
        // If Firestore needs a composite index, the error message contains a URL —
        // open browser console and click the link to create it automatically.
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  return { missions, loading, error };
}

// ── Seed helper (call once to populate Firestore with test missions) ───────────

export async function seedMissions(): Promise<void> {
  const now = new Date();
  const seeds = [
    {
      buyerId:        'seed_user',
      heroId:         null,
      title:          'IKEA KALLAX Shelf (White 4×4)',
      description:    'Found a great deal on Marketplace. Seller is in NE, I live in NW.',
      itemPhotoUrl:   null,
      marketplaceUrl: null,
      itemPrice:      8000,
      deliveryFee:    2500,
      platformFee:    125,
      heroEarning:    2375,
      pickupAddress:  'Taradale, NE Calgary, AB',
      pickupCoords:   { latitude: 51.1315, longitude: -113.9375 },
      dropoffAddress: 'Dalhousie, NW Calgary, AB',
      dropoffCoords:  { latitude: 51.1018, longitude: -114.1633 },
      pickupDeadline: Timestamp.fromDate(new Date(now.getTime() + 4 * 3_600_000)),
      distanceKm:     18.4,
      status:         'Open',
      createdAt:      Timestamp.fromDate(new Date(now.getTime() - 30 * 60_000)),
    },
    {
      buyerId:        'seed_user',
      heroId:         null,
      title:          'Dyson V8 Vacuum (Refurbished)',
      description:    'Seller in SE, need delivery to SW.',
      itemPhotoUrl:   null,
      marketplaceUrl: null,
      itemPrice:      18000,
      deliveryFee:    3000,
      platformFee:    150,
      heroEarning:    2850,
      pickupAddress:  'Mahogany, SE Calgary, AB',
      pickupCoords:   { latitude: 50.8939, longitude: -113.9672 },
      dropoffAddress: 'Marda Loop, SW Calgary, AB',
      dropoffCoords:  { latitude: 51.0278, longitude: -114.1022 },
      pickupDeadline: Timestamp.fromDate(new Date(now.getTime() + 2 * 3_600_000)),
      distanceKm:     22.1,
      status:         'Open',
      createdAt:      Timestamp.fromDate(new Date(now.getTime() - 15 * 60_000)),
    },
    {
      buyerId:        'seed_user',
      heroId:         null,
      title:          'Nintendo Switch OLED Bundle',
      description:    'Seller requires cash. Hero must advance $320.',
      itemPhotoUrl:   null,
      marketplaceUrl: null,
      itemPrice:      32000,
      deliveryFee:    4500,
      platformFee:    225,
      heroEarning:    4275,
      pickupAddress:  'Skyview Ranch, NE Calgary, AB',
      pickupCoords:   { latitude: 51.1499, longitude: -113.9607 },
      dropoffAddress: 'Tuscany, NW Calgary, AB',
      dropoffCoords:  { latitude: 51.1082, longitude: -114.2187 },
      pickupDeadline: Timestamp.fromDate(new Date(now.getTime() + 6 * 3_600_000)),
      distanceKm:     25.3,
      status:         'Open',
      createdAt:      Timestamp.fromDate(new Date(now.getTime() - 5 * 60_000)),
    },
  ];

  const col = collection(db, 'missions');
  await Promise.all(seeds.map((s) => addDoc(col, s)));
}
