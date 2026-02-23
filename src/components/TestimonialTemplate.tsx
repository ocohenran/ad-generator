import { memo } from 'react';
import type { TemplateProps } from '../types';
import { GrainOverlay } from './GrainOverlay';
import { LogoBar, CtaButton, BackgroundImage } from './shared';

export const TestimonialTemplate = memo(function TestimonialTemplate({ config, headline, paragraph, cta, scale = 1, width, height }: TemplateProps) {
  const h = headline ?? config.headline;
  const p = paragraph ?? config.paragraph;
  const w = width * scale;
  const ht = height * scale;
  const unit = Math.min(w, ht);
  const quoteFont = config.headlineFontFamily ?? config.fontFamily;
  const accent = config.ctaColor;

  return (
    <div style={{
      width: w, height: ht, background: config.testimonialBg,
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', fontFamily: config.fontFamily,
    }}>
      {config.showGrain && <GrainOverlay />}
      {config.backgroundImage && <BackgroundImage src={config.backgroundImage} opacity={0.15} />}

      {/* Subtle bottom gradient glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '40%',
        background: `linear-gradient(to top, ${accent}0a, transparent)`,
        zIndex: 1,
      }} />

      <div style={{
        position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', height: '100%',
        paddingTop: unit * 0.08, paddingBottom: unit * 0.1,
        paddingLeft: unit * 0.065, paddingRight: unit * 0.065,
      }}>
        <LogoBar config={config} unit={unit} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: unit * 0.025 }}>
          {/* Thick left accent bar instead of giant quote mark */}
          <div style={{ display: 'flex', gap: unit * 0.025 }}>
            <div style={{
              width: unit * 0.008, flexShrink: 0,
              background: `linear-gradient(180deg, ${accent}, ${accent}40)`,
              borderRadius: unit * 0.004,
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: unit * 0.02 }}>
              <p style={{
                fontSize: unit * 0.044, fontWeight: 600,
                color: config.headlineColor, lineHeight: 1.35, margin: 0,
                maxWidth: '95%', fontFamily: quoteFont, textAlign: 'left',
              }}>
                {config.testimonialQuote}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: unit * 0.015 }}>
                {/* Avatar with accent border ring */}
                <div style={{
                  width: unit * 0.06, height: unit * 0.06, borderRadius: '50%',
                  padding: 2,
                  background: `linear-gradient(135deg, ${accent}, ${config.gradientTo || accent})`,
                }}>
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: config.testimonialBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: unit * 0.024, fontWeight: 700, color: accent,
                  }}>
                    {config.testimonialAuthor.charAt(0)}
                  </div>
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
          </div>
        </div>

        {/* Thin divider */}
        <div style={{
          height: 1, background: `rgba(255,255,255,0.08)`,
          marginBottom: unit * 0.02,
        }} />

        <div>
          <h2 style={{
            fontSize: unit * 0.04, fontWeight: 800, color: config.headlineColor,
            lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0, marginBottom: unit * 0.012,
            textAlign: 'left',
          }}>
            {h}
          </h2>
          <p style={{
            fontSize: unit * 0.019, color: config.paragraphColor,
            lineHeight: 1.5, margin: 0, marginBottom: unit * 0.02, maxWidth: '85%',
            textAlign: 'left', opacity: 0.85,
          }}>
            {p}
          </p>
          <CtaButton config={config} unit={unit} text={cta} />
        </div>
      </div>
    </div>
  );
});
