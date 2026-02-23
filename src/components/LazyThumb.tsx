import { useRef, useState, useEffect, memo } from 'react';
import type { AdConfig, AdVariation } from '../types';
import { AdPreview } from './AdPreview';

interface Props {
  config: AdConfig;
  variation: AdVariation;
  index: number;
  isActive: boolean;
  onClick: (v: AdVariation) => void;
}

export const LazyThumb = memo(function LazyThumb({
  config, variation, index, isActive, onClick,
}: Props) {
  const ref = useRef<HTMLButtonElement>(null);
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
    <button
      ref={ref}
      type="button"
      className={`thumb-card ${isActive ? 'thumb-card-active' : ''}`}
      onClick={() => onClick(variation)}
      role="option"
      aria-selected={isActive}
      aria-label={`Variation ${index + 1}: ${variation.headline}`}
    >
      <div className="thumb-number">#{index + 1}</div>
      <div className="thumb-render">
        {visible ? (
          <AdPreview
            config={config}
            headline={variation.headline}
            paragraph={variation.paragraph}
            scale={0.2}
          />
        ) : (
          <div style={{ width: '100%', aspectRatio: '1', background: 'var(--bg-tertiary)' }} />
        )}
      </div>
      <div className="thumb-headline">{variation.headline}</div>
    </button>
  );
});
