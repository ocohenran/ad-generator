import type { AdConfig } from '../types';
import { AdPreview } from './AdPreview';

interface Props {
  config: AdConfig;
  headline?: string;
  paragraph?: string;
  cta?: string;
  scale?: number;
}

function truncateWithSeeMore(text: string, max: number): React.ReactNode {
  if (text.length <= max) return text;
  return (
    <>
      {text.slice(0, max)}...{' '}
      <span style={{ color: '#385898', fontWeight: 600, cursor: 'pointer' }}>See more</span>
    </>
  );
}

export function MetaFeedPreview({ config, headline, paragraph, cta, scale }: Props) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const ctaText = cta ?? config.ctaText;

  return (
    <div style={{
      width: 375,
      background: '#ffffff',
      borderRadius: 8,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      transform: scale ? `scale(${scale * 1.8})` : undefined,
      transformOrigin: 'top center',
    }}>
      {/* Post header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6D28D9, #FA6F1C)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 16,
        }}>
          G
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#050505' }}>
            {config.logoText}
          </div>
          <div style={{ fontSize: 12, color: '#65676B' }}>
            Sponsored
          </div>
        </div>
        <div style={{ marginLeft: 'auto', color: '#65676B', fontSize: 20, cursor: 'pointer' }}>
          ···
        </div>
      </div>

      {/* Primary text */}
      <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#050505', lineHeight: 1.4 }}>
        {truncateWithSeeMore(p, 125)}
      </div>

      {/* Creative */}
      <div style={{ lineHeight: 0, overflow: 'hidden' }}>
        <AdPreview
          config={config}
          headline={headline}
          paragraph={paragraph}
          cta={cta}
          scale={375 / 1080}
        />
      </div>

      {/* Link preview bar */}
      <div style={{
        padding: '10px 16px',
        background: '#F0F2F5',
        borderBottom: '1px solid #E4E6EB',
      }}>
        <div style={{ fontSize: 12, color: '#65676B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          gwork.io
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#050505', lineHeight: 1.3 }}>
              {h.length > 40 ? h.slice(0, 40) + '...' : h}
            </div>
          </div>
          <button style={{
            background: '#E4E6EB', border: 'none', borderRadius: 6,
            padding: '8px 16px', fontSize: 14, fontWeight: 600,
            color: '#050505', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 12,
          }}>
            {ctaText.replace(/\s*→\s*$/, '')}
          </button>
        </div>
      </div>

      {/* Engagement bar */}
      <div style={{
        padding: '4px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid #E4E6EB',
      }}>
        {['Like', 'Comment', 'Share'].map((action) => (
          <button key={action} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '10px 0', background: 'none', border: 'none',
            fontSize: 14, fontWeight: 600, color: '#65676B', cursor: 'pointer',
          }}>
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}
