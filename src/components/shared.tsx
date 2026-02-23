import type { AdConfig } from '../types';

// C2 FIX: shared LogoBar used by all 5 templates
export function LogoBar({ config, unit, accentColor }: { config: AdConfig; unit: number; accentColor?: string }) {
  const accent = accentColor ?? config.ctaColor;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: unit * 0.012 }}>
      <div style={{
        width: unit * 0.04, height: unit * 0.04,
        borderRadius: unit * 0.008, background: accent,
      }} />
      <span style={{
        fontSize: unit * 0.026, fontWeight: 700,
        color: config.headlineColor, letterSpacing: '-0.01em',
      }}>
        {config.logoText}
      </span>
    </div>
  );
}

// C3 FIX: shared CtaButton used by all 5 templates
export function CtaButton({ config, unit, accentColor }: { config: AdConfig; unit: number; accentColor?: string }) {
  const bg = accentColor ?? config.ctaColor;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      padding: `${unit * 0.018}px ${unit * 0.04}px`,
      background: bg, color: config.ctaTextColor,
      borderRadius: unit * 0.01, fontSize: unit * 0.022, fontWeight: 700,
      letterSpacing: '-0.01em',
    }}>
      {config.ctaText}
    </div>
  );
}

// Shared background image layer
export function BackgroundImage({ src, opacity = 0.2 }: { src: string; opacity?: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1,
      backgroundImage: `url(${src})`,
      backgroundSize: 'cover', backgroundPosition: 'center',
      opacity,
    }} />
  );
}
