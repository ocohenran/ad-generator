import { useState, useEffect, useCallback } from 'react';
import {
  getMetaStatus, startMetaAuth, disconnectMeta, getMetaPages,
  uploadImageToMeta, createBulkMetaAds,
  META_CTA_OPTIONS, COUNTRY_OPTIONS,
  type MetaStatus, type MetaPage, type BulkPublishResult,
} from '../lib/metaApi';
import type { AdVariation, AdConfig } from '../types';

interface Props {
  onClose: () => void;
  variations: AdVariation[];
  config: AdConfig;
  getVariationBlob: (variation: AdVariation) => Promise<Blob>;
}

type Step = 'select' | 'config' | 'rendering' | 'uploading' | 'creating' | 'done' | 'error';

export function BulkMetaPublishModal({ onClose, variations, config, getVariationBlob }: Props) {
  const [status, setStatus] = useState<MetaStatus>({ connected: false });
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [dailyBudget, setDailyBudget] = useState(10);
  const [linkUrl, setLinkUrl] = useState('https://gwork.ai');
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedCta, setSelectedCta] = useState('Learn More');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['US']);

  // Progress state
  const [step, setStep] = useState<Step>('select');
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkPublishResult | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await getMetaStatus();
      setStatus(s);
      if (s.connected) {
        const p = await getMetaPages();
        setPages(p);
        if (p.length > 0) {
          setSelectedPage((prev) => prev || p[0].id);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    const success = await startMetaAuth();
    setConnecting(false);
    if (success) refreshStatus();
  };

  const handleDisconnect = async () => {
    await disconnectMeta();
    setStatus({ connected: false });
    setPages([]);
    setSelectedPage('');
  };

  const toggleVariation = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === variations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(variations.map((v) => v.id)));
    }
  };

  const selectedVariations = variations.filter((v) => selectedIds.has(v.id));

  const handlePublish = async () => {
    if (!selectedPage) {
      setError('Please select a Facebook Page');
      return;
    }
    if (selectedVariations.length < 2) {
      setError('Select at least 2 variations');
      return;
    }

    setError('');
    const total = selectedVariations.length;

    // Phase 1: Render images
    setStep('rendering');
    setProgress({ current: 0, total, label: 'Rendering images...' });

    const imageData: { variationId: string; imageHash: string; headline: string; body: string; ctaText: string }[] = [];

    try {
      for (let i = 0; i < selectedVariations.length; i++) {
        const v = selectedVariations[i];
        setProgress({ current: i + 1, total, label: `Rendering image ${i + 1}/${total}...` });

        const blob = await getVariationBlob(v);

        // Phase 2: Upload each image
        setStep('uploading');
        setProgress({ current: i + 1, total, label: `Uploading image ${i + 1}/${total}...` });
        const { imageHash } = await uploadImageToMeta(blob);

        imageData.push({
          variationId: v.id,
          imageHash,
          headline: v.headline,
          body: v.paragraph,
          ctaText: v.cta || selectedCta,
        });
      }

      // Phase 3: Create campaign + ads
      setStep('creating');
      setProgress({ current: 0, total: 0, label: 'Creating campaign and ads...' });

      const publishResult = await createBulkMetaAds(imageData, {
        campaignName: campaignName || 'Bulk A/B Test Campaign',
        dailyBudget,
        linkUrl,
        pageId: selectedPage,
        ctaText: selectedCta,
        countries: selectedCountries,
      });

      setStep('done');
      setResult(publishResult);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Bulk publish failed');
    }
  };

  const publishing = step === 'rendering' || step === 'uploading' || step === 'creating';

  const progressPercent = (() => {
    if (step === 'rendering') return (progress.current / (progress.total * 2)) * 100;
    if (step === 'uploading') return ((progress.total + progress.current) / (progress.total * 2)) * 80;
    if (step === 'creating') return 90;
    return 0;
  })();

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !publishing && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560, width: '90vw', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }} className="text-primary">Bulk Publish to Meta</h2>
          <button className="btn-icon" onClick={onClose} disabled={publishing} aria-label="Close">&times;</button>
        </div>

        {loading ? (
          <p className="text-muted">Checking connection...</p>
        ) : !status.connected ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p className="text-secondary" style={{ marginBottom: 16 }}>
              Connect your Facebook account to bulk publish ads.
            </p>
            <button
              className="btn-primary"
              onClick={handleConnect}
              disabled={connecting}
              style={{ padding: '10px 24px', fontSize: 14 }}
            >
              {connecting ? 'Connecting...' : 'Connect to Facebook'}
            </button>
          </div>
        ) : step === 'done' && result ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x2705;</div>
            <h3 className="text-primary" style={{ margin: '0 0 8px' }}>
              {result.ads.length} Ads Created (Paused)
            </h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              1 campaign with {result.ads.length} ads ready for A/B testing.
              Review and activate in Ads Manager.
            </p>
            <a
              href={result.adsManagerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: 'inline-block', padding: '10px 24px', fontSize: 14, textDecoration: 'none' }}
            >
              Open in Ads Manager
            </a>
            <div style={{ marginTop: 16 }}>
              <button className="btn-secondary" onClick={onClose} style={{ fontSize: 13 }}>Close</button>
            </div>
          </div>
        ) : step === 'error' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x274C;</div>
            <h3 className="text-primary" style={{ margin: '0 0 8px' }}>Publish Failed</h3>
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</p>
            <p className="text-muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Any partially created objects have been rolled back.
            </p>
            <button className="btn-primary" onClick={() => { setStep('select'); setError(''); }} style={{ fontSize: 13 }}>
              Try Again
            </button>
          </div>
        ) : publishing ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="text-secondary" style={{ fontSize: 14, marginBottom: 12 }}>{progress.label}</div>
            <div style={{
              height: 6, borderRadius: 3,
              background: 'var(--bg-secondary, #1a1a2e)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: 'var(--accent, #6366f1)',
                width: `${progressPercent}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
              Do not close this window
            </div>
          </div>
        ) : (
          <div>
            {/* Connection info */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 8, marginBottom: 16,
              background: 'var(--bg-secondary, #1a1a2e)',
            }}>
              <span className="text-secondary" style={{ fontSize: 13 }}>
                &#x2713; Connected as <strong>{status.userName}</strong>
              </span>
              <button className="btn-secondary" onClick={handleDisconnect} style={{ fontSize: 11, padding: '2px 8px' }}>
                Disconnect
              </button>
            </div>

            {step === 'select' ? (
              <>
                {/* Variation picker */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label className="editor-label" style={{ margin: 0 }}>
                      Select Variations ({selectedIds.size}/{variations.length})
                    </label>
                    <button className="btn-secondary" onClick={toggleAll} style={{ fontSize: 11, padding: '2px 8px' }}>
                      {selectedIds.size === variations.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div style={{
                    maxHeight: 280, overflowY: 'auto', borderRadius: 8,
                    border: '1px solid var(--border, #333)',
                  }}>
                    {variations.map((v) => (
                      <label
                        key={v.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 12px', cursor: 'pointer',
                          borderBottom: '1px solid var(--border, #333)',
                          background: selectedIds.has(v.id) ? 'var(--bg-secondary, #1a1a2e)' : 'transparent',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(v.id)}
                          onChange={() => toggleVariation(v.id)}
                          style={{ marginTop: 2 }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div className="text-primary" style={{ fontSize: 13, fontWeight: 600 }}>
                            {v.headline}
                          </div>
                          <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {v.paragraph.length > 80 ? v.paragraph.slice(0, 80) + '...' : v.paragraph}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                    Min 2, max 10 variations. Meta auto-optimizes budget across ads.
                  </div>
                </div>

                {error && (
                  <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', marginBottom: 12 }}>
                    {error}
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={() => {
                    if (selectedIds.size < 2) {
                      setError('Select at least 2 variations');
                      return;
                    }
                    if (selectedIds.size > 10) {
                      setError('Maximum 10 variations allowed');
                      return;
                    }
                    setError('');
                    setStep('config');
                  }}
                  style={{ width: '100%', padding: '10px', fontSize: 14 }}
                >
                  Next: Campaign Config ({selectedIds.size} selected)
                </button>
              </>
            ) : step === 'config' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button className="btn-secondary" onClick={() => setStep('select')} style={{ alignSelf: 'flex-start', fontSize: 11, padding: '2px 8px' }}>
                  &larr; Back to selection
                </button>

                <div>
                  <label className="editor-label">Campaign Name</label>
                  <input
                    className="editor-input"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Bulk A/B Test Campaign"
                  />
                </div>

                <div>
                  <label className="editor-label">Facebook Page</label>
                  {pages.length > 0 ? (
                    <select className="editor-input" value={selectedPage} onChange={(e) => setSelectedPage(e.target.value)}>
                      {pages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
                      No pages found. Your Facebook account needs at least one page.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="editor-label">Daily Budget (USD)</label>
                    <input className="editor-input" type="number" min={1} value={dailyBudget}
                      onChange={(e) => setDailyBudget(Number(e.target.value))} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label className="editor-label">Link URL</label>
                    <input className="editor-input" value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://gwork.ai" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label className="editor-label">CTA Button</label>
                    <select className="editor-input" value={selectedCta} onChange={(e) => setSelectedCta(e.target.value)}>
                      {META_CTA_OPTIONS.map((cta) => (
                        <option key={cta} value={cta}>{cta}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="editor-label">Target Countries</label>
                    <select className="editor-input" multiple value={selectedCountries}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                        setSelectedCountries(selected.length > 0 ? selected : ['US']);
                      }}
                      style={{ minHeight: 60 }}>
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                      Ctrl/Cmd+click to select multiple
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--bg-secondary, #1a1a2e)', fontSize: 12,
                }}>
                  <div className="text-muted" style={{ marginBottom: 4 }}>Bulk Publish Summary:</div>
                  <div className="text-secondary"><strong>Ads:</strong> {selectedIds.size} variations</div>
                  <div className="text-secondary"><strong>Structure:</strong> 1 campaign &rarr; 1 ad set &rarr; {selectedIds.size} ads</div>
                  <div className="text-secondary"><strong>Budget:</strong> ${dailyBudget}/day (split across ads by Meta)</div>
                  <div className="text-secondary"><strong>Countries:</strong> {selectedCountries.join(', ')}</div>
                </div>

                {error && (
                  <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)' }}>
                    {error}
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={handlePublish}
                  disabled={pages.length === 0}
                  style={{ padding: '10px 24px', fontSize: 14, marginTop: 4 }}
                >
                  Publish All ({selectedIds.size}) Paused
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
