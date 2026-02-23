import { useState, useRef } from 'react';
import type { AdVariation } from '../types';
import { SAMPLE_VARIATIONS } from '../types';

interface Props {
  variations: AdVariation[];
  onVariationsChange: (variations: AdVariation[]) => void;
}

export function BulkPanel({ variations, onVariationsChange }: Props) {
  const [bulkText, setBulkText] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dragStartRef = useRef<number | null>(null);

  const parseBulkText = () => {
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const newVariations: AdVariation[] = [];
    let current: Partial<AdVariation> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('H:') || trimmed.startsWith('Headline:')) {
        if (current.headline && current.paragraph) {
          newVariations.push({ id: crypto.randomUUID(), headline: current.headline, paragraph: current.paragraph, cta: current.cta });
        }
        current = { headline: trimmed.replace(/^(H|Headline):\s*/, '') };
      } else if (trimmed.startsWith('P:') || trimmed.startsWith('Paragraph:')) {
        current.paragraph = trimmed.replace(/^(P|Paragraph):\s*/, '');
      } else if (trimmed.startsWith('C:') || trimmed.startsWith('CTA:')) {
        current.cta = trimmed.replace(/^(C|CTA):\s*/, '');
      }
    }
    if (current.headline && current.paragraph) {
      newVariations.push({ id: crypto.randomUUID(), headline: current.headline, paragraph: current.paragraph, cta: current.cta });
    }

    if (newVariations.length > 0) {
      onVariationsChange([...variations, ...newVariations]);
      setBulkText('');
    }
  };

  const loadSamples = () => onVariationsChange(SAMPLE_VARIATIONS);
  const removeVariation = (id: string) => onVariationsChange(variations.filter((v) => v.id !== id));

  const moveVariation = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= variations.length) return;
    const items = [...variations];
    [items[idx], items[target]] = [items[target], items[idx]];
    onVariationsChange(items);
  };
  const clearAll = () => {
    if (window.confirm(`Remove all ${variations.length} variations?`)) {
      onVariationsChange([]);
    }
  };

  const copyText = async (v: AdVariation) => {
    try {
      await navigator.clipboard.writeText(`${v.headline}\n${v.paragraph}${v.cta ? `\n${v.cta}` : ''}`);
      setCopiedId(v.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard API may fail in non-secure contexts or when denied
      console.warn('Clipboard write failed — copy not supported in this context');
    }
  };

  // Drag and drop
  const onDragStart = (idx: number) => {
    dragStartRef.current = idx;
    setDragIdx(idx);
  };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const onDrop = (idx: number) => {
    const from = dragStartRef.current;
    if (from === null || from === idx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }
    const items = [...variations];
    const [moved] = items.splice(from, 1);
    items.splice(idx, 0, moved);
    onVariationsChange(items);
    setDragIdx(null);
    setOverIdx(null);
    dragStartRef.current = null;
  };

  const onDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragStartRef.current = null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Variations ({variations.length})
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={loadSamples}>Load Samples</button>
          {variations.length > 0 && (
            <button className="btn-secondary" onClick={clearAll} style={{ color: 'var(--danger)' }}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Bulk paste area */}
      <div>
        <label className="editor-label">Paste Variations</label>
        <textarea
          className="editor-input"
          rows={6}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={`H: Your headline here\nP: Your paragraph here\nC: Try It Free \u2192\nH: Another headline\nP: Another paragraph\nC: Book a Demo \u2192`}
          style={{ fontSize: 12, fontFamily: 'monospace' }}
        />
        <button className="btn-primary" onClick={parseBulkText} style={{ marginTop: 8 }}>
          Add Variations
        </button>
      </div>

      {/* Variation list with drag-and-drop */}
      {variations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\ud83d\udcdd'}</div>
          <div className="empty-state-text">No variations yet</div>
          <div className="empty-state-sub">Paste text above, load samples, or use Brainstorm</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
          {variations.map((v, i) => (
            <div
              key={v.id}
              className="variation-card"
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => onDragOver(e, i)}
              onDrop={() => onDrop(i)}
              onDragEnd={onDragEnd}
              style={{
                opacity: dragIdx === i ? 0.4 : 1,
                borderColor: overIdx === i ? 'var(--accent)' : undefined,
                transition: 'border-color 0.15s, opacity 0.15s',
                cursor: 'grab',
              }}
            >
              {/* Drag handle */}
              <div style={{ color: 'var(--text-faint)', fontSize: 14, cursor: 'grab', userSelect: 'none', padding: '0 4px' }}>
                &#x2630;
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>#{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{v.headline}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.paragraph}</div>
                {v.cta && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3 }}>[{v.cta}]</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  onClick={() => moveVariation(i, -1)}
                  disabled={i === 0}
                  style={{
                    background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer',
                    fontSize: 10, padding: 2, lineHeight: 1,
                    color: 'var(--text-dim)', opacity: i === 0 ? 0.3 : 1,
                  }}
                  title="Move up"
                  aria-label={`Move variation ${i + 1} up`}
                >
                  &#x25B2;
                </button>
                <button
                  onClick={() => moveVariation(i, 1)}
                  disabled={i === variations.length - 1}
                  style={{
                    background: 'none', border: 'none', cursor: i === variations.length - 1 ? 'default' : 'pointer',
                    fontSize: 10, padding: 2, lineHeight: 1,
                    color: 'var(--text-dim)', opacity: i === variations.length - 1 ? 0.3 : 1,
                  }}
                  title="Move down"
                  aria-label={`Move variation ${i + 1} down`}
                >
                  &#x25BC;
                </button>
                <button
                  onClick={() => copyText(v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, padding: 2, lineHeight: 1,
                    color: copiedId === v.id ? 'var(--success)' : 'var(--text-dim)',
                  }}
                  title="Copy text"
                  aria-label="Copy variation text"
                >
                  {copiedId === v.id ? '\u2713' : '\u2398'}
                </button>
                <button
                  onClick={() => removeVariation(v.id)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)',
                    cursor: 'pointer', fontSize: 16, padding: 2, lineHeight: 1,
                  }}
                  title="Remove"
                  aria-label={`Remove variation ${i + 1}`}
                >
                  &times;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
