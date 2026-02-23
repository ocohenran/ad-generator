import { useState, useRef } from 'react';
import { searchReddit, formatQuotesAsBrief } from '../lib/redditApi';
import type { RedditPost, SavedQuote, RedditSort } from '../lib/redditApi';

export interface ResearchState {
  query: string;
  subreddit: string;
  sort: RedditSort;
  results: RedditPost[];
  savedQuotes: SavedQuote[];
}

export const INITIAL_RESEARCH_STATE: ResearchState = {
  query: '',
  subreddit: '',
  sort: 'relevance',
  results: [],
  savedQuotes: [],
};

interface Props {
  state: ResearchState;
  onStateChange: (state: ResearchState) => void;
  onSendToBrief: (brief: string) => void;
}

const SORT_OPTIONS: { key: RedditSort; label: string }[] = [
  { key: 'relevance', label: 'Relevance' },
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'New' },
];

function snippet(text: string, max = 200): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function timeAgo(utc: number): string {
  const diff = Math.floor(Date.now() / 1000 - utc);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

export function ResearchPanel({ state, onStateChange, onSendToBrief }: Props) {
  const { query, subreddit, sort, results, savedQuotes } = state;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotesExpanded, setQuotesExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Brief → keywords state
  const [briefText, setBriefText] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [briefExpanded, setBriefExpanded] = useState(true);

  const handleExtractKeywords = async () => {
    if (!briefText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch('/api/keywords/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: briefText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setKeywords(data.keywords);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  const searchSelected = () => {
    if (selectedKeywords.size === 0) return;
    patch({ query: Array.from(selectedKeywords).join(' OR ') });
  };

  const patch = (partial: Partial<ResearchState>) => {
    onStateChange({ ...state, ...partial });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const posts = await searchReddit(
        query.trim(),
        { subreddit: subreddit.trim() || undefined, sort },
        controller.signal,
      );
      patch({ results: posts });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const saveQuote = (post: RedditPost) => {
    if (savedQuotes.some((q) => q.id === post.id)) return;
    patch({
      savedQuotes: [
        ...savedQuotes,
        {
          id: post.id,
          text: post.selftext
            ? `${post.title} — ${snippet(post.selftext, 150)}`
            : post.title,
          subreddit: post.subreddit,
          postTitle: post.title,
          score: post.score,
        },
      ],
    });
  };

  const removeQuote = (id: string) => {
    patch({ savedQuotes: savedQuotes.filter((q) => q.id !== id) });
  };

  const sendToBrainstormer = () => {
    if (savedQuotes.length === 0) return;
    const brief = formatQuotesAsBrief(savedQuotes);
    onSendToBrief(brief);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Brief → Keywords */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <button
          onClick={() => setBriefExpanded((p) => !p)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {briefExpanded ? '\u25BC' : '\u25B6'} Paste Brief
        </button>

        {briefExpanded && (
          <>
            <textarea
              className="editor-input"
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Paste marketing copy, headlines, value props... AI will extract Reddit search keywords"
              rows={4}
              style={{ fontSize: 12, resize: 'vertical', width: '100%', fontFamily: 'inherit' }}
            />
            <button
              className="btn-primary"
              onClick={handleExtractKeywords}
              disabled={extracting || !briefText.trim()}
              style={{ marginTop: 6, width: '100%' }}
            >
              {extracting ? 'Extracting Keywords...' : 'Extract Keywords'}
            </button>

            {extractError && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{extractError}</div>
            )}

            {keywords.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {keywords.map((kw, i) => {
                    const selected = selectedKeywords.has(kw);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleKeyword(kw)}
                        style={{
                          fontSize: 11, background: selected ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--surface)',
                          border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 12, padding: '4px 10px', cursor: 'pointer',
                          color: selected ? 'var(--accent)' : 'var(--text-muted)',
                          fontWeight: selected ? 600 : 400,
                        }}
                        title="Click to select/deselect"
                      >
                        {selected ? '\u2713 ' : ''}{kw}
                      </button>
                    );
                  })}
                </div>
                {selectedKeywords.size > 0 && (
                  <button
                    className="btn-primary"
                    onClick={searchSelected}
                    style={{ marginTop: 8, width: '100%', fontSize: 12 }}
                  >
                    Search {selectedKeywords.size} keyword{selectedKeywords.size > 1 ? 's' : ''} on Reddit
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Search inputs */}
      <div>
        <label className="editor-label">Search Reddit</label>
        <input
          className="editor-input"
          value={query}
          onChange={(e) => patch({ query: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "employee engagement software frustrations"'
          style={{ fontSize: 12 }}
        />
      </div>

      <div>
        <label className="editor-label">Subreddit (optional)</label>
        <input
          className="editor-input"
          value={subreddit}
          onChange={(e) => patch({ subreddit: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="e.g. humanresources, peopleops"
          style={{ fontSize: 12 }}
        />
      </div>

      {/* Sort */}
      <div style={{ display: 'flex', gap: 6 }}>
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.key}
            className={`template-btn ${sort === s.key ? 'active' : ''}`}
            onClick={() => patch({ sort: s.key })}
            style={{ fontSize: 12 }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <button className="btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
        {loading ? 'Searching...' : 'Search Reddit'}
      </button>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 0' }}>{error}</div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {results.length} results
          </span>
          {results.map((post) => {
            const isSaved = savedQuotes.some((q) => q.id === post.id);
            return (
              <div key={post.id} className="variation-card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: 'var(--accent)',
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '1px 6px', borderRadius: 4,
                  }}>
                    r/{post.subreddit}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {post.score} pts
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {post.num_comments} comments
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    {timeAgo(post.created_utc)}
                  </span>
                </div>
                <a
                  href={`https://www.reddit.com${post.permalink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none' }}
                >
                  {post.title}
                </a>
                {post.selftext && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {snippet(post.selftext)}
                  </div>
                )}
                <button
                  className="btn-secondary"
                  onClick={() => saveQuote(post)}
                  disabled={isSaved}
                  style={{ marginTop: 6, fontSize: 11, padding: '2px 8px' }}
                >
                  {isSaved ? 'Saved' : 'Save Quote'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Saved Quotes */}
      {savedQuotes.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button
            onClick={() => setQuotesExpanded((p) => !p)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {quotesExpanded ? '\u25BC' : '\u25B6'} Saved Quotes ({savedQuotes.length})
          </button>

          {quotesExpanded && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {savedQuotes.map((q) => (
                  <span
                    key={q.id}
                    style={{
                      fontSize: 11, background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4,
                      color: 'var(--text-muted)', maxWidth: '100%',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      r/{q.subreddit}: {q.postTitle.slice(0, 40)}
                    </span>
                    <button
                      onClick={() => removeQuote(q.id)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--text-dim)',
                        cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1,
                      }}
                      aria-label="Remove quote"
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              <button className="btn-primary" onClick={sendToBrainstormer} style={{ width: '100%' }}>
                Send to Brainstormer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
