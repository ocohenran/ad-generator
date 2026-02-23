import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { AccentLine, LogoBar, CtaButton } from './shared';

export const BoldStatementTemplate = memo(function BoldStatementTemplate({ config, headline, paragraph, cta, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);
  const headlineFont = config.headlineFontFamily ?? config.fontFamily;
  const accent = config.ctaColor;

  return (
    <div style={{
      width: w, height: ht, background: '#0A0F1E',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}

      {/* Subtle corner orb */}
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%',
        width: unit * 0.5, height: unit * 0.5, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`,
        zIndex: 1, filter: `blur(${unit * 0.06}px)`,
      }} />

      {/* Left accent line */}
      <AccentLine from={accent} to={`${accent}30`} unit={unit} side="left" />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%',
        paddingTop: unit * 0.08, paddingBottom: unit * 0.1,
        paddingLeft: unit * 0.07, paddingRight: unit * 0.07,
      }}>
        <LogoBar config={config} unit={unit} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 0.02 }}>
          <h1 style={{
            fontSize: unit * 0.11, fontWeight: 900, color: config.headlineColor,
            lineHeight: 0.95, letterSpacing: '-0.04em', margin: 0,
            fontFamily: headlineFont, textAlign: 'left',
          }}>
            {h}
          </h1>
          {/* Accent underline bar */}
          <div style={{
            width: unit * 0.12, height: unit * 0.008,
            background: accent, borderRadius: unit * 0.004,
            marginTop: unit * 0.01,
          }} />
          <p style={{
            fontSize: unit * 0.022, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, maxWidth: '75%',
            opacity: 0.55, textAlign: 'left',
            marginTop: unit * 0.01,
          }}>
            {p}
          </p>
        </div>

        <div style={{ textAlign: 'left' }}>
          <CtaButton config={config} unit={unit} text={cta} />
        </div>
      </div>
    </div>
  );
});
