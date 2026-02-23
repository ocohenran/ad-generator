import { useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import type { AdConfig, AdVariation, AspectRatio } from '../types';
import { ASPECT_DIMENSIONS } from '../types';
import { AdPreview } from '../components/AdPreview';

export type ExportFormat = 'png' | 'jpeg';

interface ExportOptions {
  config: AdConfig;
  variations: AdVariation[];
  format: ExportFormat;
  jpegQuality: number;
  filenamePattern: string;
  activeVariation?: AdVariation | null;
}

function buildFilename(
  pattern: string, config: AdConfig, variation: AdVariation | null, index: number
): string {
  const safeName = variation
    ? variation.headline.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')
    : 'preview';
  return pattern
    .replace('{brand}', config.logoText.replace(/[^a-zA-Z0-9]/g, '_'))
    .replace('{template}', config.template)
    .replace('{num}', String(index).padStart(2, '0'))
    .replace('{headline}', safeName)
    .replace('{ratio}', config.aspectRatio.replace(':', 'x'));
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Canvas toBlob returned null — canvas may be tainted by cross-origin image')),
      mimeType,
      quality
    );
  });
}

async function captureElement(
  element: HTMLElement, dims: { w: number; h: number }, format: ExportFormat, quality: number
): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 1, useCORS: true, backgroundColor: null,
    width: dims.w, height: dims.h,
  });
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  return canvasToBlob(canvas, mimeType, format === 'jpeg' ? quality / 100 : undefined);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Wait for fonts to load, React to paint, and a frame to render
function waitForPaint(): Promise<void> {
  return document.fonts.ready.then(
    () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 50)))
  );
}

// Render an AdPreview offscreen, wait for fonts + paint, capture, and clean up
async function renderAndCapture(
  config: AdConfig, dims: { w: number; h: number },
  format: ExportFormat, quality: number,
  headline?: string, paragraph?: string, cta?: string,
): Promise<Blob> {
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(offscreen);

  const root = createRoot(offscreen);
  try {
    flushSync(() => {
      root.render(
        <AdPreview config={config} headline={headline} paragraph={paragraph} cta={cta} scale={1} />
      );
    });
    await waitForPaint();
    return await captureElement(offscreen, dims, format, quality);
  } finally {
    root.unmount();
    offscreen.remove();
  }
}

export function useExport(opts: ExportOptions) {
  const { config, variations, format, jpegQuality, filenamePattern, activeVariation } = opts;
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });
  const [exportError, setExportError] = useState<string | null>(null);
  const exportingRef = useRef(false);

  const dims = ASPECT_DIMENSIONS[config.aspectRatio];
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  const exportSingle = useCallback(async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await renderAndCapture(
        config, dims, format, jpegQuality,
        activeVariation?.headline, activeVariation?.paragraph, activeVariation?.cta,
      );
      downloadBlob(blob, `${buildFilename(filenamePattern, config, activeVariation ?? null, 0)}.${ext}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setExportError(msg);
      console.error('Export failed:', err);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [config, dims, format, jpegQuality, filenamePattern, ext, activeVariation]);

  const exportBulk = useCallback(async () => {
    if (variations.length === 0 || exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setExportError(null);
    setExportProgress({ current: 0, total: variations.length });

    const zip = new JSZip();
    const offscreen = document.createElement('div');
    offscreen.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(offscreen);

    let failCount = 0;
    try {
      for (let i = 0; i < variations.length; i++) {
        setExportProgress({ current: i + 1, total: variations.length });

        const container = document.createElement('div');
        offscreen.appendChild(container);
        const root = createRoot(container);

        try {
          flushSync(() => {
            root.render(
              <AdPreview
                config={config}
                headline={variations[i].headline}
                paragraph={variations[i].paragraph}
                cta={variations[i].cta}
                scale={1}
              />
            );
          });
          await waitForPaint();

          const blob = await captureElement(container, dims, format, jpegQuality);
          const name = `${buildFilename(filenamePattern, config, variations[i], i + 1)}.${ext}`;
          zip.file(name, blob);
        } catch (err) {
          failCount++;
          console.error(`Export variation ${i + 1} failed:`, err);
        } finally {
          root.unmount();
          container.remove();
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, `ad-creatives-${config.template}-${config.aspectRatio.replace(':', 'x')}.zip`);
      if (failCount > 0) {
        setExportError(`${failCount} variation(s) failed to export`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bulk export failed';
      setExportError(msg);
      console.error('Bulk export failed:', err);
    } finally {
      offscreen.remove();
      exportingRef.current = false;
      setExporting(false);
    }
  }, [variations, config, dims, format, jpegQuality, filenamePattern, ext]);

  const exportBatchResize = useCallback(async () => {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setExportError(null);
    const zip = new JSZip();
    const ratios: AspectRatio[] = ['1:1', '4:5', '9:16', '16:9'];
    setExportProgress({ current: 0, total: ratios.length });

    const offscreen = document.createElement('div');
    offscreen.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(offscreen);

    let failCount = 0;
    try {
      for (let i = 0; i < ratios.length; i++) {
        setExportProgress({ current: i + 1, total: ratios.length });
        const ratio = ratios[i];
        const d = ASPECT_DIMENSIONS[ratio];

        const container = document.createElement('div');
        offscreen.appendChild(container);
        const root = createRoot(container);

        try {
          const batchConfig = { ...config, aspectRatio: ratio };
          flushSync(() => {
            root.render(
              <AdPreview
                config={batchConfig}
                headline={activeVariation?.headline}
                paragraph={activeVariation?.paragraph}
                cta={activeVariation?.cta}
                scale={1}
              />
            );
          });
          await waitForPaint();

          const blob = await captureElement(container, d, format, jpegQuality);
          zip.file(`${config.logoText.replace(/[^a-zA-Z0-9]/g, '_')}_${config.template}_${ratio.replace(':', 'x')}.${ext}`, blob);
        } catch (err) {
          failCount++;
          console.error(`Export ${ratio} failed:`, err);
        } finally {
          root.unmount();
          container.remove();
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, `ad-creatives-all-sizes.zip`);
      if (failCount > 0) {
        setExportError(`${failCount} size(s) failed to export`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Batch resize export failed';
      setExportError(msg);
      console.error('Batch resize export failed:', err);
    } finally {
      offscreen.remove();
      exportingRef.current = false;
      setExporting(false);
    }
  }, [config, format, jpegQuality, ext, activeVariation]);

  const getImageBlob = useCallback(async (): Promise<Blob> => {
    return renderAndCapture(
      config, dims, format, jpegQuality,
      activeVariation?.headline, activeVariation?.paragraph, activeVariation?.cta,
    );
  }, [config, dims, format, jpegQuality, activeVariation]);

  const getVariationBlob = useCallback(async (variation: AdVariation): Promise<Blob> => {
    return renderAndCapture(
      config, dims, format, jpegQuality,
      variation.headline, variation.paragraph, variation.cta,
    );
  }, [config, dims, format, jpegQuality]);

  const clearError = useCallback(() => setExportError(null), []);

  return { exporting, exportProgress, exportError, clearError, exportSingle, exportBulk, exportBatchResize, getImageBlob, getVariationBlob };
}
