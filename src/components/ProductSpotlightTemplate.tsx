import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, CtaButton, BackgroundImage } from './shared';

export const ProductSpotlightTemplate = memo(function ProductSpotlightTemplate({ config, headline, paragraph, scale = 1, width, height }: TemplateProps) {
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

      <div style={{
        position: 'absolute', top: unit * 0.08, right: unit * 0.08,
        width: unit * 0.35, height: unit * 0.35,
        border: `${unit * 0.003}px solid ${config.spotlightAccent}25`,
        borderRadius: unit * 0.02, transform: 'rotate(15deg)', zIndex: 1,
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: unit * 0.008, height: '100%',
        background: `linear-gradient(180deg, ${config.spotlightAccent}, transparent)`,
        zIndex: 3,
      }} />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%', padding: unit * 0.07,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <LogoBar config={config} unit={unit} accentColor={config.spotlightAccent} />
          <div style={{
            padding: `${unit * 0.008}px ${unit * 0.02}px`,
            border: `1px solid ${config.spotlightAccent}60`,
            borderRadius: unit * 0.005, fontSize: unit * 0.014,
            color: config.spotlightAccent, fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            Featured
          </div>
        </div>

        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: unit * 0.025,
        }}>
          {config.backgroundImage ? (
            <div style={{
              width: unit * 0.35, height: unit * 0.35, borderRadius: unit * 0.02,
              background: `url(${config.backgroundImage}) center/cover`,
              border: `1px solid ${config.spotlightAccent}30`,
              boxShadow: `0 ${unit * 0.02}px ${unit * 0.06}px rgba(0,0,0,0.4)`,
              alignSelf: 'center', marginBottom: unit * 0.02,
            }} />
          ) : (
            <div style={{
              width: unit * 0.25, height: unit * 0.25, borderRadius: unit * 0.02,
              background: `linear-gradient(135deg, ${config.spotlightAccent}20, ${config.spotlightAccent}05)`,
              border: `1px solid ${config.spotlightAccent}20`,
              alignSelf: 'center', marginBottom: unit * 0.02,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: unit * 0.06, color: config.spotlightAccent, opacity: 0.3,
            }}>
              {config.logoText.charAt(0)}
            </div>
          )}

          <h1 style={{
            fontSize: unit * 0.058, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.1, letterSpacing: '-0.03em', margin: 0, textAlign: 'center',
          }}>
            {h}
          </h1>
          <p style={{
            fontSize: unit * 0.022, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, textAlign: 'center',
            maxWidth: '85%', alignSelf: 'center',
          }}>
            {p}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CtaButton config={config} unit={unit} accentColor={config.spotlightAccent} />
        </div>
      </div>
    </div>
  );
});
