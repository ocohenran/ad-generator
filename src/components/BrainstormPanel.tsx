import { useState, useRef, useEffect } from 'react';
import type { AdVariation, BrainstormTone } from '../types';
import { generateAdCopy, ClaudeApiError } from '../lib/claudeApi.ts';
import { parseFile } from '../lib/parseBrief.ts';
import { getApiKey } from './ApiKeyModal.tsx';

interface Props {
  onAdd: (variations: AdVariation[]) => void;
}

type Mode = 'templates' | 'ai';

const TONE_OPTIONS: { key: BrainstormTone; label: string; emoji: string }[] = [
  { key: 'professional', label: 'Professional', emoji: '\ud83d\udcbc' },
  { key: 'playful', label: 'Playful', emoji: '\ud83c\udf89' },
  { key: 'urgent', label: 'Urgent', emoji: '\u26a1' },
  { key: 'luxury', label: 'Luxury', emoji: '\u2728' },
  { key: 'minimal', label: 'Minimal', emoji: '\u25fb' },
];

const POWER_WORDS = new Set([
  'free', 'new', 'proven', 'guaranteed', 'secret', 'exclusive', 'limited', 'instant',
  'discover', 'transform', 'unlock', 'boost', 'crush', 'dominate', 'skyrocket', 'save',
  'ultimate', 'breakthrough', 'revolutionary', 'massive', 'powerful', 'stop', 'why',
  'how', 'what', 'fail', 'mistake', 'cost', 'roi', 'data', 'science', 'now',
]);

function scoreHeadline(headline: string): { score: number; reasons: string[] } {
  const words = headline.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const reasons: string[] = [];
  let score = 50;

  if (words.length >= 5 && words.length <= 12) { score += 10; reasons.push('Good length'); }
  else if (words.length < 4) { score -= 10; reasons.push('Too short'); }
  else if (words.length > 15) { score -= 10; reasons.push('Too long'); }

  const powerCount = words.filter((w) => POWER_WORDS.has(w)).length;
  if (powerCount >= 2) { score += 15; reasons.push(`${powerCount} power words`); }
  else if (powerCount === 1) { score += 8; reasons.push('1 power word'); }
  else { reasons.push('No power words'); }

  if (/\d/.test(headline)) { score += 12; reasons.push('Contains number'); }
  if (headline.endsWith('?')) { score += 5; reasons.push('Question hook'); }
  if (headline.endsWith('.')) { score += 3; reasons.push('Statement'); }
  if (/your|you/i.test(headline)) { score += 8; reasons.push('Direct address'); }

  return { score: Math.min(100, Math.max(0, score)), reasons };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

const TEMPLATES_BY_TONE: Record<BrainstormTone, { h: string; p: string }[]> = {
  professional: [
    { h: `{audience} Are Losing $2.3M/Year to {problem}`, p: `The hidden cost of {problem} is staggering. {product} fixes it with targeted behavioral interventions backed by peer-reviewed research.` },
    { h: `Why 91% of {audience} Fail at {goal}`, p: `It\u2019s not a knowledge gap \u2014 it\u2019s a behavior gap. {product} bridges it with evidence-based micro-nudges.` },
    { h: `The Science of {goal} (Finally Solved)`, p: `{product} uses behavioral science to turn {goal} from aspiration into daily habit. Measurable outcomes guaranteed.` },
    { h: `From {problem} to {goal} in 90 Days`, p: `{product}\u2019s proven framework transforms how {audience} operate. Trusted by Fortune 500 companies.` },
    { h: `Enterprise {goal}: A Data-Driven Approach`, p: `{product} delivers {goal} through precision behavioral interventions. See our case studies.` },
    { h: `The ROI of Fixing {problem}? It\u2019s Massive.`, p: `Companies using {product} see 34% improvement in {goal}. Let the numbers speak for themselves.` },
    { h: `{goal} Isn\u2019t a Training Problem`, p: `It\u2019s a behavior problem. And {product} is the only platform purpose-built to solve it at enterprise scale.` },
    { h: `Unlock Measurable {goal} for {audience}`, p: `{product} identifies behavioral bottlenecks and delivers targeted interventions. Results in 30 days.` },
    { h: `Why Smart {audience} Choose {product}`, p: `Because {problem} isn\u2019t solved by another workshop. It\u2019s solved by changing daily habits at scale.` },
    { h: `{problem} Is a $4.2B Problem. We Have the Solution.`, p: `{product}: behavioral change infrastructure that turns {audience} into high performers. Backed by data.` },
  ],
  playful: [
    { h: `Goodbye {problem}. Hello {goal}.`, p: `{product} makes the switch effortless. Your {audience} will actually enjoy the transformation.` },
    { h: `Plot Twist: {goal} Can Be Fun`, p: `{product} gamifies behavioral change so your {audience} don\u2019t even realize they\u2019re improving. Sneaky? Yes. Effective? Absolutely.` },
    { h: `{problem}? Yikes. Let\u2019s Fix That.`, p: `{product} replaces awkward old methods with smart, delightful nudges. Your {audience} will thank you.` },
    { h: `What If {goal} Was Automatic?`, p: `{product} embeds {goal} into your daily workflow. Like autopilot, but for being awesome at work.` },
    { h: `Your {audience} Deserve Better Than {problem}`, p: `Give them {product} \u2014 the platform that turns good intentions into actual habits (no nagging required).` },
    { h: `Warning: {product} May Cause Excessive {goal}`, p: `Side effects include happier {audience}, better metrics, and your boss being really impressed.` },
    { h: `Stop {problem}-ing. Start {goal}-ing.`, p: `{product} makes the switch so smooth, you\u2019ll wonder why you waited. Try it free.` },
    { h: `{audience}, We Need to Talk About {problem}`, p: `It\u2019s not you, it\u2019s your tools. {product} is the upgrade your workflow has been waiting for.` },
    { h: `Spoiler: {product} Actually Works`, p: `Unlike that training program gathering dust. {product} delivers {goal} with micro-nudges that stick.` },
    { h: `Ready to 3X Your {goal}?`, p: `{product} turns {problem} into a thing of the past. No magic required \u2014 just behavioral science.` },
  ],
  urgent: [
    { h: `Stop Wasting Time on {problem}`, p: `Every day without {product} costs your {audience} real productivity. Fix {problem} now with science-backed interventions.` },
    { h: `{problem} Costs More Than You Think`, p: `Right now, {problem} is draining your budget. {product} stops the bleeding with targeted behavioral nudges.` },
    { h: `87% of Change Initiatives Fail. Act Now.`, p: `Don\u2019t be another statistic. {product} gives {audience} a proven path to {goal} \u2014 starting today.` },
    { h: `Your Competitors Already Fixed {problem}`, p: `While you\u2019re deliberating, they\u2019re deploying {product}. Don\u2019t fall behind. Book a demo now.` },
    { h: `Last Chance: Fix {problem} Before Q3`, p: `{product} delivers measurable {goal} in 90 days. But only if you start now.` },
    { h: `{problem} Is Killing Your Growth. Here\u2019s Proof.`, p: `{product} has the data. And the fix. {audience} who act now see 34% improvement in {goal}.` },
    { h: `Still Struggling with {problem}?`, p: `10,000+ {audience} already solved it with {product}. Every day you wait is another day of lost {goal}.` },
    { h: `The Hidden Cost of Ignoring {problem}`, p: `It\u2019s $2.3M/year. {product} eliminates {problem} with behavioral interventions that start working in weeks.` },
    { h: `Don\u2019t Let {problem} Define Your {audience}`, p: `{product} turns {problem} into {goal} \u2014 fast. Limited pilot spots available.` },
    { h: `Critical: Your {goal} Strategy Is Broken`, p: `{product} replaces guesswork with precision behavioral change. Start your free assessment now.` },
  ],
  luxury: [
    { h: `Elevate Your {audience} Experience`, p: `{product} is the premium behavioral change platform for organizations that demand excellence. Sophisticated. Effective. Refined.` },
    { h: `Where {goal} Meets Elegance`, p: `{product} delivers world-class behavioral transformation with the precision and taste your {audience} expect.` },
    { h: `Crafted for Exceptional {audience}`, p: `{product} isn\u2019t mass-market software. It\u2019s bespoke behavioral change for enterprises that value their people.` },
    { h: `The Art of {goal}`, p: `{product} brings a curated approach to behavioral change \u2014 beautiful in execution, powerful in results.` },
    { h: `Exclusively for Forward-Thinking {audience}`, p: `{product} is invitation-only behavioral change technology. If you\u2019re reading this, you qualify.` },
    { h: `Transform. Transcend. {product}.`, p: `The finest behavioral science, delivered with white-glove implementation for {audience} who accept nothing less.` },
    { h: `{goal}: A Masterclass by {product}`, p: `Our approach to {problem} isn\u2019t just effective \u2014 it\u2019s elegant. See why leading {audience} choose us.` },
    { h: `Beyond {problem}. Into Excellence.`, p: `{product} doesn\u2019t just fix problems. It elevates entire organizations to new standards of {goal}.` },
    { h: `The {product} Difference Is Unmistakable`, p: `Precision behavioral interventions, premium support, and results that speak volumes. For {audience} who lead.` },
    { h: `Redefining {goal} for {audience}`, p: `{product} sets a new standard in behavioral change. Exquisite design. Measurable impact. Zero compromise.` },
  ],
  minimal: [
    { h: `{product}. {goal}. Done.`, p: `Simple behavioral change that works. No complexity, no bloat.` },
    { h: `Fix {problem}.`, p: `{product} \u2014 behavioral nudges for {audience}. Measurable results.` },
    { h: `{goal}`, p: `{product} makes it happen.` },
    { h: `Less {problem}. More {goal}.`, p: `{product} for {audience}.` },
    { h: `One Platform. Real {goal}.`, p: `{product} turns behavioral science into daily habits for {audience}. That\u2019s it.` },
    { h: `{problem} \u2192 {goal}`, p: `{product}. The behavioral change platform.` },
    { h: `Better Behavior. Better Results.`, p: `{product} for {audience} who want {goal} without the noise.` },
    { h: `{product}`, p: `The science of {goal}, simplified. Built for {audience} who value clarity.` },
    { h: `What if it just worked?`, p: `{product} delivers {goal} for {audience}. No training decks. No workshops. Just change.` },
    { h: `Do more. Change less.`, p: `{product} automates {goal} so {audience} can focus on what matters.` },
  ],
};

function generateVariations(description: string, tone: BrainstormTone): AdVariation[] {
  const product = extractBetween(description, 'product:', '\n') || 'Our Platform';
  const audience = extractBetween(description, 'audience:', '\n') || 'Enterprise Teams';
  const problem = extractBetween(description, 'problem:', '\n') || 'low engagement';
  const goal = extractBetween(description, 'goal:', '\n') || 'peak performance';

  const templates = TEMPLATES_BY_TONE[tone];

  return templates.map((t) => ({
    id: crypto.randomUUID(),
    headline: t.h.replace(/\{product\}/g, product).replace(/\{audience\}/g, audience).replace(/\{problem\}/g, problem).replace(/\{goal\}/g, goal),
    paragraph: t.p.replace(/\{product\}/g, product).replace(/\{audience\}/g, audience).replace(/\{problem\}/g, problem).replace(/\{goal\}/g, goal),
  }));
}

function extractBetween(text: string, start: string, end: string): string {
  const lower = text.toLowerCase();
  const startIdx = lower.indexOf(start.toLowerCase());
  if (startIdx === -1) return '';
  const after = text.slice(startIdx + start.length).trim();
  const endIdx = after.indexOf(end);
  return endIdx > 0 ? after.slice(0, endIdx).trim() : after.trim();
}

export function BrainstormPanel({ onAdd }: Props) {
  const [mode, setMode] = useState<Mode>('templates');
  const [description, setDescription] = useState('');
  const [briefText, setBriefText] = useState('');
  const [tone, setTone] = useState<BrainstormTone>('professional');
  const [generated, setGenerated] = useState<AdVariation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Abort in-flight request on mode switch or unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleModeSwitch = (m: Mode) => {
    abortRef.current?.abort();
    setMode(m);
    setGenerated([]);
    setSelected(new Set());
    setAiError(null);
    setAiLoading(false);
  };

  // --- Template mode ---
  const brainstorm = () => {
    const results = generateVariations(description, tone);
    setGenerated(results);
    setSelected(new Set(results.map((r) => r.id)));
  };

  // --- AI mode ---
  const handleAiGenerate = async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setAiError('No API key set. Open Settings to add your Anthropic key.');
      return;
    }
    if (!briefText.trim()) {
      setAiError('Please enter or upload a marketing brief.');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAiLoading(true);
    setAiError(null);
    setGenerated([]);

    try {
      const toneLabel = TONE_OPTIONS.find((t) => t.key === tone)?.label ?? tone;
      const results = await generateAdCopy(apiKey, briefText, toneLabel, controller.signal);
      const variations: AdVariation[] = results.map((r) => ({
        id: crypto.randomUUID(),
        headline: r.headline,
        paragraph: r.paragraph,
      }));
      setGenerated(variations);
      setSelected(new Set(variations.map((v) => v.id)));
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ClaudeApiError) {
        setAiError(err.message);
      } else {
        setAiError('Unexpected error. Try again.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setAiLoading(false);
      }
    }
  };

  const handleFileUpload = async (file: File) => {
    setFileError(null);
    try {
      const text = await parseFile(file);
      setBriefText(text);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to read file.');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  // --- Shared selection logic ---
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(generated.map((g) => g.id)));
  const selectNone = () => setSelected(new Set());

  const addSelected = () => {
    onAdd(generated.filter((g) => selected.has(g.id)));
    setGenerated([]);
    setSelected(new Set());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode toggle */}
      <div className="mode-toggle">
        <button className={mode === 'templates' ? 'active' : ''} onClick={() => handleModeSwitch('templates')}>
          Templates
        </button>
        <button className={mode === 'ai' ? 'active' : ''} onClick={() => handleModeSwitch('ai')}>
          AI Generate
        </button>
      </div>

      {mode === 'templates' ? (
        /* ── Template Mode (existing) ── */
        <>
          <div>
            <label className="editor-label">Describe Your Product & Audience</label>
            <textarea
              className="editor-input"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Product: GWork\nAudience: Enterprise HR Leaders\nProblem: low employee engagement\nGoal: behavioral change at scale`}
              style={{ fontSize: 12 }}
            />
          </div>

          <div>
            <label className="editor-label">Tone & Style</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  className={`template-btn ${tone === t.key ? 'active' : ''}`}
                  onClick={() => setTone(t.key)}
                  style={{ fontSize: 12 }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={brainstorm}>
            Brainstorm 10 Variations
          </button>
        </>
      ) : (
        /* ── AI Generate Mode ── */
        <>
          <div>
            <label className="editor-label">Marketing Brief</label>
            <textarea
              className="editor-input"
              rows={6}
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              placeholder="Paste your marketing brief here, or upload a file below..."
              style={{ fontSize: 12 }}
            />
          </div>

          {/* File upload */}
          <div
            className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileSelect}
            />
            Drop PDF, TXT, or MD here — or click to browse
          </div>
          {fileError && (
            <div style={{ fontSize: 12, color: 'var(--danger)' }}>{fileError}</div>
          )}

          <div>
            <label className="editor-label">Tone & Style</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.key}
                  className={`template-btn ${tone === t.key ? 'active' : ''}`}
                  onClick={() => setTone(t.key)}
                  style={{ fontSize: 12 }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary" onClick={handleAiGenerate} disabled={aiLoading}>
            {aiLoading ? 'Generating...' : 'Generate with AI'}
          </button>

          {aiLoading && (
            <div className="ai-loading">Generating ad variations...</div>
          )}

          {aiError && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 0' }}>{aiError}</div>
          )}
        </>
      )}

      {/* ── Results (shared between modes) ── */}
      {generated.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {selected.size} of {generated.length} selected
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={selectAll}>All</button>
              <button className="btn-secondary" onClick={selectNone}>None</button>
              <button className="btn-primary" onClick={addSelected} disabled={selected.size === 0}>
                Add Selected
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
            {generated.map((g, i) => {
              const { score, reasons } = scoreHeadline(g.headline);
              return (
                <label
                  key={g.id}
                  className="variation-card"
                  style={{ cursor: 'pointer', opacity: selected.has(g.id) ? 1 : 0.5 }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggleSelect(g.id)}
                    style={{ marginRight: 8 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>#{i + 1}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: getScoreColor(score),
                        padding: '1px 6px', borderRadius: 4,
                        background: `${getScoreColor(score)}15`,
                      }}>
                        {score}/100
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                        {reasons.slice(0, 3).join(' \u00b7 ')}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 2 }}>{g.headline}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.paragraph}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
