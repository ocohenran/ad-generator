import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, CtaButton, BackgroundImage } from './shared';

export const StandardTemplate = memo(function StandardTemplate({ config, headline, paragraph, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);

  return (
    <div
      style={{
        width: w, height: ht,
        background: `linear-gradient(${config.gradientAngle}deg, ${config.gradientFrom}, ${config.gradientTo})`,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: config.fontFamily,
      }}
    >
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.2} />}

      <div style={{
        position: 'absolute', top: -unit * 0.15, right: -unit * 0.15,
        width: unit * 0.55, height: unit * 0.55, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', zIndex: 1,
      }} />
      <div style={{
        position: 'absolute', bottom: -unit * 0.1, left: -unit * 0.1,
        width: unit * 0.4, height: unit * 0.4, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)', zIndex: 1,
      }} />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%', padding: unit * 0.065,
      }}>
        <LogoBar config={config} unit={unit} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 0.03 }}>
          <h1 style={{
            fontSize: unit * 0.065, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.1, letterSpacing: '-0.03em', margin: 0, maxWidth: '90%',
          }}>
            {h}
          </h1>
          <p style={{
            fontSize: unit * 0.024, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, maxWidth: '85%', fontWeight: 400,
          }}>
            {p}
          </p>
        </div>

        <div>
          <CtaButton config={config} unit={unit} />
        </div>
      </div>
    </div>
  );
});
