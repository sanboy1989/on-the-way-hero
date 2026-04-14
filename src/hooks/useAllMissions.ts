'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fromDoc } from '@/hooks/useMissions';
import type { Mission } from '@/types/mission';

export function useAllMissions() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'missions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setMissions(snap.docs.map(fromDoc));
      setLoading(false);
    });
  }, []);

  return { missions, loading };
}
