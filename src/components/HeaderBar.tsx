import { memo } from 'react';
import type { ExportFormat } from '../hooks/useExport';

interface Props {
  dims: { w: number; h: number };
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  variationCount: number;
  onOpenSettings: () => void;
  // Export
  exportFormat: ExportFormat;
  onExportFormatChange: (f: ExportFormat) => void;
  jpegQuality: number;
  onJpegQualityChange: (q: number) => void;
  filenamePattern: string;
  onFilenamePatternChange: (p: string) => void;
  showExportSettings: boolean;
  onToggleExportSettings: () => void;
  exportDropdownRef: React.RefObject<HTMLDivElement | null>;
  exporting: boolean;
  exportProgress: { current: number; total: number };
  onExportSingle: () => void;
  onExportBulk: () => void;
  onExportBatchResize: () => void;
  onPublishMeta: () => void;
  onBulkPublishMeta: () => void;
}

export const HeaderBar = memo(function HeaderBar(props: Props) {
  const {
    dims, theme, onThemeToggle, canUndo, canRedo, onUndo, onRedo,
    variationCount, onOpenSettings,
    exportFormat, onExportFormatChange, jpegQuality, onJpegQualityChange,
    filenamePattern, onFilenamePatternChange,
    showExportSettings, onToggleExportSettings, exportDropdownRef,
    exporting, exportProgress, onExportSingle, onExportBulk, onExportBatchResize,
    onPublishMeta,
    onBulkPublishMeta,
  } = props;

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="logo-icon" />
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}
            className="text-primary">
            Ad Creative Generator
          </h1>
          <p style={{ margin: 0, fontSize: 12 }} className="text-muted">
            Bulk Meta ad creatives &mdash; {dims.w}&times;{dims.h}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Undo/Redo */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-icon" onClick={onUndo} disabled={!canUndo}
            title="Undo (Ctrl+Z)" aria-label="Undo">&#x21A9;</button>
          <button className="btn-icon" onClick={onRedo} disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)" aria-label="Redo">&#x21AA;</button>
        </div>

        <div className="header-divider" />

        <button className="btn-icon"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          &#x2699;
        </button>

        <button className="btn-icon"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>

        <div className="header-divider" />

        {/* Export dropdown — format settings + all export actions */}
        <div style={{ position: 'relative' }} ref={exportDropdownRef}>
          <button className="btn-secondary"
            onClick={onToggleExportSettings}
            style={{ fontSize: 12 }}
            aria-expanded={showExportSettings}
            aria-haspopup="true"
          >
            Export &#x25BE;
          </button>
          {showExportSettings && (
            <div className="export-dropdown">
              <label className="editor-label">Format</label>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {(['png', 'jpeg'] as const).map((f) => (
                  <button key={f} className={`template-btn ${exportFormat === f ? 'active' : ''}`}
                    onClick={() => onExportFormatChange(f)} style={{ fontSize: 11, padding: '4px 10px' }}>
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              {exportFormat === 'jpeg' && (
                <>
                  <label className="editor-label">Quality: {jpegQuality}%</label>
                  <input type="range" min={10} max={100} value={jpegQuality}
                    onChange={(e) => onJpegQualityChange(Number(e.target.value))}
                    style={{ width: '100%' }}
                    aria-label="JPEG quality" />
                </>
              )}
              <label className="editor-label" style={{ marginTop: 8 }}>Filename Pattern</label>
              <input className="editor-input" value={filenamePattern}
                onChange={(e) => onFilenamePatternChange(e.target.value)}
                placeholder="{brand}_{template}_{num}"
                style={{ fontSize: 11 }} />
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                {'{brand}'} {'{template}'} {'{num}'} {'{headline}'} {'{ratio}'}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn-secondary" onClick={() => { onExportSingle(); onToggleExportSettings(); }}
                  disabled={exporting} style={{ width: '100%', fontSize: 12, textAlign: 'left' }} title="Ctrl+S">
                  {exporting && exportProgress.total === 0 ? 'Exporting...' : 'Export Current'}
                </button>
                <button className="btn-secondary" onClick={() => { onExportBatchResize(); onToggleExportSettings(); }}
                  disabled={exporting} style={{ width: '100%', fontSize: 12, textAlign: 'left' }}
                  title="Export in all aspect ratios">
                  Export All Sizes
                </button>
                <button className="btn-primary" onClick={() => { onExportBulk(); onToggleExportSettings(); }}
                  disabled={variationCount === 0 || exporting}
                  style={{ width: '100%', fontSize: 12, textAlign: 'left' }} title="Ctrl+Shift+S">
                  {exporting && exportProgress.total > 0
                    ? `Exporting ${exportProgress.current}/${exportProgress.total}...`
                    : `Export All Variations (${variationCount}) ZIP`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="header-divider" />

        <button className="btn-secondary" onClick={onPublishMeta}
          style={{ fontSize: 12, background: 'rgba(24,119,242,0.15)', borderColor: 'rgba(24,119,242,0.4)' }}>
          Publish to Meta
        </button>
        <button className="btn-secondary" onClick={onBulkPublishMeta}
          disabled={variationCount < 2}
          style={{ fontSize: 12, background: 'rgba(24,119,242,0.25)', borderColor: 'rgba(24,119,242,0.5)', fontWeight: 600 }}>
          Bulk Publish ({variationCount})
        </button>
      </div>
    </header>
  );
});
