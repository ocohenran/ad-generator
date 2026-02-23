import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, CtaButton, BackgroundImage } from './shared';

export const BeforeAfterTemplate = memo(function BeforeAfterTemplate({ config, headline, paragraph, cta, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);

  const splitMatch = h.match(/^(.+?)\s*[.\-|]\s*(.+)$/);
  const beforeText = splitMatch ? splitMatch[1].trim() : h;
  const afterText = splitMatch ? splitMatch[2].trim() : h;

  const dangerColor = '#ef4444';
  const successColor = '#05C399';

  return (
    <div style={{
      width: w, height: ht, position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.1} />}

      {/* Logo bar — transparent, respects top safe zone */}
      <div style={{
        position: 'relative', zIndex: 3,
        padding: `${unit * 0.05}px ${unit * 0.05}px ${unit * 0.025}px`,
      }}>
        <LogoBar config={config} unit={unit} />
      </div>

      {/* Split panels */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 3 }}>
        {/* Before panel */}
        <div style={{
          flex: 1, background: config.beforeBg,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: unit * 0.045, position: 'relative',
        }}>
          {/* Circle badge */}
          <div style={{
            width: unit * 0.06, height: unit * 0.06, borderRadius: '50%',
            background: `${dangerColor}20`, border: `2px solid ${dangerColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: unit * 0.028, fontWeight: 800, color: dangerColor,
            marginBottom: unit * 0.02,
          }}>
            &#x2715;
          </div>
          <span style={{
            fontSize: unit * 0.016, fontWeight: 700, color: dangerColor,
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: unit * 0.015,
          }}>
            {config.beforeLabel}
          </span>
          <div style={{
            fontSize: unit * 0.042, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.2, letterSpacing: '-0.02em', textAlign: 'left',
          }}>
            {beforeText}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          width: unit * 0.003, background: 'rgba(255,255,255,0.1)',
          position: 'relative', zIndex: 4,
        }} />

        {/* After panel */}
        <div style={{
          flex: 1, background: config.afterBg,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: unit * 0.045, position: 'relative',
        }}>
          {/* Circle badge */}
          <div style={{
            width: unit * 0.06, height: unit * 0.06, borderRadius: '50%',
            background: `${successColor}20`, border: `2px solid ${successColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: unit * 0.028, fontWeight: 800, color: successColor,
            marginBottom: unit * 0.02,
          }}>
            &#x2713;
          </div>
          <span style={{
            fontSize: unit * 0.016, fontWeight: 700, color: successColor,
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: unit * 0.015,
          }}>
            {config.afterLabel}
          </span>
          <div style={{
            fontSize: unit * 0.042, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.2, letterSpacing: '-0.02em', textAlign: 'left',
          }}>
            {afterText || beforeText}
          </div>
        </div>
      </div>

      {/* Bottom bar — frosted glass, respects bottom safe zone */}
      <div style={{
        position: 'relative', zIndex: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: `${unit * 0.035}px ${unit * 0.05}px ${unit * 0.045}px`,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}>
        <p style={{
          fontSize: unit * 0.018, color: config.paragraphColor,
          lineHeight: 1.4, margin: 0, maxWidth: '60%', fontWeight: 400,
          opacity: 0.85,
        }}>
          {p}
        </p>
        <CtaButton config={config} unit={unit} text={cta} />
      </div>
    </div>
  );
});
