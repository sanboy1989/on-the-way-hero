'use client';

import type { AddressResult } from '@/hooks/useAddressSearch';

export interface AddressFieldProps {
  label:       string;
  placeholder: string;
  query:       string;
  onQuery:     (q: string) => void;
  results:     AddressResult[];
  loading:     boolean;
  selected:    AddressResult | null;
  onSelect:    (r: AddressResult) => void;
  onClear:     () => void;
  error?:      string;
}

export default function AddressField({
  label, placeholder,
  query, onQuery,
  results, loading,
  selected, onSelect, onClear,
  error,
}: AddressFieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ color: '#888', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 8 }}>
        {label}
      </label>

      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0d0d0d', border: '1px solid var(--color-primary)', borderRadius: 10, padding: '10px 14px' }}>
          <span style={{ flex: 1, color: '#fff', fontSize: 13 }}>{selected.shortName}</span>
          <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16, flexShrink: 0, lineHeight: 1 }}>✕</button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="otw-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            autoComplete="off"
            style={{ width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
          />
          {(results.length > 0 || loading) && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1a1a', border: '1px solid #2a2a2a', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
              {loading && <div style={{ padding: '10px 14px', color: '#666', fontSize: 13 }}>Searching…</div>}
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelect(r)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #2a2a2a' : 'none', color: '#ccc', fontSize: 13, cursor: 'pointer', lineHeight: 1.4 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2a2a'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                >
                  {r.shortName}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</p>}
    </div>
  );
}
