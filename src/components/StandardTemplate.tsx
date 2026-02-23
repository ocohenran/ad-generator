import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { MeshGradientBackground, AccentLine, LogoBar, CtaButton, BackgroundImage } from './shared';

export const StandardTemplate = memo(function StandardTemplate({ config, headline, paragraph, cta, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);
  const headlineFont = config.headlineFontFamily ?? config.fontFamily;

  return (
    <div
      style={{
        width: w, height: ht,
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        fontFamily: config.fontFamily,
      }}
    >
      {/* Mesh gradient background */}
      <MeshGradientBackground
        from={config.gradientFrom}
        mid={config.gradientMid}
        to={config.gradientTo}
        angle={config.gradientAngle}
        unit={unit}
      />

      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.2} />}

      {/* Left accent line */}
      <AccentLine from={config.gradientFrom} to={config.gradientTo} unit={unit} side="left" />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%',
        paddingTop: unit * 0.08, paddingBottom: unit * 0.1,
        paddingLeft: unit * 0.065, paddingRight: unit * 0.065,
      }}>
        <LogoBar config={config} unit={unit} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 0.025 }}>
          <h1 style={{
            fontSize: unit * 0.082, fontWeight: 900, color: config.headlineColor,
            lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0, maxWidth: '95%',
            fontFamily: headlineFont, textAlign: 'left',
          }}>
            {h}
          </h1>
          <p style={{
            fontSize: unit * 0.022, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, maxWidth: '80%', fontWeight: 400,
            textAlign: 'left', opacity: 0.85,
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
