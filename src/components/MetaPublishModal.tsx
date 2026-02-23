import { useState, useEffect, useCallback } from 'react';
import {
  getMetaStatus, startMetaAuth, disconnectMeta, getMetaPages,
  uploadImageToMeta, createMetaAd,
  META_CTA_OPTIONS, COUNTRY_OPTIONS,
  type MetaStatus, type MetaPage, type PublishResult,
} from '../lib/metaApi';

interface Props {
  onClose: () => void;
  getImageBlob: () => Promise<Blob>;
  headline: string;
  body: string;
  ctaText: string;
}

type Step = 'idle' | 'uploading' | 'creating-campaign' | 'creating-ad' | 'done' | 'error';

export function MetaPublishModal({ onClose, getImageBlob, headline, body, ctaText }: Props) {
  const [status, setStatus] = useState<MetaStatus>({ connected: false });
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [dailyBudget, setDailyBudget] = useState(10);
  const [linkUrl, setLinkUrl] = useState('https://gwork.ai');
  const [selectedPage, setSelectedPage] = useState('');
  const [selectedCta, setSelectedCta] = useState(ctaText || 'Learn More');
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['US']);

  // Publish state
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<PublishResult | null>(null);

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
    if (success) {
      refreshStatus();
    }
  };

  const handleDisconnect = async () => {
    await disconnectMeta();
    setStatus({ connected: false });
    setPages([]);
    setSelectedPage('');
  };

  const handlePublish = async () => {
    if (!selectedPage) {
      setError('Please select a Facebook Page');
      return;
    }

    setStep('uploading');
    setError('');

    try {
      // 1. Render and upload image
      const blob = await getImageBlob();
      const { imageHash } = await uploadImageToMeta(blob);

      // 2. Create campaign + ad set + creative + ad
      setStep('creating-campaign');
      const publishResult = await createMetaAd(imageHash, {
        campaignName: campaignName || 'Ad Generator Campaign',
        dailyBudget,
        headline,
        body,
        ctaText: selectedCta,
        linkUrl,
        pageId: selectedPage,
        countries: selectedCountries,
      });

      setStep('done');
      setResult(publishResult);
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Publish failed');
    }
  };

  const stepLabel: Record<Step, string> = {
    idle: '',
    uploading: 'Uploading image to Meta...',
    'creating-campaign': 'Creating campaign & ad...',
    'creating-ad': 'Creating ad...',
    done: 'Published successfully!',
    error: 'Failed',
  };

  const publishing = step === 'uploading' || step === 'creating-campaign' || step === 'creating-ad';

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 480, width: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }} className="text-primary">Publish to Meta</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {loading ? (
          <p className="text-muted">Checking connection...</p>
        ) : !status.connected ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p className="text-secondary" style={{ marginBottom: 16 }}>
              Connect your Facebook account to publish ads directly from here.
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
            <h3 className="text-primary" style={{ margin: '0 0 8px' }}>Ad Published (Paused)</h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Your campaign has been created in paused state. Review and activate it in Ads Manager.
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

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="editor-label">Campaign Name</label>
                <input
                  className="editor-input"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ad Generator Campaign"
                />
              </div>

              <div>
                <label className="editor-label">Facebook Page</label>
                {pages.length > 0 ? (
                  <select
                    className="editor-input"
                    value={selectedPage}
                    onChange={(e) => setSelectedPage(e.target.value)}
                  >
                    {pages.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
                    No pages found. Make sure your Facebook account manages at least one page.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="editor-label">Daily Budget (USD)</label>
                  <input
                    className="editor-input"
                    type="number"
                    min={1}
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(Number(e.target.value))}
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label className="editor-label">Link URL</label>
                  <input
                    className="editor-input"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://gwork.ai"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="editor-label">CTA Button</label>
                  <select
                    className="editor-input"
                    value={selectedCta}
                    onChange={(e) => setSelectedCta(e.target.value)}
                  >
                    {META_CTA_OPTIONS.map((cta) => (
                      <option key={cta} value={cta}>{cta}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="editor-label">Target Countries</label>
                  <select
                    className="editor-input"
                    multiple
                    value={selectedCountries}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (o) => o.value);
                      setSelectedCountries(selected.length > 0 ? selected : ['US']);
                    }}
                    style={{ minHeight: 60 }}
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                    Ctrl/Cmd+click to select multiple
                  </div>
                </div>
              </div>

              {/* Ad preview summary */}
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--bg-secondary, #1a1a2e)',
                fontSize: 12,
              }}>
                <div className="text-muted" style={{ marginBottom: 4 }}>Ad Copy Preview:</div>
                <div className="text-secondary"><strong>Headline:</strong> {headline}</div>
                <div className="text-secondary"><strong>Body:</strong> {body?.slice(0, 100)}{body?.length > 100 ? '...' : ''}</div>
                <div className="text-secondary"><strong>CTA:</strong> {selectedCta}</div>
                <div className="text-secondary"><strong>Countries:</strong> {selectedCountries.join(', ')}</div>
              </div>

              {error && (
                <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)' }}>
                  {error}
                </div>
              )}

              {publishing && (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div className="text-muted" style={{ fontSize: 13 }}>{stepLabel[step]}</div>
                  <div style={{
                    marginTop: 8, height: 4, borderRadius: 2,
                    background: 'var(--bg-secondary, #1a1a2e)', overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'var(--accent, #6366f1)',
                      width: step === 'uploading' ? '40%' : step === 'creating-campaign' ? '70%' : '90%',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )}

              <button
                className="btn-primary"
                onClick={handlePublish}
                disabled={publishing || pages.length === 0}
                style={{ padding: '10px 24px', fontSize: 14, marginTop: 4 }}
              >
                {publishing ? stepLabel[step] : 'Publish (Paused)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
