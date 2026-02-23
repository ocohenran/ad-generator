import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { AdPreview } from './components/AdPreview';
import { EditorPanel } from './components/EditorPanel';
import { BulkPanel } from './components/BulkPanel';
import { BrainstormPanel } from './components/BrainstormPanel';
import { ComparisonMode } from './components/ComparisonMode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeaderBar } from './components/HeaderBar';
import { ApiKeyModal } from './components/ApiKeyModal';
import { LazyThumb } from './components/LazyThumb';
import { useHistory } from './hooks/useHistory';
import { useSaveToStorage, loadFromStorage, loadArrayFromStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useExport, type ExportFormat } from './hooks/useExport';
import { DEFAULT_CONFIG, SAMPLE_VARIATIONS, ASPECT_DIMENSIONS } from './types';
import type { AdVariation, Theme } from './types';
import './App.css';

type Tab = 'editor' | 'bulk' | 'brainstorm';

function App() {
  const {
    state: config,
    set: setConfig,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetConfig,
  } = useHistory(loadFromStorage('config', DEFAULT_CONFIG));

  const [variations, setVariations] = useState<AdVariation[]>(
    () => loadArrayFromStorage('variations', SAMPLE_VARIATIONS)
  );
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('ad-gen:theme') as Theme) || 'dark'
  );
  const [showComparison, setShowComparison] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [jpegQuality, setJpegQuality] = useState(92);
  const [filenamePattern, setFilenamePattern] = useState('{brand}_{template}_{num}');
  const [showExportSettings, setShowExportSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeVariation, setActiveVariation] = useState<AdVariation | null>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Persist state
  useSaveToStorage('config', config);
  useSaveToStorage('variations', variations);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ad-gen:theme', theme);
  }, [theme]);

  // Click-outside to close export dropdown
  useEffect(() => {
    if (!showExportSettings) return;
    const handleClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportSettings]);

  const dims = ASPECT_DIMENSIONS[config.aspectRatio];
  const previewScale = useMemo(() => {
    const maxW = sidebarCollapsed ? 700 : 540;
    const maxH = 540;
    return Math.min(maxW / dims.w, maxH / dims.h, 0.5);
  }, [dims, sidebarCollapsed]);

  // Export hook — no renderRef needed, creates offscreen containers on demand
  const {
    exporting, exportProgress, exportError, clearError,
    exportSingle, exportBulk, exportBatchResize,
  } = useExport({
    config,
    variations,
    format: exportFormat,
    jpegQuality,
    filenamePattern,
    activeVariation,
  });

  // Auto-dismiss export error after 5s
  useEffect(() => {
    if (!exportError) return;
    const t = setTimeout(clearError, 5000);
    return () => clearTimeout(t);
  }, [exportError, clearError]);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => ({
    undo,
    redo,
    exportSingle,
    exportBulk,
    toggleEditor: () => setSidebarCollapsed((p) => !p),
  }), [undo, redo, exportSingle, exportBulk]);

  useKeyboardShortcuts(shortcuts);

  const handleThemeToggle = useCallback(() => {
    setTheme((t) => t === 'dark' ? 'light' : 'dark');
  }, []);

  const handleReset = useCallback(() => {
    if (window.confirm('Reset all settings to defaults?')) {
      resetConfig(DEFAULT_CONFIG);
    }
  }, [resetConfig]);

  const handleThumbClick = useCallback((v: AdVariation) => {
    setActiveVariation((prev) => prev?.id === v.id ? null : v);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app" data-theme={theme}>
        {/* Export error toast */}
        {exportError && (
          <div className="export-toast" role="alert">
            <span>{exportError}</span>
            <button onClick={clearError} aria-label="Dismiss error">&times;</button>
          </div>
        )}

        {/* Comparison overlay */}
        {showSettings && <ApiKeyModal onClose={() => setShowSettings(false)} />}

        {showComparison && variations.length >= 2 && (
          <ComparisonMode
            config={config}
            variations={variations}
            onClose={() => setShowComparison(false)}
          />
        )}

        <HeaderBar
          dims={dims}
          theme={theme}
          onThemeToggle={handleThemeToggle}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onReset={handleReset}
          variationCount={variations.length}
          onCompare={() => setShowComparison(true)}
          onOpenSettings={() => setShowSettings(true)}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          jpegQuality={jpegQuality}
          onJpegQualityChange={setJpegQuality}
          filenamePattern={filenamePattern}
          onFilenamePatternChange={setFilenamePattern}
          showExportSettings={showExportSettings}
          onToggleExportSettings={() => setShowExportSettings((p) => !p)}
          exportDropdownRef={exportDropdownRef}
          exporting={exporting}
          exportProgress={exportProgress}
          onExportSingle={exportSingle}
          onExportBulk={exportBulk}
          onExportBatchResize={exportBatchResize}
        />

        <div className="app-body">
          {/* Left: Controls */}
          {!sidebarCollapsed && (
            <aside className="sidebar">
              <div className="tab-bar" role="tablist">
                {([['editor', 'Template'], ['bulk', 'Bulk Generate'], ['brainstorm', 'Brainstorm']] as const).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      className={`tab-btn ${activeTab === key ? 'active' : ''}`}
                      onClick={() => setActiveTab(key)}
                      role="tab"
                      aria-selected={activeTab === key}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              <div className="sidebar-content" role="tabpanel">
                {activeTab === 'editor' && <EditorPanel config={config} onChange={setConfig} />}
                {activeTab === 'bulk' && <BulkPanel variations={variations} onVariationsChange={setVariations} />}
                {activeTab === 'brainstorm' && (
                  <BrainstormPanel
                    onAdd={(newVars) => setVariations((prev) => [...prev, ...newVars])}
                  />
                )}
              </div>
            </aside>
          )}

          {/* Collapse toggle */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((p) => !p)}
            title="Toggle sidebar (Ctrl+E)"
            aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? '\u25B6' : '\u25C0'}
          </button>

          {/* Right: Preview */}
          <main className="preview-area">
            <div className="preview-label">
              Live Preview &mdash; {dims.w} &times; {dims.h}
              {activeVariation && <span style={{ color: 'var(--accent)' }}>(Variation selected)</span>}
              <span className="shortcut-hint">Ctrl+Z undo &middot; Ctrl+S export</span>
            </div>
            <div className="preview-container">
              <div className="preview-scaled" style={{ transition: 'all 0.3s ease' }}>
                <ErrorBoundary>
                  <AdPreview
                    config={config}
                    headline={activeVariation?.headline}
                    paragraph={activeVariation?.paragraph}
                    scale={previewScale}
                  />
                </ErrorBoundary>
              </div>
            </div>

            {/* Variation thumbnails */}
            {variations.length > 0 ? (
              <div className="variations-grid">
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }} className="text-secondary">
                  All Variations Preview
                  {activeVariation && (
                    <button
                      className="btn-secondary"
                      onClick={() => setActiveVariation(null)}
                      style={{ marginLeft: 12, fontSize: 11, padding: '2px 8px' }}
                    >
                      Clear Selection
                    </button>
                  )}
                </h3>
                <div className="thumb-grid" role="listbox" aria-label="Ad variations">
                  {variations.map((v, i) => (
                    <LazyThumb
                      key={v.id}
                      config={config}
                      variation={v}
                      index={i}
                      isActive={activeVariation?.id === v.id}
                      onClick={handleThumbClick}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ marginTop: 40 }}>
                <div className="empty-state-icon">{'\ud83c\udfa8'}</div>
                <div className="empty-state-text">No variations yet</div>
                <div className="empty-state-sub">
                  Use the Bulk or Brainstorm tab to generate ad copy variations
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
