import { useState, useRef, useCallback, useMemo } from 'react';
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

/** Score a post for recommendation — higher = more useful for ad copy research */
function recommendScore(post: RedditPost): number {
  let score = 0;
  // Has actual text content (not just a link post)
  if (post.selftext && post.selftext.length > 50) score += 3;
  // Engagement signals
  if (post.score >= 50) score += 2;
  else if (post.score >= 10) score += 1;
  if (post.num_comments >= 20) score += 2;
  else if (post.num_comments >= 5) score += 1;
  // Longer text = richer language to mine
  if (post.selftext && post.selftext.length > 200) score += 1;
  return score;
}

export function ResearchPanel({ state, onStateChange, onSendToBrief }: Props) {
  const { query, subreddit, sort, results, savedQuotes } = state;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotesExpanded, setQuotesExpanded] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Brief → keywords
  const [briefText, setBriefText] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKws, setSelectedKws] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [showBriefInput, setShowBriefInput] = useState(true);

  // Recommended post IDs — scales with number of selected keywords
  const recommendedIds = useMemo(() => {
    if (results.length === 0) return new Set<string>();
    const kwCount = Math.max(selectedKws.size, 1);
    const maxRecommended = Math.min(5 + (kwCount - 1) * 3, results.length);
    const scored = results
      .map((p) => ({ id: p.id, score: recommendScore(p) }))
      .filter((p) => p.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRecommended);
    return new Set(scored.map((p) => p.id));
  }, [results, selectedKws.size]);

  // Reusable search function
  const doSearch = useCallback(async (searchQuery: string, currentState: ResearchState) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const posts = await searchReddit(
        searchQuery,
        { subreddit: currentState.subreddit.trim() || undefined, sort: currentState.sort },
        controller.signal,
      );
      onStateChange({ ...currentState, query: searchQuery, results: posts });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [onStateChange]);

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
      setShowBriefInput(false);

      // Auto-search the first keyword
      if (data.keywords.length > 0) {
        const first = data.keywords[0];
        setSelectedKws(new Set([first]));
        doSearch(first, state);
      }
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  const handleChipClick = (kw: string) => {
    const next = new Set(selectedKws);
    if (next.has(kw)) {
      next.delete(kw);
    } else {
      next.add(kw);
    }
    if (next.size === 0) return;
    setSelectedKws(next);
    const combined = Array.from(next).join(' OR ');
    doSearch(combined, state);
  };

  const patch = (partial: Partial<ResearchState>) => {
    onStateChange({ ...state, ...partial });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSelectedKws(new Set());
    doSearch(query.trim(), state);
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

  const saveAllRecommended = () => {
    const newQuotes = results
      .filter((p) => recommendedIds.has(p.id) && !savedQuotes.some((q) => q.id === p.id))
      .map((post) => ({
        id: post.id,
        text: post.selftext
          ? `${post.title} — ${snippet(post.selftext, 150)}`
          : post.title,
        subreddit: post.subreddit,
        postTitle: post.title,
        score: post.score,
      }));
    if (newQuotes.length > 0) {
      patch({ savedQuotes: [...savedQuotes, ...newQuotes] });
    }
  };

  const removeQuote = (id: string) => {
    patch({ savedQuotes: savedQuotes.filter((q) => q.id !== id) });
  };

  const sendToBrainstormer = () => {
    if (savedQuotes.length === 0) return;
    const brief = formatQuotesAsBrief(savedQuotes);
    onSendToBrief(brief);
  };

  const unsavedRecommendedCount = results.filter(
    (p) => recommendedIds.has(p.id) && !savedQuotes.some((q) => q.id === p.id),
  ).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Brief input */}
      {showBriefInput ? (
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <label className="editor-label">Paste Marketing Brief</label>
          <textarea
            className="editor-input"
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            placeholder="Paste headlines, value props, taglines... AI extracts Reddit search keywords"
            rows={3}
            style={{ fontSize: 12, resize: 'vertical', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <button
            className="btn-primary"
            onClick={handleExtractKeywords}
            disabled={extracting || !briefText.trim()}
            style={{ marginTop: 6, width: '100%' }}
          >
            {extracting ? 'Extracting...' : 'Extract Keywords & Search'}
          </button>
          {extractError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{extractError}</div>
          )}
        </div>
      ) : null}

      {/* Keyword chips */}
      {keywords.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Keywords</span>
              {' '}<span style={{ fontSize: 10, opacity: 0.7 }}>(click to toggle)</span>
            </span>
            <button
              onClick={() => { setShowBriefInput(true); setKeywords([]); setSelectedKws(new Set()); }}
              style={{
                background: 'none', border: 'none', color: 'var(--text-dim)',
                cursor: 'pointer', fontSize: 11, padding: 0, textDecoration: 'underline',
              }}
            >
              Change brief
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {keywords.map((kw, i) => {
              const isActive = selectedKws.has(kw);
              return (
                <button
                  key={i}
                  onClick={() => handleChipClick(kw)}
                  disabled={loading}
                  style={{
                    fontSize: 11,
                    background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 12, padding: '3px 10px', cursor: loading ? 'wait' : 'pointer',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  {kw}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual search */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="editor-input"
          value={query}
          onChange={(e) => { patch({ query: e.target.value }); setSelectedKws(new Set()); }}
          onKeyDown={handleKeyDown}
          placeholder="Search Reddit..."
          style={{ fontSize: 12, flex: 1, minWidth: 0, boxSizing: 'border-box' }}
        />
        <input
          className="editor-input"
          value={subreddit}
          onChange={(e) => patch({ subreddit: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="subreddit"
          style={{ fontSize: 12, width: 90, flexShrink: 0, boxSizing: 'border-box' }}
        />
      </div>

      {/* Sort + Search */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.key}
            className={`template-btn ${sort === s.key ? 'active' : ''}`}
            onClick={() => patch({ sort: s.key })}
            style={{ fontSize: 11 }}
          >
            {s.label}
          </button>
        ))}
        <button
          className="btn-primary"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 14px' }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{error}</span>
          <button
            onClick={handleSearch}
            style={{
              background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)',
              borderRadius: 4, fontSize: 11, padding: '2px 8px', cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {results.length} results
              {recommendedIds.size > 0 && (
                <span style={{ color: '#a855f7', marginLeft: 6, fontWeight: 600 }}>
                  {recommendedIds.size} recommended
                </span>
              )}
            </span>
            {unsavedRecommendedCount > 0 && (
              <button
                className="btn-secondary"
                onClick={saveAllRecommended}
                style={{
                  fontSize: 10, padding: '2px 8px', flexShrink: 0,
                  borderColor: 'rgba(168, 85, 247, 0.4)',
                  color: '#a855f7',
                  background: 'rgba(168, 85, 247, 0.08)',
                }}
              >
                Save {unsavedRecommendedCount} recommended
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {results.map((post) => {
              const isSaved = savedQuotes.some((q) => q.id === post.id);
              const isRecommended = recommendedIds.has(post.id);
              return (
                <div
                  key={post.id}
                  style={{
                    padding: '10px 12px',
                    overflow: 'hidden',
                    background: isRecommended ? 'rgba(168, 85, 247, 0.04)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isRecommended ? 'rgba(168, 85, 247, 0.35)' : 'var(--border)'}`,
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', minWidth: 0 }}>
                    {isRecommended && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#a855f7',
                        background: 'rgba(168, 85, 247, 0.12)', padding: '1px 5px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>
                        Recommended
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: 'var(--accent)',
                      background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '1px 6px', borderRadius: 4,
                    }}>
                      r/{post.subreddit}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {post.score} pts &middot; {post.num_comments} comments &middot; {timeAgo(post.created_utc)}
                    </span>
                  </div>
                  <a
                    href={`https://www.reddit.com${post.permalink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none',
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                      wordBreak: 'break-word',
                    }}
                  >
                    {post.title}
                  </a>
                  {post.selftext && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-muted)', marginTop: 4,
                      overflow: 'hidden', wordBreak: 'break-word',
                    }}>
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
        </div>
      )}

      {/* Next Step CTA — always visible when quotes are saved */}
      {savedQuotes.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0,
          background: 'var(--bg-secondary)', paddingTop: 12, paddingBottom: 4,
          borderTop: '1px solid var(--border)',
          zIndex: 10,
        }}>
          <button
            onClick={sendToBrainstormer}
            style={{
              width: '100%', padding: '12px 16px',
              background: '#a855f7', color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s, transform 0.15s',
              boxShadow: '0 2px 12px rgba(168, 85, 247, 0.3)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#9333ea'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#a855f7'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Next: Generate Ad Copy
            <span style={{ fontSize: 18 }}>{'\u2192'}</span>
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', marginTop: 6 }}>
            {savedQuotes.length} quote{savedQuotes.length !== 1 ? 's' : ''} will be sent as your creative brief
          </div>
        </div>
      )}

      {/* Saved Quotes list */}
      {savedQuotes.length > 0 && (
        <div>
          <button
            onClick={() => setQuotesExpanded((p) => !p)}
            style={{
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            }}
          >
            {quotesExpanded ? '\u25BC' : '\u25B6'} Saved Quotes ({savedQuotes.length})
          </button>

          {quotesExpanded && (
            <div>
              {savedQuotes.map((q, i) => (
                <div key={q.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 20px',
                  gap: 4,
                  padding: '8px 0',
                  borderBottom: i < savedQuotes.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ minWidth: 0, wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 10, marginBottom: 2 }}>r/{q.subreddit}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>
                      {q.postTitle}
                    </div>
                  </div>
                  <button
                    onClick={() => removeQuote(q.id)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--text-dim)',
                      cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1,
                    }}
                    aria-label="Remove quote"
                  >&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
