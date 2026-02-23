import { useRef, useState, useEffect, memo } from 'react';
import type { AdConfig, AdVariation } from '../types';
import { AdPreview } from './AdPreview';

interface Props {
  config: AdConfig;
  variation: AdVariation;
  index: number;
  isActive: boolean;
  isLiked: boolean;
  onClick: (v: AdVariation) => void;
  onToggleLike: (id: string) => void;
}

export const LazyThumb = memo(function LazyThumb({
  config, variation, index, isActive, isLiked, onClick, onToggleLike,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`thumb-card ${isActive ? 'thumb-card-active' : ''}`}
      onClick={() => onClick(variation)}
      role="option"
      aria-selected={isActive}
      aria-label={`Variation ${index + 1}: ${variation.headline}`}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(variation); } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div className="thumb-number">#{index + 1}</div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleLike(variation.id); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, padding: '2px 4px', lineHeight: 1,
            color: isLiked ? '#ef4444' : 'var(--text-faint)',
            transition: 'color 0.15s, transform 0.15s',
            transform: isLiked ? 'scale(1.2)' : 'scale(1)',
          }}
          aria-label={isLiked ? 'Unlike variation' : 'Like variation'}
        >
          {isLiked ? '\u2764\uFE0F' : '\u2661'}
        </button>
      </div>
      <div className="thumb-render">
        {visible ? (
          <AdPreview
            config={config}
            headline={variation.headline}
            paragraph={variation.paragraph}
            cta={variation.cta}
            scale={0.2}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-tertiary)' }} />
        )}
      </div>
      <div className="thumb-headline">{variation.headline}</div>
    </div>
  );
});
