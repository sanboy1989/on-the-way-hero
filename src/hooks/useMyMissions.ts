'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fromDoc } from '@/hooks/useMissions';
import type { Mission } from '@/types/mission';

/**
 * Returns all missions where the user is the hero (accepted/completed)
 * and all missions the user posted as a buyer — sorted newest first.
 *
 * Uses two separate single-field queries to avoid composite index requirements.
 */
export function useMyMissions(uid: string | null) {
  const [heroMissions,  setHeroMissions]  = useState<Mission[]>([]);
  const [buyerMissions, setBuyerMissions] = useState<Mission[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    let heroReady  = false;
    let buyerReady = false;
    function checkDone() {
      if (heroReady && buyerReady) setLoading(false);
    }

    const sort = (arr: Mission[]) =>
      [...arr].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const heroUnsub = onSnapshot(
      query(collection(db, 'missions'), where('heroId', '==', uid)),
      (snap) => {
        setHeroMissions(sort(snap.docs.map(fromDoc)));
        heroReady = true;
        checkDone();
      },
    );

    const buyerUnsub = onSnapshot(
      query(collection(db, 'missions'), where('buyerId', '==', uid)),
      (snap) => {
        setBuyerMissions(sort(snap.docs.map(fromDoc)));
        buyerReady = true;
        checkDone();
      },
    );

    return () => { heroUnsub(); buyerUnsub(); };
  }, [uid]);

  return { heroMissions, buyerMissions, loading };
}
