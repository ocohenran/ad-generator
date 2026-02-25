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
    subreddit_type?: string;
    score: number;
    num_comments: number;
    permalink: string;
    created_utc: number;
    over_18?: boolean;
  };
}

// Block subreddits that return irrelevant/NSFW results for business queries
const BLOCKED_SUBREDDITS = new Set([
  'askreddit', 'nosleep', 'writingprompts', 'tifu', 'confessions',
  'gonewild', 'nsfw', 'trashy', 'cringe', 'cursedcomments',
  'darkjokes', 'morbidreality', 'watchpeople', 'gore',
  'relationship_advice', 'amitheasshole', 'unpopularopinion',
  'showerthoughts', 'jokes', 'funny', 'memes', 'dankmemes',
]);

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
    limit: String(Math.min(limit + 15, 50)), // fetch extra to compensate for filtering
    raw_json: '1',
    include_over_18: '0',
    nsfw: '0',
  });

  // When no subreddit specified, scope to business-relevant subs to avoid
  // irrelevant/NSFW results for phrases like "initiatives die quickly"
  const BUSINESS_SUBS = 'startups+entrepreneur+smallbusiness+business+marketing+leadership+productivity+humanresources+csuite+management+careerguidance+digitalnomad+saas+sales+consulting+strategy+organizationalpsych+iopsychology+workplace+jobs+antiwork+experienceddevs+agile+projectmanagement';

  let url: string;
  if (subreddit) {
    params.set('restrict_sr', 'on');
    url = `/api/reddit/r/${encodeURIComponent(subreddit)}/search.json?${params}`;
  } else {
    params.set('restrict_sr', 'on');
    url = `/api/reddit/r/${BUSINESS_SUBS}/search.json?${params}`;
  }

  const res = await fetch(url, {
    signal,
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`Reddit search failed (${res.status})`);
  }

  const json: RedditListingResponse = await res.json();

  return json.data.children
    .filter((child) => {
      if (child.data.over_18) return false;
      if (BLOCKED_SUBREDDITS.has(child.data.subreddit.toLowerCase())) return false;
      return true;
    })
    .slice(0, limit)
    .map((child) => ({
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
