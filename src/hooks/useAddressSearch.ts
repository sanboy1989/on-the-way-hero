'use client';

import { useEffect, useState } from 'react';

export interface AddressResult {
  displayName: string;   // full Nominatim string (for storage)
  shortName:   string;   // first 3 comma-parts (for display)
  lat:         number;
  lng:         number;
}

// Calgary bounding box — soft bias (bounded=0 so suburbs still work)
const CALGARY_VIEWBOX = '-114.5,50.8,-113.7,51.3';

export function useAddressSearch(query: string) {
  const [results,  setResults]  = useState<AddressResult[]>([]);
  const [loading,  setLoading]  = useState(false);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q:            `${query}, Calgary, Alberta, Canada`,
          format:       'json',
          limit:        '5',
          countrycodes: 'ca',
          viewbox:      CALGARY_VIEWBOX,
          bounded:      '0',
        });
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          { headers: { 'Accept-Language': 'en', 'User-Agent': 'OTWHero/1.0' } },
        );
        const data = await res.json();
        if (!cancelled) {
          setResults(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (data as any[]).map((r) => ({
              displayName: r.display_name as string,
              shortName:   (r.display_name as string).split(',').slice(0, 3).join(',').trim(),
              lat:         parseFloat(r.lat),
              lng:         parseFloat(r.lon),
            })),
          );
        }
      } catch {
        // Network failures are silent — user can retype
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function clearResults() { setResults([]); }

  return { results, loading, clearResults };
}
