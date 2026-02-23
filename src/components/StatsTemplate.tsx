import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { AccentLine, LogoBar, BackgroundImage } from './shared';

export const StatsTemplate = memo(function StatsTemplate({ config, headline, paragraph, cta, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);

  return (
    <div style={{
      width: w, height: ht, background: config.statBg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.1} />}

      {/* Left accent strip */}
      <AccentLine from={config.statAccent} to={`${config.statAccent}40`} unit={unit} side="left" />

      {/* Two offset blurred orbs */}
      <div style={{
        position: 'absolute', top: '15%', left: '30%',
        width: unit * 0.6, height: unit * 0.6, borderRadius: '50%',
        background: `radial-gradient(circle, ${config.statAccent}12 0%, transparent 70%)`,
        zIndex: 1, filter: `blur(${unit * 0.04}px)`,
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '10%',
        width: unit * 0.5, height: unit * 0.5, borderRadius: '50%',
        background: `radial-gradient(circle, ${config.statAccent}0a 0%, transparent 70%)`,
        zIndex: 1, filter: `blur(${unit * 0.05}px)`,
      }} />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%',
        paddingTop: unit * 0.08, paddingBottom: unit * 0.1,
        paddingLeft: unit * 0.065, paddingRight: unit * 0.065,
      }}>
        <LogoBar config={config} unit={unit} accentColor={config.statAccent} />

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flex: 1, gap: unit * 0.015, textAlign: 'center',
        }}>
          {/* Massive stat number with multi-layered glow */}
          <div style={{
            fontSize: unit * 0.22, fontWeight: 900, color: config.statAccent,
            lineHeight: 0.9, letterSpacing: '-0.05em',
            textShadow: [
              `0 0 ${unit * 0.04}px ${config.statAccent}40`,
              `0 0 ${unit * 0.1}px ${config.statAccent}20`,
              `0 ${unit * 0.01}px ${unit * 0.02}px rgba(0,0,0,0.3)`,
            ].join(', '),
          }}>
            {config.statValue}
          </div>
          {/* Stat label — title case, larger, tighter spacing */}
          <div style={{
            fontSize: unit * 0.038, fontWeight: 700, color: config.headlineColor,
            letterSpacing: '-0.01em',
          }}>
            {config.statLabel}
          </div>
          <p style={{
            fontSize: unit * 0.02, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, maxWidth: '80%', opacity: 0.7,
          }}>
            {config.statSubtext}
          </p>
        </div>

        <div>
          {/* Left-aligned headline */}
          <h2 style={{
            fontSize: unit * 0.05, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0, marginBottom: unit * 0.012,
            textAlign: 'left',
          }}>
            {h}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: unit * 0.02 }}>
            <p style={{
              fontSize: unit * 0.019, color: config.paragraphColor,
              lineHeight: 1.4, margin: 0, flex: 1,
            }}>
              {p}
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              whiteSpace: 'nowrap',
              padding: `${unit * 0.022}px ${unit * 0.055}px`,
              minHeight: unit * 0.05,
              background: config.statAccent, color: config.ctaTextColor,
              borderRadius: unit * 0.05, fontSize: unit * 0.022, fontWeight: 800,
              ...(config.accentGlow ? { boxShadow: `0 ${unit * 0.008}px ${unit * 0.035}px ${config.statAccent}60` } : {}),
            }}>
              {cta ?? config.ctaText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
