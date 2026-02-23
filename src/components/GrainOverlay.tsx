import { useEffect } from 'react';

const GRAIN_FILTER_ID = 'grain-shared';

// Ensure exactly one shared SVG filter exists in the document
function ensureGrainFilter() {
  if (document.getElementById(GRAIN_FILTER_ID)) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.innerHTML = `
    <filter id="${GRAIN_FILTER_ID}">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
  `;
  document.body.appendChild(svg);
}

export function GrainOverlay() {
  useEffect(() => {
    ensureGrainFilter();
  }, []);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        opacity: 0.35,
        mixBlendMode: 'overlay',
      }}
    >
      <rect width="100%" height="100%" filter={`url(#${GRAIN_FILTER_ID})`} />
    </svg>
  );
}
