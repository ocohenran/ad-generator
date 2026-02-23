import { ClaudeApiError } from './claudeApi';

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

// --- AI Generation ---

const SYSTEM_PROMPT = `You are an expert landing page copywriter. Given a winning Meta ad (with performance data), generate a complete landing page that preserves the ad's winning angle and messaging.

The landing page must feel like a natural extension of the ad — when someone clicks the ad, the landing page headline should match what they just read.

Return a single JSON object with these exact keys:
- title: Main H1 (matches the ad's winning hook, max 10 words)
- subheadline: Supporting headline (1 sentence, expands the value prop)
- heroText: Hero paragraph (2-3 sentences, the core pitch)
- benefits: Array of 3-4 objects with { heading, body } — concrete outcomes, not features
- ctaHeading: CTA section heading (creates urgency)
- ctaBody: CTA section paragraph (1-2 sentences, final push)
- ctaButton: Button text (2-5 words)
- faqs: Array of 4-5 objects with { question, answer } — address objections
- seo: { metaTitle (max 60 chars with brand), metaDescription (max 155 chars), focusKeyword (2-3 words), slug (lowercase-dashed) }

Respond ONLY with the JSON object. No markdown fences, no explanation.`;

export async function generateLandingPage(
  apiKey: string,
  ad: { headline: string; body: string; ctaText: string; cpc?: number; ctr?: number; spend?: number; clicks?: number },
  signal?: AbortSignal,
): Promise<LandingPageContent> {
  const userMessage = `Winning Meta Ad:
Headline: "${ad.headline}"
Body: "${ad.body}"
CTA: "${ad.ctaText}"

Performance Metrics:
- CPC: $${ad.cpc?.toFixed(2) ?? 'N/A'}
- CTR: ${ad.ctr?.toFixed(2) ?? 'N/A'}%
- Spend: $${ad.spend?.toFixed(2) ?? 'N/A'}
- Clicks: ${ad.clicks ?? 'N/A'}

Generate a landing page that extends this winning ad angle into a full page.`;

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ClaudeApiError('Network error. Check your connection.', 'network');
  }

  if (response.status === 401) {
    throw new ClaudeApiError('Invalid API key. Check your key in Settings.', 'invalid_key');
  }
  if (response.status === 429) {
    throw new ClaudeApiError('Rate limited — wait a moment and try again.', 'rate_limited');
  }
  if (!response.ok) {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  const msg = body as { content?: { type: string; text: string }[] };
  const textBlock = msg.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  let jsonStr = textBlock.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new ClaudeApiError('Failed to parse landing page content. Try again.', 'bad_response');
  }

  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.title !== 'string' ||
    typeof obj.heroText !== 'string' ||
    !Array.isArray(obj.benefits) ||
    !Array.isArray(obj.faqs)
  ) {
    throw new ClaudeApiError('Invalid landing page structure. Try again.', 'bad_response');
  }

  return parsed as LandingPageContent;
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
