import { useRef, useState, useEffect } from 'react';
import type { AdConfig, AspectRatio, TemplateType, LayoutVariant } from '../types';
import { FONT_OPTIONS, DEFAULT_CONFIG } from '../types';

interface Props {
  config: AdConfig;
  onChange: (config: AdConfig) => void;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
      />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
    </label>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="editor-label">{label}</label>
      {children}
    </div>
  );
}

function CharCount({ value, limit, label, onTruncate }: { value: string; limit: number; label: string; onTruncate?: () => void }) {
  const len = value.length;
  const color = len <= limit ? 'var(--success, #22c55e)' : len <= limit * 1.2 ? 'var(--warning, #f59e0b)' : 'var(--danger, #ef4444)';
  return (
    <span style={{ fontSize: 11, color, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
      {len}/{limit} chars {len > limit ? `(${label} truncates at ${limit})` : ''}
      {len > limit && onTruncate && (
        <button
          onClick={onTruncate}
          style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 4,
            background: 'var(--danger, #ef4444)', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          Trim
        </button>
      )}
    </span>
  );
}

function truncateAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const trimmed = text.slice(0, limit);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > limit * 0.6 ? trimmed.slice(0, lastSpace) : trimmed;
}

function PresetSwatch({ preset }: { preset: AdConfig }) {
  const colors = [preset.gradientFrom, preset.gradientMid ?? preset.gradientFrom, preset.gradientTo, preset.ctaColor];
  return (
    <span style={{ display: 'inline-flex', gap: 1, marginRight: 4, verticalAlign: 'middle' }}>
      {colors.map((c, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: 2, background: c, display: 'inline-block' }} />
      ))}
    </span>
  );
}

const PRESETS_KEY = 'ad-gen:presets';
const BUILTIN_PRESETS: Record<string, AdConfig> = {
  'GWork Dark': DEFAULT_CONFIG,
  'GWork Light': {
    ...DEFAULT_CONFIG,
    gradientFrom: '#E0E7FF',
    gradientMid: '#C7D2FE',
    gradientTo: '#F5F3FF',
    headlineColor: '#1e1b4b',
    paragraphColor: '#334155',
    ctaColor: '#7C3AED',
    ctaTextColor: '#ffffff',
  },
};

function loadPresets(): Record<string, AdConfig> {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePresets(presets: Record<string, AdConfig>) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

const TEMPLATES: { key: TemplateType; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'before-after', label: 'Before/After' },
  { key: 'testimonial', label: 'Testimonial' },
  { key: 'stats', label: 'Stats' },
  { key: 'product-spotlight', label: 'Spotlight' },
  { key: 'bold-statement', label: 'Bold Statement' },
];

const RATIOS: { key: AspectRatio; label: string }[] = [
  { key: '1:1', label: '1:1 Feed' },
  { key: '4:5', label: '4:5 Feed' },
  { key: '9:16', label: '9:16 Story' },
  { key: '16:9', label: '16:9 Wide' },
];

export function EditorPanel({ config, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [customPresets, setCustomPresets] = useState<Record<string, AdConfig>>(loadPresets);
  const allPresets = { ...BUILTIN_PRESETS, ...customPresets };

  useEffect(() => {
    savePresets(customPresets);
  }, [customPresets]);

  const handleSavePreset = () => {
    const name = window.prompt('Preset name:');
    if (!name?.trim()) return;
    setCustomPresets((prev) => ({ ...prev, [name.trim()]: { ...config } }));
  };

  const handleLoadPreset = (name: string) => {
    const preset = allPresets[name];
    if (preset) onChange({ ...preset });
  };

  const handleDeletePreset = (name: string) => {
    if (name in BUILTIN_PRESETS) return;
    setCustomPresets((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleExportPresets = () => {
    const data = JSON.stringify({ ...BUILTIN_PRESETS, ...customPresets }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ad-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPresets = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as Record<string, AdConfig>;
        setCustomPresets((prev) => ({ ...prev, ...imported }));
      } catch {
        alert('Invalid preset file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const update = <K extends keyof AdConfig>(key: K, value: AdConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      alert('Image must be under 5 MB. Please compress or resize it first.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update('backgroundImage', reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    update('backgroundImage', null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Template selector */}
      <Section label="Template Style">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              className={`template-btn ${config.template === t.key ? 'active' : ''}`}
              onClick={() => update('template', t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Presets */}
      <Section label="Presets">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {Object.entries(allPresets).map(([name, preset]) => (
            <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button
                className="template-btn"
                onClick={() => handleLoadPreset(name)}
                style={{ fontSize: 11 }}
              >
                <PresetSwatch preset={preset} />
                {name}
              </button>
              {!(name in BUILTIN_PRESETS) && (
                <button
                  onClick={() => handleDeletePreset(name)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)',
                    cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1,
                  }}
                  title={`Delete "${name}"`}
                >
                  &times;
                </button>
              )}
            </span>
          ))}
          <button className="btn-secondary" onClick={handleSavePreset} style={{ fontSize: 11, padding: '3px 8px' }}>
            Save As...
          </button>
          <button className="btn-secondary" onClick={handleExportPresets} style={{ fontSize: 11, padding: '3px 8px' }}>
            Export
          </button>
          <input ref={importRef} type="file" accept=".json" onChange={handleImportPresets} style={{ display: 'none' }} />
          <button className="btn-secondary" onClick={() => importRef.current?.click()} style={{ fontSize: 11, padding: '3px 8px' }}>
            Import
          </button>
        </div>
      </Section>

      {/* Aspect Ratio */}
      <Section label="Aspect Ratio">
        <div style={{ display: 'flex', gap: 6 }}>
          {RATIOS.map((r) => (
            <button
              key={r.key}
              className={`template-btn ${config.aspectRatio === r.key ? 'active' : ''}`}
              onClick={() => update('aspectRatio', r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Font */}
      <Section label="Font">
        <select
          className="editor-input"
          value={config.fontFamily}
          onChange={(e) => update('fontFamily', e.target.value)}
          style={{ cursor: 'pointer' }}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </Section>

      {/* Headline Font (optional override) */}
      <Section label="Headline Font">
        <select
          className="editor-input"
          value={config.headlineFontFamily ?? ''}
          onChange={(e) => update('headlineFontFamily', e.target.value || undefined)}
          style={{ cursor: 'pointer' }}
        >
          <option value="">Same as body font</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </Section>

      {/* Layout Variant */}
      <Section label="Layout">
        <div style={{ display: 'flex', gap: 6 }}>
          {(['centered', 'asymmetric'] as LayoutVariant[]).map((v) => (
            <button
              key={v}
              className={`template-btn ${(config.layoutVariant ?? 'asymmetric') === v ? 'active' : ''}`}
              onClick={() => update('layoutVariant', v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </Section>

      {/* Accent Glow */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={config.accentGlow ?? true}
          onChange={(e) => update('accentGlow', e.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Accent glow effects</span>
      </label>

      {/* Background Image */}
      <Section label="Background Image">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            {config.backgroundImage ? 'Change Image' : 'Upload Image'}
          </button>
          {config.backgroundImage && (
            <>
              <button className="btn-secondary" onClick={removeImage} style={{ color: 'var(--danger)' }}>
                Remove
              </button>
              <div style={{
                width: 32, height: 32, borderRadius: 4, overflow: 'hidden',
                border: '1px solid var(--border)',
              }}>
                <img src={config.backgroundImage} alt="" style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                }} />
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Template-specific background controls */}
      {config.template === 'standard' && (
        <Section label="Gradient">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <ColorInput label="From" value={config.gradientFrom} onChange={(v) => update('gradientFrom', v)} />
              <ColorInput label="Mid" value={config.gradientMid ?? config.gradientFrom} onChange={(v) => update('gradientMid', v)} />
              <ColorInput label="To" value={config.gradientTo} onChange={(v) => update('gradientTo', v)} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 40 }}>Angle</span>
              <input
                type="range" min={0} max={360}
                value={config.gradientAngle}
                onChange={(e) => update('gradientAngle', Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 30 }}>{config.gradientAngle}&deg;</span>
            </label>
          </div>
        </Section>
      )}

      {config.template === 'before-after' && (
        <Section label="Panel Colors">
          <div style={{ display: 'flex', gap: 16 }}>
            <ColorInput label="Before BG" value={config.beforeBg} onChange={(v) => update('beforeBg', v)} />
            <ColorInput label="After BG" value={config.afterBg} onChange={(v) => update('afterBg', v)} />
          </div>
        </Section>
      )}

      {config.template === 'testimonial' && (
        <>
          <Section label="Testimonial Background">
            <div style={{ display: 'flex', gap: 16 }}>
              <ColorInput label="BG" value={config.testimonialBg} onChange={(v) => update('testimonialBg', v)} />
            </div>
          </Section>
          <Section label="Quote">
            <textarea className="editor-input" rows={3} value={config.testimonialQuote}
              onChange={(e) => update('testimonialQuote', e.target.value)} placeholder="Testimonial quote" />
          </Section>
          <Section label="Author">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="editor-input" value={config.testimonialAuthor}
                onChange={(e) => update('testimonialAuthor', e.target.value)} placeholder="Name" style={{ flex: 1 }} />
              <input className="editor-input" value={config.testimonialRole}
                onChange={(e) => update('testimonialRole', e.target.value)} placeholder="Role" style={{ flex: 1 }} />
            </div>
          </Section>
        </>
      )}

      {config.template === 'stats' && (
        <Section label="Stats">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="editor-input" value={config.statValue}
                onChange={(e) => update('statValue', e.target.value)} placeholder="34%" style={{ flex: 1 }} />
              <input className="editor-input" value={config.statLabel}
                onChange={(e) => update('statLabel', e.target.value)} placeholder="Label" style={{ flex: 2 }} />
            </div>
            <textarea className="editor-input" rows={2} value={config.statSubtext}
              onChange={(e) => update('statSubtext', e.target.value)} placeholder="Supporting context" />
            <div style={{ display: 'flex', gap: 16 }}>
              <ColorInput label="BG" value={config.statBg} onChange={(v) => update('statBg', v)} />
              <ColorInput label="Accent" value={config.statAccent} onChange={(v) => update('statAccent', v)} />
            </div>
          </div>
        </Section>
      )}

      {config.template === 'product-spotlight' && (
        <Section label="Spotlight Colors">
          <div style={{ display: 'flex', gap: 16 }}>
            <ColorInput label="BG" value={config.spotlightBg} onChange={(v) => update('spotlightBg', v)} />
            <ColorInput label="Accent" value={config.spotlightAccent} onChange={(v) => update('spotlightAccent', v)} />
          </div>
        </Section>
      )}

      {/* Brand */}
      <Section label="Brand">
        <input className="editor-input" value={config.logoText}
          onChange={(e) => update('logoText', e.target.value)} placeholder="Logo text" />
      </Section>

      {/* Headline */}
      <Section label="Headline">
        <textarea className="editor-input" rows={2} value={config.headline}
          onChange={(e) => update('headline', e.target.value)} placeholder="Ad headline" />
        <CharCount value={config.headline} limit={40} label="Meta headline"
          onTruncate={() => update('headline', truncateAtWord(config.headline, 40))} />
      </Section>

      {/* Paragraph */}
      <Section label="Supporting Text">
        <textarea className="editor-input" rows={3} value={config.paragraph}
          onChange={(e) => update('paragraph', e.target.value)} placeholder="Supporting paragraph" />
        <CharCount value={config.paragraph} limit={125} label="Meta primary text"
          onTruncate={() => update('paragraph', truncateAtWord(config.paragraph, 125))} />
      </Section>

      {/* CTA */}
      <Section label="Call to Action">
        <input className="editor-input" value={config.ctaText}
          onChange={(e) => update('ctaText', e.target.value)} placeholder="CTA text" />
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <ColorInput label="Button" value={config.ctaColor} onChange={(v) => update('ctaColor', v)} />
          <ColorInput label="Text" value={config.ctaTextColor} onChange={(v) => update('ctaTextColor', v)} />
        </div>
      </Section>

      {/* Colors */}
      <Section label="Text Colors">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ColorInput label="Headline" value={config.headlineColor} onChange={(v) => update('headlineColor', v)} />
          <ColorInput label="Body" value={config.paragraphColor} onChange={(v) => update('paragraphColor', v)} />
        </div>
      </Section>

      {/* Before/After labels */}
      {config.template === 'before-after' && (
        <Section label="Panel Labels">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="editor-input" value={config.beforeLabel}
              onChange={(e) => update('beforeLabel', e.target.value)} placeholder="Before label" style={{ flex: 1 }} />
            <input className="editor-input" value={config.afterLabel}
              onChange={(e) => update('afterLabel', e.target.value)} placeholder="After label" style={{ flex: 1 }} />
          </div>
        </Section>
      )}

      {/* Grain */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
        <input type="checkbox" checked={config.showGrain}
          onChange={(e) => update('showGrain', e.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Grain texture overlay</span>
      </label>
    </div>
  );
}
