export interface AdCopyResult {
  headline: string;
  paragraph: string;
  cta: string;
}

export class ClaudeApiError extends Error {
  readonly code: 'invalid_key' | 'rate_limited' | 'overloaded' | 'network' | 'bad_response';

  constructor(
    message: string,
    code: 'invalid_key' | 'rate_limited' | 'overloaded' | 'network' | 'bad_response',
  ) {
    super(message);
    this.code = code;
  }
}

const MAX_RETRIES = 3;

const MODELS = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];

async function fetchWithRetry(
  url: string,
  init: RequestInit & { body?: string },
  signal?: AbortSignal,
): Promise<Response> {
  for (const model of MODELS) {
    // Swap the model in the request body
    const body = init.body ? JSON.parse(init.body) : {};
    body.model = model;
    const modifiedInit = { ...init, body: JSON.stringify(body) };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { ...modifiedInit, signal });
      } catch (err) {
        if (signal?.aborted) throw err;
        throw new ClaudeApiError('Network error. Check your connection.', 'network');
      }

      if ((response.status === 529 || response.status === 503) && attempt < MAX_RETRIES) {
        const wait = (attempt + 1) * 1500;
        await new Promise((r) => setTimeout(r, wait));
        if (signal?.aborted) throw new ClaudeApiError('Aborted', 'network');
        continue;
      }

      if (response.status === 529 || response.status === 503) {
        break; // try next model
      }

      return response;
    }
  }
  throw new ClaudeApiError('All models overloaded. Try again in a minute.', 'overloaded');
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
  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514', // fallback to haiku handled by fetchWithRetry
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Tone: ${tone}\n\nMarketing Brief:\n${briefText}`,
        },
      ],
    }),
  }, signal);

  if (response.status === 401) {
    throw new ClaudeApiError('Invalid API key. Check your key in Settings.', 'invalid_key');
  }
  if (response.status === 429) {
    throw new ClaudeApiError('Rate limited — wait a moment and try again.', 'rate_limited');
  }
  if (response.status === 529) {
    throw new ClaudeApiError('Claude is overloaded. Try again in a minute.', 'overloaded');
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

/* ── Keyword extraction for Reddit research ── */

const KEYWORD_SYSTEM_PROMPT = `You are a Reddit search keyword expert. Given marketing copy (headlines, value propositions, taglines), extract 6-10 short search queries that real people would use on Reddit when discussing the problems, frustrations, or desires this copy addresses.

Rules:
- Each query should be 2-5 words — natural Reddit language, not marketing speak
- Focus on the PAIN POINTS and PROBLEMS implied by the copy, not the product features
- Include a mix of: frustrated rants, advice-seeking questions, and topic keywords
- Think about what someone would type into Reddit search BEFORE they know this product exists

Respond ONLY with a JSON array of strings. No markdown, no explanation, just the JSON array.`;

export async function extractRedditKeywords(
  apiKey: string,
  marketingCopy: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: KEYWORD_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: marketingCopy },
      ],
    }),
  }, signal);

  if (response.status === 401) {
    throw new ClaudeApiError('Invalid API key. Check your key in Settings.', 'invalid_key');
  }
  if (response.status === 429) {
    throw new ClaudeApiError('Rate limited — wait a moment and try again.', 'rate_limited');
  }
  if (response.status === 529) {
    throw new ClaudeApiError('Claude is overloaded. Try again in a minute.', 'overloaded');
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
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  if (!Array.isArray(parsed)) {
    throw new ClaudeApiError('Unexpected response. Try again.', 'bad_response');
  }

  return parsed.filter((item): item is string => typeof item === 'string');
}
