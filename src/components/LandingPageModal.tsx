import { useState, useEffect, useRef } from 'react';
import {
  generateLandingPage, publishLandingPage,
  type LandingPageContent,
  type LandingPagePublishResult,
} from '../lib/landingPageApi';
import type { PublishedAdWithMetrics } from '../lib/metaApi';

interface Props {
  ad: PublishedAdWithMetrics;
  onClose: () => void;
}

type Step = 'generating' | 'preview' | 'publishing' | 'done' | 'error';

export function LandingPageModal({ ad, onClose }: Props) {
  const [step, setStep] = useState<Step>('generating');
  const [content, setContent] = useState<LandingPageContent | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LandingPagePublishResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Editable SEO fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');

  // Generate on mount
  useEffect(() => {
    const apiKey = localStorage.getItem('ad-gen:apiKey') || '';
    if (!apiKey) {
      setError('No API key set. Open Settings to add your Claude API key.');
      setStep('error');
      return;
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    generateLandingPage(apiKey, {
      headline: ad.headline,
      body: ad.body,
      ctaText: ad.ctaText,
      cpc: ad.metrics?.cpc,
      ctr: ad.metrics?.ctr,
      spend: ad.metrics?.spend,
      clicks: ad.metrics?.clicks,
    }, ctrl.signal)
      .then((generated) => {
        setContent(generated);
        setTitle(generated.title);
        setSlug(generated.seo.slug);
        setMetaTitle(generated.seo.metaTitle);
        setMetaDescription(generated.seo.metaDescription);
        setFocusKeyword(generated.seo.focusKeyword);
        setStep('preview');
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err.message || 'Generation failed');
        setStep('error');
      });

    return () => ctrl.abort();
  }, [ad]);

  const handlePublish = async () => {
    if (!content) return;
    setStep('publishing');
    setError('');

    try {
      const publishResult = await publishLandingPage({
        content,
        title,
        slug,
        metaTitle,
        metaDescription,
        focusKeyword,
      });
      setResult(publishResult);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('generating');
    setError('');
    setContent(null);

    const apiKey = localStorage.getItem('ad-gen:apiKey') || '';
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    generateLandingPage(apiKey, {
      headline: ad.headline,
      body: ad.body,
      ctaText: ad.ctaText,
      cpc: ad.metrics?.cpc,
      ctr: ad.metrics?.ctr,
      spend: ad.metrics?.spend,
      clicks: ad.metrics?.clicks,
    }, ctrl.signal)
      .then((generated) => {
        setContent(generated);
        setTitle(generated.title);
        setSlug(generated.seo.slug);
        setMetaTitle(generated.seo.metaTitle);
        setMetaDescription(generated.seo.metaDescription);
        setFocusKeyword(generated.seo.focusKeyword);
        setStep('preview');
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err.message || 'Generation failed');
        setStep('error');
      });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: 560, width: '92vw', maxHeight: '85vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18 }} className="text-primary">Generate Landing Page</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        {/* Source ad summary */}
        <div style={{
          padding: '8px 12px', borderRadius: 8, marginBottom: 16,
          background: 'var(--bg-secondary, #1a1a2e)', fontSize: 12,
        }}>
          <div className="text-muted" style={{ marginBottom: 4 }}>Source Ad:</div>
          <div className="text-secondary"><strong>{ad.headline}</strong></div>
          {ad.metrics && (
            <div className="text-muted" style={{ marginTop: 2 }}>
              CPC: ${ad.metrics.cpc.toFixed(2)} &middot; CTR: {ad.metrics.ctr.toFixed(2)}% &middot; Clicks: {ad.metrics.clicks}
            </div>
          )}
        </div>

        {/* Generating */}
        {step === 'generating' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 14, marginBottom: 12 }} className="text-secondary">
              Generating landing page from winning ad...
            </div>
            <div style={{
              margin: '0 auto', width: 200, height: 4, borderRadius: 2,
              background: 'var(--bg-secondary, #1a1a2e)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'var(--accent, #6366f1)',
                width: '60%',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            </div>
            <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
              This takes 5-10 seconds...
            </div>
          </div>
        )}

        {/* Preview + Edit */}
        {step === 'preview' && content && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Editable SEO fields */}
            <div>
              <label className="editor-label">Page Title (H1)</label>
              <input className="editor-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="editor-label">URL Slug</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>gwork.io/</span>
                <input className="editor-input" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="editor-label">
                Meta Title
                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                  ({metaTitle.length}/60)
                </span>
              </label>
              <input
                className="editor-input"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                style={{ borderColor: metaTitle.length > 60 ? '#ef4444' : undefined }}
              />
            </div>

            <div>
              <label className="editor-label">
                Meta Description
                <span className="text-muted" style={{ fontWeight: 400, marginLeft: 4 }}>
                  ({metaDescription.length}/155)
                </span>
              </label>
              <textarea
                className="editor-input"
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                rows={2}
                style={{ borderColor: metaDescription.length > 155 ? '#ef4444' : undefined, resize: 'vertical' }}
              />
            </div>

            <div>
              <label className="editor-label">Focus Keyword</label>
              <input className="editor-input" value={focusKeyword} onChange={(e) => setFocusKeyword(e.target.value)} />
            </div>

            {/* Content preview (read-only) */}
            <div style={{
              padding: '12px', borderRadius: 8,
              background: 'var(--bg-secondary, #1a1a2e)', fontSize: 12,
              maxHeight: 240, overflowY: 'auto',
            }}>
              <div className="text-muted" style={{ marginBottom: 8, fontWeight: 600 }}>Generated Content Preview:</div>

              <div className="text-secondary" style={{ marginBottom: 4 }}>
                <strong>Subheadline:</strong> {content.subheadline}
              </div>
              <div className="text-secondary" style={{ marginBottom: 8 }}>
                <strong>Hero:</strong> {content.heroText}
              </div>

              <div className="text-muted" style={{ marginBottom: 4, fontWeight: 600 }}>Benefits:</div>
              {content.benefits.map((b, i) => (
                <div key={i} className="text-secondary" style={{ marginBottom: 4, paddingLeft: 8 }}>
                  <strong>{b.heading}:</strong> {b.body}
                </div>
              ))}

              <div className="text-muted" style={{ margin: '8px 0 4px', fontWeight: 600 }}>CTA Section:</div>
              <div className="text-secondary" style={{ paddingLeft: 8 }}>
                <strong>{content.ctaHeading}</strong> &mdash; {content.ctaBody}
                <br />Button: "{content.ctaButton}"
              </div>

              <div className="text-muted" style={{ margin: '8px 0 4px', fontWeight: 600 }}>FAQs ({content.faqs.length}):</div>
              {content.faqs.map((f, i) => (
                <div key={i} className="text-secondary" style={{ marginBottom: 4, paddingLeft: 8 }}>
                  <strong>Q:</strong> {f.question}<br />
                  <strong>A:</strong> {f.answer}
                </div>
              ))}
            </div>

            <button
              className="btn-primary"
              onClick={handlePublish}
              style={{ padding: '10px 24px', fontSize: 14, marginTop: 4 }}
            >
              Publish as Draft
            </button>
          </div>
        )}

        {/* Publishing */}
        {step === 'publishing' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 14, marginBottom: 12 }} className="text-secondary">
              Publishing to WordPress...
            </div>
            <div style={{
              margin: '0 auto', width: 200, height: 4, borderRadius: 2,
              background: 'var(--bg-secondary, #1a1a2e)', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: 'var(--accent, #6366f1)',
                width: '80%',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#x2705;</div>
            <h3 className="text-primary" style={{ margin: '0 0 8px' }}>Landing Page Created (Draft)</h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Your page has been created as a draft with Yoast SEO fields populated.
              Review and publish it in WordPress.
            </p>
            <a
              href={result.editUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ display: 'inline-block', padding: '10px 24px', fontSize: 14, textDecoration: 'none' }}
            >
              Open in WordPress
            </a>
            {result.previewUrl && (
              <div style={{ marginTop: 8 }}>
                <a
                  href={result.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted"
                  style={{ fontSize: 12 }}
                >
                  Preview page
                </a>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn-secondary" onClick={onClose} style={{ fontSize: 13 }}>Close</button>
            </div>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ color: '#ef4444', fontSize: 13, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', marginBottom: 16 }}>
              {error}
            </div>
            <button className="btn-secondary" onClick={handleRetry} style={{ fontSize: 13, marginRight: 8 }}>
              Try Again
            </button>
            <button className="btn-secondary" onClick={onClose} style={{ fontSize: 13 }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
