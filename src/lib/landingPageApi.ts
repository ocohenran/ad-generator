// --- Types ---

export interface LandingPageContent {
  title: string;
  subheadline: string;
  heroText: string;
  benefits: { heading: string; body: string }[];
  ctaHeading: string;
  ctaBody: string;
  ctaButton: string;
  faqs: { question: string; answer: string }[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    focusKeyword: string;
    slug: string;
  };
}

export interface LandingPagePublishRequest {
  content: LandingPageContent;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
}

export interface LandingPagePublishResult {
  pageId: number;
  editUrl: string;
  previewUrl: string;
}

// --- AI Generation (server-side) ---

export async function generateLandingPage(
  ad: { headline: string; body: string; ctaText: string; cpc?: number; ctr?: number; spend?: number; clicks?: number },
  signal?: AbortSignal,
): Promise<LandingPageContent> {
  let response: Response;
  try {
    response = await fetch('/api/landing-page/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ad),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new Error('Network error. Is the server running?');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error((err as { error?: string }).error || 'Generation failed');
  }

  return response.json();
}

// --- Publish ---

export async function publishLandingPage(
  data: LandingPagePublishRequest,
): Promise<LandingPagePublishResult> {
  const response = await fetch('/api/landing-page/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Publish failed' }));
    throw new Error((err as { error?: string }).error || 'Publish failed');
  }

  return response.json();
}
