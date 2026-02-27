import { useState, useRef, useEffect } from 'react';
import type { AdVariation, BrainstormTone } from '../types';
import { parseFile } from '../lib/parseBrief.ts';

interface Props {
  onAdd: (variations: AdVariation[]) => void;
  onRemoveLast?: (ids: string[]) => void;
  onReplaceUnliked?: (newVariations: AdVariation[]) => void;
  initialBrief?: string;
  likedVariations?: AdVariation[];
  totalVariations?: number;
  unlikedCount?: number;
}

type Mode = 'templates' | 'ai';

const TONE_OPTIONS: { key: BrainstormTone; label: string; emoji: string }[] = [
  { key: 'professional', label: 'Professional', emoji: '\ud83d\udcbc' },
  { key: 'playful', label: 'Playful', emoji: '\ud83c\udf89' },
  { key: 'urgent', label: 'Urgent', emoji: '\u26a1' },
  { key: 'luxury', label: 'Luxury', emoji: '\u2728' },
  { key: 'minimal', label: 'Minimal', emoji: '\u25fb' },
];

const POWER_WORDS = new Set([
  'free', 'new', 'proven', 'guaranteed', 'secret', 'exclusive', 'limited', 'instant',
  'discover', 'transform', 'unlock', 'boost', 'crush', 'dominate', 'skyrocket', 'save',
  'ultimate', 'breakthrough', 'revolutionary', 'massive', 'powerful', 'stop', 'why',
  'how', 'what', 'fail', 'mistake', 'cost', 'roi', 'data', 'science', 'now',
]);

function scoreHeadline(headline: string): { score: number; reasons: string[] } {
  const words = headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const reasons: string[] = [];
  let score = 50;

  if (words.length >= 5 && words.length <= 12) { score += 10; reasons.push('Good length'); }
  else if (words.length < 4) { score -= 10; reasons.push('Too short'); }
  else if (words.length > 15) { score -= 10; reasons.push('Too long'); }

  const powerCount = words.filter((w) => POWER_WORDS.has(w)).length;
  if (powerCount >= 2) { score += 15; reasons.push(`${powerCount} power words`); }
  else if (powerCount === 1) { score += 8; reasons.push('1 power word'); }
  else { reasons.push('No power words'); }

  if (/\d/.test(headline)) { score += 12; reasons.push('Contains number'); }
  if (headline.endsWith('?')) { score += 5; reasons.push('Question hook'); }
  if (headline.endsWith('.')) { score += 3; reasons.push('Statement'); }
  if (/your|you/i.test(headline)) { score += 8; reasons.push('Direct address'); }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

/* Templates removed — both modes now use AI generation for diverse, non-repetitive output */

export function BrainstormPanel({ onAdd, onRemoveLast, onReplaceUnliked, initialBrief, likedVariations = [], totalVariations = 0, unlikedCount = 0 }: Props) {
  const [mode, setMode] = useState<Mode>(initialBrief ? 'ai' : 'templates');
  const [description, setDescription] = useState('');
  const [briefText, setBriefText] = useState(initialBrief ?? '');
  const [tone, setTone] = useState<BrainstormTone>('professional');
  const [generated, setGenerated] = useState<AdVariation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [undoState, setUndoState] = useState<{ generated: AdVariation[]; selected: Set<string>; addedIds: string[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Abort in-flight request on mode switch or unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Accept incoming brief from Research panel
  useEffect(() => {
    if (initialBrief) {
      setBriefText(initialBrief);
      setMode('ai');
    }
  }, [initialBrief]);

  const handleModeSwitch = (m: Mode) => {
    abortRef.current?.abort();
    setMode(m);
    setGenerated([]);
    setSelected(new Set());
    setAiError(null);
    setAiLoading(false);
  };

  // --- Template mode (now AI-powered) ---
  const brainstorm = async () => {
    if (!description.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setGenerated([]);

    try {
      const toneLabel = TONE_OPTIONS.find((t) => t.key === tone)?.label ?? tone;
      const res = await fetch('/api/brainstorm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: description, tone: toneLabel }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const variations: AdVariation[] = (data.variations || []).map((r: { headline: string; paragraph: string; cta?: string }) => ({
        id: crypto.randomUUID(),
        headline: r.headline,
        paragraph: r.paragraph,
        cta: r.cta || 'Learn More \u2192',
      }));
      setGenerated(variations);
      setSelected(new Set(variations.map((v) => v.id)));
    } catch (err) {
      if (controller.signal.aborted) return;
      setAiError(err instanceof Error ? err.message : 'Unexpected error. Try again.');
    } finally {
      if (!controller.signal.aborted) {
        setAiLoading(false);
      }
    }
  };

  // --- AI mode ---
  const handleAiGenerate = async () => {
    if (!briefText.trim()) {
      setAiError('Please enter or upload a marketing brief.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setGenerated([]);

    try {
      const toneLabel = TONE_OPTIONS.find((t) => t.key === tone)?.label ?? tone;
      let fullBrief = briefText;
      if (likedVariations.length > 0) {
        const liked = likedVariations.map(
          (v, i) => `${i + 1}. Headline: "${v.headline}" | Body: "${v.paragraph}"${v.cta ? ` | CTA: "${v.cta}"` : ''}`
        ).join('\n');
        fullBrief += `\n\n--- Liked variations (generate MORE like these) ---\n${liked}`;
      }

      const res = await fetch('/api/brainstorm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: fullBrief, tone: toneLabel }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const variations: AdVariation[] = (data.variations || []).map((r: { headline: string; paragraph: string; cta?: string }) => ({
        id: crypto.randomUUID(),
        headline: r.headline,
        paragraph: r.paragraph,
        cta: r.cta || 'Learn More \u2192',
      }));
      setGenerated(variations);
      setSelected(new Set(variations.map((v) => v.id)));
    } catch (err) {
      if (controller.signal.aborted) return;
      setAiError(err instanceof Error ? err.message : 'Unexpected error. Try again.');
    } finally {
      if (!controller.signal.aborted) {
        setAiLoading(false);
      }
    }
  };

  const handleRegenerateUnliked = async () => {
    if (!onReplaceUnliked) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);

    try {
      const toneLabel = TONE_OPTIONS.find((t) => t.key === tone)?.label ?? tone;
      const liked = likedVariations.map(
        (v, i) => `${i + 1}. Headline: "${v.headline}" | Body: "${v.paragraph}"${v.cta ? ` | CTA: "${v.cta}"` : ''}`
      ).join('\n');

      const regenerateBrief = `${briefText || 'Generate ad copy variations.'}\n\n--- KEEP these styles (the user loved these) ---\n${liked}\n\n--- IMPORTANT ---\nGenerate ${Math.max(unlikedCount, 4)} NEW variations that match the quality and style of the liked ones above. Make each one unique but equally compelling. Do NOT repeat the liked headlines.`;

      const res = await fetch('/api/brainstorm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: regenerateBrief, tone: toneLabel }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newVariations: AdVariation[] = (data.variations || []).map((r: { headline: string; paragraph: string; cta?: string }) => ({
        id: crypto.randomUUID(),
        headline: r.headline,
        paragraph: r.paragraph,
        cta: r.cta || 'Learn More \u2192',
      }));
      onReplaceUnliked(newVariations);
    } catch (err) {
      if (controller.signal.aborted) return;
      setAiError(err instanceof Error ? err.message : 'Unexpected error. Try again.');
    } finally {
      if (!controller.signal.aborted) setAiLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setFileError(null);
    try {
      const text = await parseFile(file);
      setBriefText(text);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to read file.');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  // --- Shared selection logic ---
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(generated.map((g) => g.id)));
  const selectNone = () => setSelected(new Set());

  const addSelected = () => {
    const toAdd = generated.filter((g) => selected.has(g.id));
    const addedIds = toAdd.map((v) => v.id);
    onAdd(toAdd);
    setUndoState({ generated, selected, addedIds });
    setGenerated([]);
    setSelected(new Set());
  };

  const undoAdd = () => {
    if (!undoState) return;
    setGenerated(undoState.generated);
    setSelected(undoState.selected);
    onRemoveLast?.(undoState.addedIds);
    setUndoState(null);
  };

  // Auto-dismiss undo bar after 5 seconds
  useEffect(() => {
    if (!undoState) return;
    const t = setTimeout(() => setUndoState(null), 5000);
    return () => clearTimeout(t);
  }, [undoState]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode toggle */}
      <div className="mode-toggle">
        <button className={mode === 'templates' ? 'active' : ''} onClick={() => handleModeSwitch('templates')}>
          Templates
        </button>
        <button className={mode === 'ai' ? 'active' : ''} onClick={() => handleModeSwitch('ai')}>
          AI Generate
        </button>
      </div>

      {mode === 'templates' ? (
        /* ── Template Mode (existing) ── */
        <>
          <div>
            <label className="editor-label">Describe Your Product & Audience</label>
            <textarea
              className="editor-input"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Product: GWork\nAudience: Enterprise HR Leaders\nProblem: low employee engagement\nGoal: behavioral change at scale`}
              style={{ fontSize: 12 }}
            />
          </div>

          <div>
            <label className="editor-label">Tone & Style</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  className={`template-btn ${tone === t.key ? 'active' : ''}`}
                  onClick={() => setTone(t.key)}
                  style={{ fontSize: 12 }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={brainstorm} disabled={aiLoading || !description.trim()}>
            {aiLoading ? 'Generating...' : 'Brainstorm 8 Variations'}
          </button>

          {aiLoading && (
            <div className="ai-loading">Generating ad variations...</div>
          )}

          {aiError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{aiError}</span>
              <button
                onClick={brainstorm}
                style={{
                  background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
                  borderRadius: 4, fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Retry
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── AI Generate Mode ── */
        <>
          <div>
            <label className="editor-label">Marketing Brief</label>
            <textarea
              className="editor-input"
              rows={6}
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Paste your marketing brief here, or upload a file below..."
              style={{ fontSize: 12 }}
            />
          </div>

          {/* File upload */}
          <div
            className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileSelect}
            />
            Drop PDF, TXT, or MD here — or click to browse
          </div>
          {fileError && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>{fileError}</div>
          )}

          <div>
            <label className="editor-label">Tone & Style</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  className={`template-btn ${tone === t.key ? 'active' : ''}`}
                  onClick={() => setTone(t.key)}
                  style={{ fontSize: 12 }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={handleAiGenerate} disabled={aiLoading}>
            {aiLoading ? 'Generating...' : 'Generate with AI'}
          </button>

          {likedVariations.length > 0 && unlikedCount > 0 && (
            <button
              onClick={handleRegenerateUnliked}
              disabled={aiLoading}
              style={{
                width: '100%', padding: '10px 16px',
                background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7',
                border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: aiLoading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              <span style={{ color: '#ef4444' }}>{'\u2764'}</span>
              Keep {likedVariations.length} liked, replace {unlikedCount} others
            </button>
          )}

          {likedVariations.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#ef4444' }}>{'\u2764'}</span>
              {likedVariations.length} liked — AI will generate similar styles
            </div>
          )}

          {aiLoading && (
            <div className="ai-loading">Generating ad variations...</div>
          )}

          {aiError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{aiError}</span>
              <button
                onClick={handleAiGenerate}
                style={{
                  background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
                  borderRadius: 4, fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                Retry
              </button>
            </div>
          )}
        </>
      )}

      {/* Undo bar */}
      {undoState && generated.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', borderRadius: 6,
          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span>{undoState.addedIds.length} variation{undoState.addedIds.length !== 1 ? 's' : ''} added</span>
          <button
            onClick={undoAdd}
            style={{
              background: 'none', border: 'none', color: 'var(--accent)',
              fontWeight: 600, cursor: 'pointer', fontSize: 12, padding: '2px 6px',
              fontFamily: 'inherit',
            }}
          >
            Undo
          </button>
        </div>
      )}

      {/* ── Results (shared between modes) ── */}
      {generated.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {selected.size} of {generated.length} selected
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={selectAll}>All</button>
              <button className="btn-secondary" onClick={selectNone}>None</button>
              <button className="btn-primary" onClick={addSelected} disabled={selected.size === 0}>
                Add Selected
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {generated.map((g, i) => {
              const { score, reasons } = scoreHeadline(g.headline);
              return (
                <label
                  key={g.id}
                  className="variation-card"
                  style={{ cursor: 'pointer', opacity: selected.has(g.id) ? 1 : 0.5 }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggleSelect(g.id)}
                    style={{ marginRight: 8 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>#{i + 1}</span>
                      <span
                        title="Ad effectiveness score based on headline clarity, emotional impact, and CTA strength"
                        style={{
                          fontSize: 10, fontWeight: 700, color: getScoreColor(score),
                          padding: '1px 6px', borderRadius: 4,
                          background: `${getScoreColor(score)}15`,
                          cursor: 'help',
                        }}
                      >
                        {score}/100
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                        {reasons.slice(0, 3).join(' \u00b7 ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{g.headline}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.paragraph}</div>
                    {g.cta && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>[{g.cta}]</div>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
