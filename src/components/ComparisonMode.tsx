import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { AdConfig, AdVariation } from '../types';
import { AdPreview } from './AdPreview';

interface Props {
  config: AdConfig;
  variations: AdVariation[];
  onClose: () => void;
}

export function ComparisonMode({ config, variations, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Save the element that had focus before opening so we can restore it
  useEffect(() => {
    triggerRef.current = document.activeElement;
    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, []);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Focus trap: keep Tab within the overlay
  const handleTrapKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !overlayRef.current) return;
    const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Auto-focus the close button on mount
  useEffect(() => {
    const btn = overlayRef.current?.querySelector<HTMLElement>('button');
    btn?.focus();
  }, []);

  // Precompute id->index map to avoid O(n) findIndex in render loop
  const indexMap = useMemo(() => {
    const m = new Map<string, number>();
    variations.forEach((v, i) => m.set(v.id, i));
    return m;
  }, [variations]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const ids = variations.slice(0, Math.min(4, variations.length)).map((v) => v.id);
    return new Set(ids);
  });

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  };

  const selected = variations.filter((v) => selectedIds.has(v.id));
  const cols = selected.length <= 2 ? selected.length : 2;

  return (
    <div
      className="comparison-overlay"
      ref={overlayRef}
      onKeyDown={handleTrapKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Compare variations"
    >
      <div className="comparison-header">
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Compare Variations ({selected.length}/4)
        </h2>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      {/* Selector */}
      <div className="comparison-selector">
        {variations.map((v, i) => (
          <label
            key={v.id}
            className="comparison-chip"
            style={{
              borderColor: selectedIds.has(v.id) ? 'var(--accent)' : 'var(--border)',
              background: selectedIds.has(v.id) ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(v.id)}
              onChange={() => toggle(v.id)}
              className="sr-only"
            />
            <span style={{ fontSize: 12, color: selectedIds.has(v.id) ? 'var(--text-secondary)' : 'var(--text-dim)' }}>
              #{i + 1} {v.headline.slice(0, 30)}{v.headline.length > 30 ? '\u2026' : ''}
            </span>
          </label>
        ))}
      </div>

      {/* Grid of previews */}
      <div
        className="comparison-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {selected.map((v) => (
          <div key={v.id} className="comparison-card">
            <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 12px', fontWeight: 600 }}>
              Variation #{(indexMap.get(v.id) ?? 0) + 1}
            </div>
            <div style={{ overflow: 'hidden', lineHeight: 0, display: 'flex', justifyContent: 'center' }}>
              <AdPreview
                config={config}
                headline={v.headline}
                paragraph={v.paragraph}
                scale={cols === 1 ? 0.45 : 0.35}
              />
            </div>
            <div style={{ padding: '8px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{v.headline}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.paragraph}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
