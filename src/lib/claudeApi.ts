export interface AdCopyResult {
  headline: string;
  paragraph: string;
  cta: string;
}

export class ClaudeApiError extends Error {
  readonly code: 'invalid_key' | 'rate_limited' | 'network' | 'bad_response';

  constructor(
    message: string,
    code: 'invalid_key' | 'rate_limited' | 'network' | 'bad_response',
  ) {
    super(message);
    this.code = code;
  }
}

const SYSTEM_PROMPT = `You are an expert advertising copywriter specializing in Meta/Facebook ads. Given a marketing brief, generate exactly 8 ad copy variations. Each variation has:
- headline (max 12 words, punchy, attention-grabbing)
- paragraph (1-2 sentences, compelling primary text)
- cta (short call-to-action button text, 2-5 words, varied per ad — e.g. "Get Started", "See the Data", "Try It Free", "Book a Call", "Download Now")

Vary the CTAs across variations — don't repeat the same CTA. Match the CTA to the ad's angle and intent.

Respond ONLY with a JSON array of objects, each with "headline", "paragraph", and "cta" keys. No markdown, no explanation, just the JSON array.`;

export async function generateAdCopy(
  apiKey: string,
  briefText: string,
  tone: string,
  signal?: AbortSignal,
): Promise<AdCopyResult[]> {
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
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Tone: ${tone}\n\nMarketing Brief:\n${briefText}`,
          },
        ],
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

  // Extract text content from Claude response
  const msg = body as { content?: { type: string; text: string }[] };
  const textBlock = msg.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  // Parse JSON — strip code fences if present
  let jsonStr = textBlock.text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  if (!Array.isArray(parsed)) {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  const results: AdCopyResult[] = [];
  for (const item of parsed) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).headline === 'string' &&
      typeof (item as Record<string, unknown>).paragraph === 'string'
    ) {
      const rec = item as Record<string, string>;
      results.push({
        headline: rec.headline,
        paragraph: rec.paragraph,
        cta: typeof rec.cta === 'string' ? rec.cta : 'Learn More \u2192',
      });
    }
  }

  if (results.length === 0) {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  return results;
}
