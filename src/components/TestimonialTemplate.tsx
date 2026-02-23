import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, CtaButton, BackgroundImage } from './shared';

export const TestimonialTemplate = memo(function TestimonialTemplate({ config, headline, paragraph, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);

  return (
    <div style={{
      width: w, height: ht, background: config.testimonialBg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.15} />}

      <div style={{
        position: 'absolute', top: -unit * 0.1, left: -unit * 0.1,
        width: unit * 0.5, height: unit * 0.5, borderRadius: '50%',
        background: config.ctaColor, opacity: 0.08, zIndex: 1,
      }} />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%', padding: unit * 0.065,
      }}>
        <LogoBar config={config} unit={unit} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 0.03 }}>
          <div style={{
            fontSize: unit * 0.12, lineHeight: 0.8, color: config.ctaColor,
            opacity: 0.3, fontFamily: 'Georgia, serif',
          }}>
            &ldquo;
          </div>
          <p style={{
            fontSize: unit * 0.038, fontWeight: 500, fontStyle: 'italic',
            color: config.headlineColor, lineHeight: 1.4, margin: 0, maxWidth: '90%',
          }}>
            {config.testimonialQuote}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: unit * 0.015 }}>
            <div style={{
              width: unit * 0.055, height: unit * 0.055, borderRadius: '50%',
              background: `linear-gradient(135deg, ${config.ctaColor}, ${config.gradientTo || config.ctaColor})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: unit * 0.024, fontWeight: 700, color: config.ctaTextColor,
            }}>
              {config.testimonialAuthor.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: unit * 0.022, fontWeight: 700, color: config.headlineColor }}>
                {config.testimonialAuthor}
              </div>
              <div style={{ fontSize: unit * 0.017, color: config.paragraphColor, opacity: 0.7 }}>
                {config.testimonialRole}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{
            fontSize: unit * 0.04, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0, marginBottom: unit * 0.012,
          }}>
            {h}
          </h2>
          <p style={{
            fontSize: unit * 0.02, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, marginBottom: unit * 0.02, maxWidth: '85%',
          }}>
            {p}
          </p>
          <CtaButton config={config} unit={unit} />
        </div>
      </div>
    </div>
  );
});
