import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, BackgroundImage } from './shared';

export const StatsTemplate = memo(function StatsTemplate({ config, headline, paragraph, scale = 1, width, height }: TemplateProps) {
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

      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: unit * 0.006, background: config.statAccent, zIndex: 3,
      }} />
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: unit * 0.8, height: unit * 0.8, borderRadius: '50%',
        background: `radial-gradient(circle, ${config.statAccent}15 0%, transparent 70%)`,
        zIndex: 1,
      }} />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%', padding: unit * 0.065,
      }}>
        <LogoBar config={config} unit={unit} accentColor={config.statAccent} />

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', flex: 1, gap: unit * 0.015, textAlign: 'center',
        }}>
          <div style={{
            fontSize: unit * 0.18, fontWeight: 900, color: config.statAccent,
            lineHeight: 0.9, letterSpacing: '-0.05em',
            textShadow: `0 0 ${unit * 0.08}px ${config.statAccent}30`,
          }}>
            {config.statValue}
          </div>
          <div style={{
            fontSize: unit * 0.032, fontWeight: 700, color: config.headlineColor,
            letterSpacing: '0.08em', textTransform: 'uppercase',
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
          <h2 style={{
            fontSize: unit * 0.042, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0, marginBottom: unit * 0.012,
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
              display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
              padding: `${unit * 0.015}px ${unit * 0.035}px`,
              background: config.statAccent, color: config.ctaTextColor,
              borderRadius: unit * 0.008, fontSize: unit * 0.02, fontWeight: 700,
            }}>
              {config.ctaText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
