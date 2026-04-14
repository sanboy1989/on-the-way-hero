'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fromDoc } from '@/hooks/useMissions';
import type { Mission } from '@/types/mission';

/**
 * Returns the hero's single active mission (Accepted | PickedUp | Delivered).
 * Null when the hero has no active mission or uid is null.
 */
export function useActiveMission(uid: string | null) {
  const [mission, setMission] = useState<Mission | null>(null);

  useEffect(() => {
    if (!uid) { setMission(null); return; }

    const q = query(
      collection(db, 'missions'),
      where('heroId', '==', uid),
      where('status', 'in', ['Accepted', 'PickedUp', 'Delivered']),
      limit(1),
    );

    return onSnapshot(q, (snap) => {
      setMission(snap.empty ? null : fromDoc(snap.docs[0]));
    });
  }, [uid]);

  return mission;
}
