import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { AdPreview } from './components/AdPreview';
import { EditorPanel } from './components/EditorPanel';
import { BulkPanel } from './components/BulkPanel';
import { BrainstormPanel } from './components/BrainstormPanel';
import { ResearchPanel, INITIAL_RESEARCH_STATE } from './components/ResearchPanel';
import type { ResearchState } from './components/ResearchPanel';
import { MetaFeedPreview } from './components/MetaFeedPreview';
import { ComparisonMode } from './components/ComparisonMode';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeaderBar } from './components/HeaderBar';
import { ApiKeyModal } from './components/ApiKeyModal';
import { MetaPublishModal } from './components/MetaPublishModal';
import { BulkMetaPublishModal } from './components/BulkMetaPublishModal';
import { LandingPageModal } from './components/LandingPageModal';
import { PerformancePanel } from './components/PerformancePanel';
import type { PublishedAdWithMetrics } from './lib/metaApi';
import { LazyThumb } from './components/LazyThumb';
import { useHistory } from './hooks/useHistory';
import { useSaveToStorage, loadFromStorage, loadArrayFromStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useExport, type ExportFormat } from './hooks/useExport';
import { DEFAULT_CONFIG, SAMPLE_VARIATIONS, ASPECT_DIMENSIONS } from './types';
import type { AdVariation, Theme } from './types';
import './App.css';

type Tab = 'editor' | 'bulk' | 'brainstorm' | 'research' | 'performance';

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
  const [researchBrief, setResearchBrief] = useState<string | undefined>();
  const [researchState, setResearchState] = useState<ResearchState>(INITIAL_RESEARCH_STATE);
  const [showFeedPreview, setShowFeedPreview] = useState(false);
  const [showMetaPublish, setShowMetaPublish] = useState(false);
  const [showBulkMetaPublish, setShowBulkMetaPublish] = useState(false);
  const [landingPageAd, setLandingPageAd] = useState<PublishedAdWithMetrics | null>(null);
  const [metaCopied, setMetaCopied] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('ad-gen:liked');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Persist state
  useSaveToStorage('config', config);
  useSaveToStorage('variations', variations);

  useEffect(() => {
    localStorage.setItem('ad-gen:liked', JSON.stringify([...likedIds]));
  }, [likedIds]);

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
    exportSingle, exportBulk, exportBatchResize, getImageBlob, getVariationBlob,
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

  const handleThumbClick = useCallback((v: AdVariation) => {
    setActiveVariation((prev) => prev?.id === v.id ? null : v);
  }, []);

  const handleToggleLike = useCallback((id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const likedVariations = useMemo(
    () => variations.filter((v) => likedIds.has(v.id)),
    [variations, likedIds],
  );

  const handleSendToBrief = useCallback((brief: string) => {
    setResearchBrief(brief);
    setActiveTab('brainstorm');
  }, []);

  const handleRemixWinner = useCallback((brief: string) => {
    setResearchBrief(brief);
    setActiveTab('brainstorm');
  }, []);

  const handleCopyToMeta = useCallback(() => {
    const h = activeVariation?.headline ?? config.headline;
    const p = activeVariation?.paragraph ?? config.paragraph;
    const d = activeVariation?.cta ?? config.ctaText;
    const text = `Primary Text: ${p}\nHeadline: ${h}\nDescription: ${d}`;
    navigator.clipboard.writeText(text).then(() => {
      setMetaCopied(true);
      setTimeout(() => setMetaCopied(false), 2000);
    }).catch(() => {
      console.warn('Clipboard write failed');
    });
  }, [activeVariation, config]);

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

        {landingPageAd && (
          <LandingPageModal
            ad={landingPageAd}
            onClose={() => setLandingPageAd(null)}
          />
        )}

        {showMetaPublish && (
          <MetaPublishModal
            onClose={() => setShowMetaPublish(false)}
            getImageBlob={getImageBlob}
            headline={activeVariation?.headline ?? config.headline}
            body={activeVariation?.paragraph ?? config.paragraph}
            ctaText={activeVariation?.cta ?? config.ctaText}
            variationId={activeVariation?.id}
          />
        )}

        {showBulkMetaPublish && (
          <BulkMetaPublishModal
            onClose={() => setShowBulkMetaPublish(false)}
            variations={variations}
            config={config}
            getVariationBlob={getVariationBlob}
          />
        )}

        {showComparison && variations.length >= 2 && (
          <ComparisonMode
            config={config}
            variations={variations}
            likedIds={likedIds}
            onClose={() => setShowComparison(false)}
            onExportLiked={() => {
              const liked = variations.filter((v) => likedIds.has(v.id));
              if (liked.length === 0) return;
              exportBulk();
            }}
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
          variationCount={variations.length}
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
          onPublishMeta={() => setShowMetaPublish(true)}
          onBulkPublishMeta={() => setShowBulkMetaPublish(true)}
        />

        <div className="app-body">
          {/* Left: Controls */}
          {!sidebarCollapsed && (
            <aside className="sidebar">
              <div className="tab-bar" role="tablist">
                {([['editor', 'Design'], ['brainstorm', 'Brainstorm'], ['bulk', 'Bulk Generate'], ['research', 'Research'], ['performance', 'Performance']] as const).map(
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
                {activeTab === 'research' && (
                  <ResearchPanel
                    state={researchState}
                    onStateChange={setResearchState}
                    onSendToBrief={handleSendToBrief}
                  />
                )}
                {activeTab === 'editor' && <EditorPanel config={config} onChange={setConfig} />}
                {activeTab === 'bulk' && <BulkPanel variations={variations} onVariationsChange={setVariations} />}
                {activeTab === 'brainstorm' && (
                  <BrainstormPanel
                    onAdd={(newVars) => setVariations((prev) => [...prev, ...newVars])}
                    onRemoveLast={(ids) => setVariations((prev) => prev.filter((v) => !ids.includes(v.id)))}
                    initialBrief={researchBrief}
                    likedVariations={likedVariations}
                  />
                )}
                {activeTab === 'performance' && (
                  <PerformancePanel onRemixWinner={handleRemixWinner} onGenerateLandingPage={setLandingPageAd} />
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
              <button
                className={`btn-secondary ${showFeedPreview ? 'active' : ''}`}
                onClick={() => setShowFeedPreview((p) => !p)}
                style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 10px' }}
              >
                {showFeedPreview ? 'Canvas View' : 'Feed Preview'}
              </button>
              <button
                className="btn-secondary"
                onClick={handleCopyToMeta}
                style={{ fontSize: 11, padding: '2px 10px' }}
              >
                {metaCopied ? 'Copied!' : 'Copy for Meta'}
              </button>
              {likedIds.size >= 2 && (
                <button
                  className="btn-secondary"
                  onClick={() => setShowComparison(true)}
                  style={{ fontSize: 11, padding: '2px 10px', color: 'var(--accent)' }}
                >
                  Compare Liked ({likedIds.size})
                </button>
              )}
              <span className="shortcut-hint">Ctrl+Z undo &middot; Ctrl+S export</span>
            </div>
            <div className="preview-container">
              <div className="preview-scaled" style={{ transition: 'all 0.3s ease' }}>
                <ErrorBoundary>
                  {showFeedPreview ? (
                    <MetaFeedPreview
                      config={config}
                      headline={activeVariation?.headline}
                      paragraph={activeVariation?.paragraph}
                      cta={activeVariation?.cta}
                      scale={previewScale}
                    />
                  ) : (
                    <AdPreview
                      config={config}
                      headline={activeVariation?.headline}
                      paragraph={activeVariation?.paragraph}
                      cta={activeVariation?.cta}
                      scale={previewScale}
                    />
                  )}
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
                      isLiked={likedIds.has(v.id)}
                      onClick={handleThumbClick}
                      onToggleLike={handleToggleLike}
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
