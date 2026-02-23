import type { AdConfig } from '../types';

/** 3-color mesh gradient background with soft radial orbs */
export function MeshGradientBackground({
  from, mid, to, angle = 135, unit,
}: { from: string; mid?: string; to: string; angle?: number; unit: number }) {
  const midColor = mid ?? from;
  return (
    <>
      {/* Base linear gradient */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `linear-gradient(${angle}deg, ${from}, ${midColor} 50%, ${to})`,
      }} />
      {/* Soft orb top-right */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%',
        width: unit * 0.7, height: unit * 0.7, borderRadius: '50%',
        background: `radial-gradient(circle, ${to}55 0%, transparent 70%)`,
        zIndex: 1, filter: `blur(${unit * 0.06}px)`,
      }} />
      {/* Soft orb bottom-left */}
      <div style={{
        position: 'absolute', bottom: '-10%', left: '-15%',
        width: unit * 0.6, height: unit * 0.6, borderRadius: '50%',
        background: `radial-gradient(circle, ${midColor}40 0%, transparent 70%)`,
        zIndex: 1, filter: `blur(${unit * 0.05}px)`,
      }} />
    </>
  );
}

/** Gradient accent line along an edge */
export function AccentLine({
  from, to, unit, side = 'left',
}: { from: string; to: string; unit: number; side?: 'left' | 'top' | 'right' | 'bottom' }) {
  const isVertical = side === 'left' || side === 'right';
  const gradDir = isVertical ? '180deg' : '90deg';
  return (
    <div style={{
      position: 'absolute',
      [side]: 0,
      top: isVertical ? 0 : undefined,
      left: !isVertical ? 0 : undefined,
      width: isVertical ? unit * 0.006 : '100%',
      height: isVertical ? '100%' : unit * 0.006,
      background: `linear-gradient(${gradDir}, ${from}, ${to})`,
      zIndex: 4,
    }} />
  );
}

/** Parse hex color to relative luminance (0 = black, 1 = white) */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  // sRGB luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Logo bar with actual logo image — auto-inverts "work" text on dark backgrounds */
export function LogoBar({ config, unit, accentColor }: { config: AdConfig; unit: number; accentColor?: string }) {
  const accent = accentColor ?? config.ctaColor;
  const glow = config.accentGlow;
  // If headline color is light, the background is dark → invert the dark logo text to white
  // invert(1) flips dark→light, hue-rotate(180deg) restores the orange hue
  const onDarkBg = luminance(config.headlineColor) > 0.5;
  const filters = [
    ...(onDarkBg ? ['invert(1)', 'hue-rotate(180deg)'] : []),
    ...(glow ? [`drop-shadow(0 0 ${unit * 0.015}px ${accent}60)`] : []),
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: unit * 0.012 }}>
      <img
        src="/gwork-logo.png"
        alt={config.logoText}
        style={{
          height: unit * 0.038,
          width: 'auto',
          objectFit: 'contain',
          ...(filters.length ? { filter: filters.join(' ') } : {}),
        }}
      />
    </div>
  );
}

/** Pill CTA button with glow shadow — sized for Meta's 44x44px min tap target */
export function CtaButton({ config, unit, accentColor, text }: { config: AdConfig; unit: number; accentColor?: string; text?: string }) {
  const bg = accentColor ?? config.ctaColor;
  const glow = config.accentGlow;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: `${unit * 0.024}px ${unit * 0.06}px`,
      minHeight: unit * 0.055,
      background: bg, color: config.ctaTextColor,
      borderRadius: unit * 0.05, fontSize: unit * 0.025, fontWeight: 800,
      letterSpacing: '-0.01em',
      ...(glow ? { boxShadow: `0 ${unit * 0.01}px ${unit * 0.04}px ${bg}60` } : {}),
    }}>
      {text ?? config.ctaText}
    </div>
  );
}

/** Shared background image layer */
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
