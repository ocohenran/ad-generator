import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, CtaButton, BackgroundImage } from './shared';

export const BeforeAfterTemplate = memo(function BeforeAfterTemplate({ config, headline, paragraph, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);

  // B3 FIX: split on period, pipe, or dash delimiter
  const splitMatch = h.match(/^(.+?)\s*[.\-|]\s*(.+)$/);
  const beforeText = splitMatch ? splitMatch[1].trim() : h;
  const afterText = splitMatch ? splitMatch[2].trim() : h;

  return (
    <div style={{
      width: w, height: ht, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.1} />}

      {/* Logo bar */}
      <div style={{
        position: 'relative', zIndex: 3,
        padding: `${unit * 0.035}px ${unit * 0.05}px`,
        background: 'rgba(0,0,0,0.3)',
      }}>
        <LogoBar config={config} unit={unit} />
      </div>

      {/* Split panels */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 3 }}>
        <div style={{
          flex: 1, background: config.beforeBg,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: unit * 0.045, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: unit * 0.004, background: 'var(--danger, #ef4444)',
          }} />
          <span style={{
            fontSize: unit * 0.016, fontWeight: 700, color: 'var(--danger, #ef4444)',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: unit * 0.02,
          }}>
            {config.beforeLabel}
          </span>
          <div style={{
            fontSize: unit * 0.035, fontWeight: 700, color: config.headlineColor,
            lineHeight: 1.2, letterSpacing: '-0.02em', opacity: 0.9,
          }}>
            {beforeText}
          </div>
          <div style={{
            marginTop: unit * 0.03, fontSize: unit * 0.06, fontWeight: 800,
            color: 'var(--danger, #ef4444)', opacity: 0.25,
          }}>
            &#x2715;
          </div>
        </div>

        <div style={{
          width: unit * 0.003, background: 'rgba(255,255,255,0.1)',
          position: 'relative', zIndex: 4,
        }} />

        <div style={{
          flex: 1, background: config.afterBg,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: unit * 0.045, position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: unit * 0.004, background: 'var(--success, #22c55e)',
          }} />
          <span style={{
            fontSize: unit * 0.016, fontWeight: 700, color: 'var(--success, #22c55e)',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: unit * 0.02,
          }}>
            {config.afterLabel}
          </span>
          <div style={{
            fontSize: unit * 0.035, fontWeight: 700, color: config.headlineColor,
            lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>
            {afterText || beforeText}
          </div>
          <div style={{
            marginTop: unit * 0.03, fontSize: unit * 0.06, fontWeight: 800,
            color: 'var(--success, #22c55e)', opacity: 0.25,
          }}>
            &#x2713;
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'relative', zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${unit * 0.03}px ${unit * 0.05}px`,
        background: 'rgba(0,0,0,0.4)',
      }}>
        <p style={{
          fontSize: unit * 0.019, color: config.paragraphColor,
          lineHeight: 1.4, margin: 0, maxWidth: '65%', fontWeight: 400,
        }}>
          {p}
        </p>
        <CtaButton config={config} unit={unit} />
      </div>
    </div>
  );
});
