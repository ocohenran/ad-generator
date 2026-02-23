export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  subreddit: string;
  score: number;
  num_comments: number;
  permalink: string;
  created_utc: number;
}

export interface SavedQuote {
  id: string;
  text: string;
  subreddit: string;
  postTitle: string;
  score: number;
}

export type RedditSort = 'relevance' | 'top' | 'new';

interface RedditListingChild {
  data: {
    id: string;
    title: string;
    selftext: string;
    subreddit: string;
    score: number;
    num_comments: number;
    permalink: string;
    created_utc: number;
  };
}

interface RedditListingResponse {
  data: {
    children: RedditListingChild[];
  };
}

export async function searchReddit(
  query: string,
  options: { subreddit?: string; sort?: RedditSort; limit?: number } = {},
  signal?: AbortSignal,
): Promise<RedditPost[]> {
  const { subreddit, sort = 'relevance', limit = 25 } = options;

  const params = new URLSearchParams({
    q: query,
    sort,
    limit: String(limit),
    raw_json: '1',
  });

  let url: string;
  if (subreddit) {
    params.set('restrict_sr', 'on');
    url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?${params}`;
  } else {
    params.set('restrict_sr', 'false');
    url = `https://www.reddit.com/search.json?${params}`;
  }

  const res = await fetch(url, {
    signal,
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Reddit search failed (${res.status})`);
  }

  const json: RedditListingResponse = await res.json();

  return json.data.children.map((child) => ({
    id: child.data.id,
    title: child.data.title,
    selftext: child.data.selftext,
    subreddit: child.data.subreddit,
    score: child.data.score,
    num_comments: child.data.num_comments,
    permalink: child.data.permalink,
    created_utc: child.data.created_utc,
  }));
}

export function formatQuotesAsBrief(quotes: SavedQuote[]): string {
  const lines = quotes.map(
    (q, i) => `${i + 1}. "${q.text}" — r/${q.subreddit} (${q.score} upvotes)`,
  );
  return [
    'Research from Reddit — real ICP language and pain points:',
    '',
    ...lines,
    '',
    'Use these exact phrases and pain points to write ad copy that resonates with this audience.',
  ].join('\n');
}
