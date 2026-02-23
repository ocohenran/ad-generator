import { useState, useEffect, useCallback } from 'react';
import { getAdInsights, type PublishedAdWithMetrics } from '../lib/metaApi';

interface Props {
  onRemixWinner: (brief: string) => void;
  onGenerateLandingPage: (ad: PublishedAdWithMetrics) => void;
}

export function PerformancePanel({ onRemixWinner, onGenerateLandingPage }: Props) {
  const [ads, setAds] = useState<PublishedAdWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setError(null);
      const data = await getAdInsights();
      // Sort by CPC ascending (cheapest = winners at top), nulls last
      data.sort((a, b) => {
        if (!a.metrics && !b.metrics) return 0;
        if (!a.metrics) return 1;
        if (!b.metrics) return -1;
        return a.metrics.cpc - b.metrics.cpc;
      });
      setAds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 60_000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  const handleRemix = (ad: PublishedAdWithMetrics) => {
    const cpc = ad.metrics?.cpc ? `$${ad.metrics.cpc.toFixed(2)}` : 'N/A';
    const ctr = ad.metrics?.ctr ? `${ad.metrics.ctr.toFixed(1)}%` : 'N/A';
    const brief = `REMIX THIS WINNING AD (CPC: ${cpc}, CTR: ${ctr}):
Headline: "${ad.headline}"
Body: "${ad.body}"
CTA: ${ad.ctaText}

Generate 10 new variations that preserve the winning angle
but test different hooks, emotional triggers, and CTAs.`;
    onRemixWinner(brief);
  };

  const getCpcColor = (index: number, total: number): string => {
    if (total <= 1) return 'var(--text-secondary)';
    const ratio = index / (total - 1);
    if (ratio < 0.33) return '#22c55e'; // green - top performers
    if (ratio < 0.66) return '#f59e0b'; // amber - mid
    return '#ef4444'; // red - underperformers
  };

  const formatCurrency = (v: number) => `$${v.toFixed(2)}`;
  const formatPercent = (v: number) => `${v.toFixed(2)}%`;
  const formatNumber = (v: number) => v.toLocaleString();

  const adsWithMetrics = ads.filter((a) => a.metrics);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div className="text-muted">Loading performance data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>
        <button className="btn-secondary" onClick={fetchInsights}>Retry</button>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>&#x1F4CA;</div>
        <div className="text-secondary" style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          No published ads yet
        </div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          Publish ads via the "Publish to Meta" button, then track their performance here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-secondary" style={{ fontSize: 13, fontWeight: 600 }}>
          {ads.length} Published Ad{ads.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-secondary" onClick={fetchInsights} style={{ fontSize: 11, padding: '2px 8px' }}>
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      {adsWithMetrics.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        }}>
          {[
            { label: 'Total Spend', value: formatCurrency(adsWithMetrics.reduce((s, a) => s + (a.metrics?.spend ?? 0), 0)) },
            { label: 'Total Clicks', value: formatNumber(adsWithMetrics.reduce((s, a) => s + (a.metrics?.clicks ?? 0), 0)) },
            { label: 'Avg CPC', value: formatCurrency(
              adsWithMetrics.reduce((s, a) => s + (a.metrics?.cpc ?? 0), 0) / adsWithMetrics.length
            )},
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-secondary, #1a1a2e)', textAlign: 'center',
            }}>
              <div className="text-muted" style={{ fontSize: 10, marginBottom: 2 }}>{stat.label}</div>
              <div className="text-primary" style={{ fontSize: 16, fontWeight: 700 }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ad cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
        {ads.map((ad, i) => (
          <div
            key={`${ad.adId}-${ad.variationId}`}
            style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--bg-secondary, #1a1a2e)',
              borderLeft: `3px solid ${ad.metrics ? getCpcColor(i, ads.length) : 'var(--text-dim)'}`,
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flex: 1, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                  {ad.headline || '(no headline)'}
                </span>
              </div>
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4, marginLeft: 8, whiteSpace: 'nowrap',
                background: ad.status === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                color: ad.status === 'ACTIVE' ? '#22c55e' : 'var(--text-dim)',
              }}>
                {ad.status}
              </span>
            </div>

            {/* Metrics */}
            {ad.metrics ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 }}>
                {[
                  { label: 'Spend', value: formatCurrency(ad.metrics.spend) },
                  { label: 'Impr.', value: formatNumber(ad.metrics.impressions) },
                  { label: 'Clicks', value: formatNumber(ad.metrics.clicks) },
                  { label: 'CTR', value: formatPercent(ad.metrics.ctr) },
                  { label: 'CPC', value: formatCurrency(ad.metrics.cpc), highlight: true },
                ].map((m) => (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{m.label}</div>
                    <div style={{
                      fontSize: 12, fontWeight: m.highlight ? 700 : 500,
                      color: m.highlight ? getCpcColor(i, ads.length) : 'var(--text-muted)',
                    }}>
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, fontStyle: 'italic' }}>
                Awaiting data...
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn-secondary"
                onClick={() => handleRemix(ad)}
                style={{ fontSize: 11, padding: '3px 10px', flex: 1 }}
              >
                Remix Winner
              </button>
              <button
                className="btn-secondary"
                onClick={() => onGenerateLandingPage(ad)}
                style={{ fontSize: 11, padding: '3px 10px', flex: 1, color: 'var(--accent, #6366f1)' }}
              >
                Landing Page
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
