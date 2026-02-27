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
    (localStorage.getItem('ad-gen:theme') as Theme) || 'light'
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

  // Recent projects
  interface RecentProject {
    name: string;
    savedAt: string;
    variationCount: number;
    data: { config: typeof config; variations: AdVariation[]; likedIds: string[]; researchBrief?: string; version: number; presets?: Record<string, unknown> };
  }

  const loadRecentProjects = useCallback((): RecentProject[] => {
    try {
      const raw = localStorage.getItem('ad-gen:recent-projects');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(loadRecentProjects);

  const addRecentProject = useCallback((name: string, data: RecentProject['data']) => {
    const entry: RecentProject = {
      name,
      savedAt: new Date().toISOString(),
      variationCount: data.variations.length,
      // Strip backgroundImage from stored data to keep localStorage lean
      data: {
        ...data,
        config: (() => {
          const { backgroundImage: _, ...rest } = data.config as Record<string, unknown>;
          void _;
          return rest as typeof config;
        })(),
      },
    };
    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.name !== name);
      const next = [entry, ...filtered].slice(0, 5);
      try { localStorage.setItem('ad-gen:recent-projects', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Persist state
  const { dirty: configDirty } = useSaveToStorage('config', config);
  const { dirty: variationsDirty } = useSaveToStorage('variations', variations);

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

  const handleSaveProject = useCallback(() => {
    // Read custom presets from localStorage for inclusion
    let presets: Record<string, unknown> | undefined;
    try {
      const raw = localStorage.getItem('ad-gen:presets');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
          presets = parsed;
        }
      }
    } catch { /* ignore */ }

    const projectData = {
      version: 2 as const,
      savedAt: new Date().toISOString(),
      config,
      variations,
      likedIds: [...likedIds],
      researchBrief,
      ...(presets ? { presets } : {}),
    };
    const json = JSON.stringify(projectData, null, 2);

    // Warn if file is very large (>2MB, likely due to backgroundImage)
    if (json.length > 2 * 1024 * 1024) {
      if (!confirm(`Project file is ${(json.length / 1024 / 1024).toFixed(1)}MB (large background image). Continue?`)) return;
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeName = config.logoText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() || 'project';
    a.href = url;
    a.download = `ad-project-${safeName}-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addRecentProject(safeName, projectData);
  }, [config, variations, likedIds, researchBrief, addRecentProject]);

  // Undo-for-load state
  const [preLoadSnapshot, setPreLoadSnapshot] = useState<{
    config: typeof config;
    variations: AdVariation[];
    likedIds: Set<string>;
    researchBrief: string | undefined;
  } | null>(null);
  const [loadToast, setLoadToast] = useState(false);
  const loadToastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Preset version counter — forces EditorPanel remount on preset merge
  const [presetVersion, setPresetVersion] = useState(0);

  const undoLoadProject = useCallback(() => {
    if (!preLoadSnapshot) return;
    setConfig(preLoadSnapshot.config);
    setVariations(preLoadSnapshot.variations);
    setLikedIds(preLoadSnapshot.likedIds);
    setResearchBrief(preLoadSnapshot.researchBrief);
    setPreLoadSnapshot(null);
    setLoadToast(false);
    clearTimeout(loadToastTimer.current);
  }, [preLoadSnapshot, setConfig]);

  const handleLoadProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data || (data.version !== 1 && data.version !== 2) || !data.config || !Array.isArray(data.variations)) {
          alert('Invalid project file. Please select a valid .json project file.');
          return;
        }

        // Snapshot current state for undo
        setPreLoadSnapshot({ config, variations, likedIds, researchBrief });

        // Apply loaded data
        setConfig(data.config);
        setVariations(data.variations);
        setLikedIds(new Set(Array.isArray(data.likedIds) ? data.likedIds : []));
        if (data.researchBrief !== undefined) setResearchBrief(data.researchBrief);
        setActiveVariation(null);

        // Add to recent projects
        const safeName = (data.config.logoText || 'project').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        addRecentProject(safeName, data);

        // Merge presets if v2 project has them
        if (data.version === 2 && data.presets && typeof data.presets === 'object') {
          try {
            const existing = JSON.parse(localStorage.getItem('ad-gen:presets') || '{}');
            const merged = { ...existing, ...data.presets };
            localStorage.setItem('ad-gen:presets', JSON.stringify(merged));
            setPresetVersion((v) => v + 1);
          } catch { /* ignore preset merge failures */ }
        }

        // Show undo toast
        setLoadToast(true);
        clearTimeout(loadToastTimer.current);
        loadToastTimer.current = setTimeout(() => {
          setLoadToast(false);
          setPreLoadSnapshot(null);
        }, 8000);
      } catch {
        alert('Could not parse project file. The file may be corrupted.');
      }
    };
    reader.readAsText(file);
  }, [config, variations, likedIds, researchBrief, setConfig, addRecentProject]);

  // Drag-and-drop project load
  const [projectDragOver, setProjectDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setProjectDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setProjectDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setProjectDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.json')) {
      handleLoadProject(file);
    }
  }, [handleLoadProject]);

  const handleLoadRecentProject = useCallback((recent: RecentProject) => {
    const file = new File(
      [JSON.stringify(recent.data)],
      `${recent.name}.json`,
      { type: 'application/json' },
    );
    handleLoadProject(file);
  }, [handleLoadProject]);

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
      <div className="app" data-theme={theme}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Export error toast */}
        {exportError && (
          <div className="export-toast" role="alert">
            <span>{exportError}</span>
            <button onClick={clearError} aria-label="Dismiss error">&times;</button>
          </div>
        )}

        {/* Load undo toast */}
        {loadToast && (
          <div className="export-toast export-toast--undo" role="status">
            <span>Project loaded</span>
            <button onClick={undoLoadProject} style={{ fontSize: 13, fontWeight: 600 }}>Undo</button>
            <button onClick={() => { setLoadToast(false); setPreLoadSnapshot(null); }} aria-label="Dismiss">&times;</button>
          </div>
        )}

        {/* Drag-and-drop overlay */}
        {projectDragOver && (
          <div className="project-drop-overlay">
            <div>Drop .json project file to load</div>
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
          onSaveProject={handleSaveProject}
          onLoadProject={handleLoadProject}
          isDirty={configDirty || variationsDirty}
          recentProjects={recentProjects}
          onLoadRecentProject={handleLoadRecentProject}
        />

        <div className="app-body">
          {/* Left: Controls */}
          {!sidebarCollapsed && (
            <aside className="sidebar">
              <div className="tab-bar" role="tablist">
                {([
                  ['research', 'Research', <svg key="research" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/><path d="M8 10.5c0-1.38 1.12-2.5 2.5-2.5"/></svg>],
                  ['brainstorm', 'Brainstorm', <svg key="brainstorm" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/><path d="M9 21h6"/><path d="M12 2v-0"/><path d="M4.22 4.22l-.01-.01"/><path d="M19.78 4.22l.01-.01"/><path d="M2 12h-.01"/><path d="M22 12h.01"/></svg>],
                  ['bulk', 'Bulk Generate', <svg key="bulk" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8c0-2.2 1.8-4 4-4h10c2.2 0 4 1.8 4 4v8c0 2.2-1.8 4-4 4H7c-2.2 0-4-1.8-4-4z"/><path d="M7 4v16"/><path d="M17 4v16"/><path d="M3 12h18"/></svg>],
                  ['editor', 'Design', <svg key="editor" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.7 4.3a1 1 0 0 0-1.4 0L6 17.6V20h2.4L21.7 6.7a1 1 0 0 0 0-1.4z"/><path d="M15.5 5.5c1.5-1.5 3-1 3.5-.5s1 2-.5 3.5"/><path d="M2 20c1-2 2-3.5 4-4"/><circle cx="4" cy="20" r="1"/></svg>],
                  ['performance', 'Performance', <svg key="performance" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2"/><path d="M22 2 13 13"/><path d="M16 2h6v6"/></svg>],
                ] as const).map(
                  ([key, label, icon]) => (
                    <button
                      key={key}
                      className={`tab-btn ${activeTab === key ? 'active' : ''}`}
                      onClick={() => setActiveTab(key)}
                      role="tab"
                      aria-selected={activeTab === key}
                      title={label}
                      aria-label={label}
                    >
                      {icon}
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
                {activeTab === 'editor' && <EditorPanel key={presetVersion} config={config} onChange={setConfig} />}
                {activeTab === 'bulk' && <BulkPanel variations={variations} onVariationsChange={setVariations} />}
                {activeTab === 'brainstorm' && (
                  <BrainstormPanel
                    onAdd={(newVars) => setVariations((prev) => [...prev, ...newVars])}
                    onRemoveLast={(ids) => setVariations((prev) => prev.filter((v) => !ids.includes(v.id)))}
                    onReplaceUnliked={(newVars) => {
                      setVariations((prev) => [
                        ...prev.filter((v) => likedIds.has(v.id)),
                        ...newVars,
                      ]);
                    }}
                    initialBrief={researchBrief}
                    likedVariations={likedVariations}
                    totalVariations={variations.length}
                    unlikedCount={variations.length - likedIds.size}
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
                <div className="empty-state-icon" role="img" aria-label="palette">{'\ud83c\udfa8'}</div>
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
