import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { AccentLine, LogoBar, CtaButton, BackgroundImage } from './shared';

export const ProductSpotlightTemplate = memo(function ProductSpotlightTemplate({ config, headline, paragraph, cta, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);

  return (
    <div style={{
      width: w, height: ht, background: config.spotlightBg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.2} />}

      {/* 3 horizontal accent lines — abstract graphic */}
      {[0.12, 0.22, 0.30].map((top, i) => (
        <div key={i} style={{
          position: 'absolute', top: `${top * 100}%`,
          right: unit * 0.06, width: unit * (0.18 - i * 0.04), height: unit * 0.004,
          background: `${config.spotlightAccent}${30 - i * 8}`,
          borderRadius: unit * 0.002, zIndex: 1,
        }} />
      ))}

      {/* Stronger left accent bar */}
      <AccentLine from={config.spotlightAccent} to={`${config.spotlightAccent}30`} unit={unit} side="left" />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%',
        paddingTop: unit * 0.08, paddingBottom: unit * 0.1,
        paddingLeft: unit * 0.07, paddingRight: unit * 0.07,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <LogoBar config={config} unit={unit} accentColor={config.spotlightAccent} />
          {/* Featured badge — filled pill */}
          <div style={{
            padding: `${unit * 0.01}px ${unit * 0.025}px`,
            background: config.spotlightAccent,
            borderRadius: unit * 0.04, fontSize: unit * 0.014,
            color: '#000', fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            Featured
          </div>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: unit * 0.025,
        }}>
          {/* Larger product image with colored drop shadow */}
          {config.backgroundImage ? (
            <div style={{
              width: unit * 0.4, height: unit * 0.4, borderRadius: unit * 0.02,
              background: `url(${config.backgroundImage}) center/cover`,
              border: `1px solid ${config.spotlightAccent}30`,
              boxShadow: `0 ${unit * 0.025}px ${unit * 0.07}px ${config.spotlightAccent}25`,
              alignSelf: 'center', marginBottom: unit * 0.02,
            }} />
          ) : (
            <div style={{
              width: unit * 0.3, height: unit * 0.3, borderRadius: unit * 0.02,
              background: `linear-gradient(135deg, ${config.spotlightAccent}20, ${config.spotlightAccent}05)`,
              border: `1px solid ${config.spotlightAccent}20`,
              boxShadow: `0 ${unit * 0.02}px ${unit * 0.06}px ${config.spotlightAccent}15`,
              alignSelf: 'center', marginBottom: unit * 0.02,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: unit * 0.06, color: config.spotlightAccent, opacity: 0.3,
            }}>
              {config.logoText.charAt(0)}
            </div>
          )}

          <h1 style={{
            fontSize: unit * 0.068, fontWeight: 900, color: config.headlineColor,
            lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, textAlign: 'left',
          }}>
            {h}
          </h1>
          <p style={{
            fontSize: unit * 0.021, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, textAlign: 'left', maxWidth: '90%',
            opacity: 0.85,
          }}>
            {p}
          </p>
        </div>

        <div style={{ textAlign: 'left' }}>
          <CtaButton config={config} unit={unit} accentColor={config.spotlightAccent} text={cta} />
        </div>
      </div>
    </div>
  );
});
