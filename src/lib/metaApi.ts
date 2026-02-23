export interface MetaStatus {
  connected: boolean;
  userName?: string;
  adAccountId?: string;
  expiresAt?: number;
}

export interface MetaPage {
  id: string;
  name: string;
}

export interface PublishConfig {
  campaignName: string;
  dailyBudget: number;
  headline: string;
  body: string;
  ctaText: string;
  linkUrl: string;
  pageId: string;
  countries: string[];
}

export const META_CTA_OPTIONS = [
  'Learn More',
  'Shop Now',
  'Sign Up',
  'Apply Now',
  'Book Now',
  'Contact Us',
  'Download',
  'Get Offer',
  'Get Quote',
  'Order Now',
  'Subscribe',
  'Watch More',
  'Send Message',
  'Call Now',
] as const;

export const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'IE', name: 'Ireland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IL', name: 'Israel' },
] as const;

export interface PublishResult {
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  adsManagerUrl: string;
}

export async function getMetaStatus(): Promise<MetaStatus> {
  const res = await fetch('/api/meta/status');
  return res.json();
}

export function startMetaAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    const w = 600, h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const popup = window.open(
      '/api/meta/auth',
      'meta-auth',
      `width=${w},height=${h},left=${left},top=${top}`,
    );

    // If popup was blocked, fall back to checking status
    if (!popup) {
      resolve(false);
      return;
    }

    let resolved = false;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (resolved) return;
      if (e.data?.type === 'meta-auth-success') {
        resolved = true;
        cleanup();
        resolve(true);
      } else if (e.data?.type === 'meta-auth-error') {
        resolved = true;
        cleanup();
        resolve(false);
      }
    };

    // Also poll in case postMessage doesn't fire
    const interval = setInterval(() => {
      if (resolved) return;
      if (popup.closed) {
        resolved = true;
        cleanup();
        // Check status after popup closes
        getMetaStatus().then((s) => resolve(s.connected));
      }
    }, 500);

    function cleanup() {
      window.removeEventListener('message', onMessage);
      clearInterval(interval);
    }

    window.addEventListener('message', onMessage);
  });
}

export async function disconnectMeta(): Promise<void> {
  await fetch('/api/meta/disconnect', { method: 'POST' });
}

export async function getMetaPages(): Promise<MetaPage[]> {
  const res = await fetch('/api/meta/pages');
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.pages || [];
}

export async function uploadImageToMeta(blob: Blob): Promise<{ imageHash: string; imageUrl?: string }> {
  const form = new FormData();
  form.append('image', blob, 'ad-creative.png');

  const res = await fetch('/api/meta/upload-image', { method: 'POST', body: form });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function createMetaAd(
  imageHash: string,
  config: PublishConfig,
): Promise<PublishResult> {
  const res = await fetch('/api/meta/create-ad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageHash, ...config }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
