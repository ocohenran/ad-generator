export type TemplateType = 'standard' | 'before-after' | 'testimonial' | 'stats' | 'product-spotlight' | 'bold-statement';
export type AspectRatio = '1:1' | '4:5' | '9:16' | '16:9';
export type Theme = 'dark' | 'light';
export type BrainstormTone = 'professional' | 'playful' | 'urgent' | 'luxury' | 'minimal';
export type LayoutVariant = 'centered' | 'asymmetric';

export const ASPECT_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
};

export const FONT_OPTIONS = [
  { label: 'Inter', value: "'Inter', system-ui, sans-serif" },
  { label: 'Poppins', value: "'Poppins', sans-serif" },
  { label: 'Sora', value: "'Sora', sans-serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'DM Sans', value: "'DM Sans', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
] as const;

export interface AdConfig {
  template: TemplateType;
  aspectRatio: AspectRatio;
  fontFamily: string;
  backgroundImage: string | null;
  // Standard template
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  gradientMid?: string;
  // Before/After template
  beforeBg: string;
  afterBg: string;
  beforeLabel: string;
  afterLabel: string;
  // Testimonial template
  testimonialQuote: string;
  testimonialAuthor: string;
  testimonialRole: string;
  testimonialBg: string;
  // Stats template
  statValue: string;
  statLabel: string;
  statSubtext: string;
  statBg: string;
  statAccent: string;
  // Product Spotlight
  spotlightBg: string;
  spotlightAccent: string;
  // Common
  logoText: string;
  headline: string;
  paragraph: string;
  ctaText: string;
  ctaColor: string;
  ctaTextColor: string;
  headlineColor: string;
  paragraphColor: string;
  showGrain: boolean;
  // Modern additions
  headlineFontFamily?: string;
  accentGlow?: boolean;
  layoutVariant?: LayoutVariant;
}

export interface AdVariation {
  id: string;
  headline: string;
  paragraph: string;
  cta?: string;
}

export interface TemplateProps {
  config: AdConfig;
  headline?: string;
  paragraph?: string;
  cta?: string;
  scale?: number;
  width: number;
  height: number;
}

export const DEFAULT_CONFIG: AdConfig = {
  template: 'standard',
  aspectRatio: '1:1',
  fontFamily: "'Inter', system-ui, sans-serif",
  backgroundImage: null,
  gradientFrom: '#6D28D9',
  gradientTo: '#EC4899',
  gradientMid: '#7C3AED',
  gradientAngle: 135,
  beforeBg: '#0A0F1E',
  afterBg: '#0B1220',
  beforeLabel: 'BEFORE',
  afterLabel: 'AFTER',
  testimonialQuote: '"GWork transformed how our teams operate. The behavioral nudges are subtle but the results are undeniable."',
  testimonialAuthor: 'Sarah Chen',
  testimonialRole: 'VP People, TechCorp',
  testimonialBg: '#0A0F1E',
  statValue: '34%',
  statLabel: 'Productivity Increase',
  statSubtext: 'Average improvement across 500+ enterprise teams using GWork behavioral nudges.',
  statBg: '#0A0F1E',
  statAccent: '#7C3AED',
  spotlightBg: '#0A0F1E',
  spotlightAccent: '#FA6F1C',
  logoText: 'GWork',
  headline: 'Transform Your Workforce Behavior',
  paragraph: 'The behavioral change platform that drives measurable results for enterprise teams. Backed by science, powered by AI.',
  ctaText: 'Book a Demo \u2192',
  ctaColor: '#FA6F1C',
  ctaTextColor: '#ffffff',
  headlineColor: '#ffffff',
  paragraphColor: '#e2e8f0',
  showGrain: true,
  accentGlow: true,
  layoutVariant: 'asymmetric',
};

export const SAMPLE_VARIATIONS: AdVariation[] = [
  {
    id: '1',
    headline: 'Your Team Is Underperforming. Here\'s Why.',
    paragraph: 'GWork identifies hidden behavioral bottlenecks and delivers targeted nudges that increase productivity by 34%. No more guessing.',
  },
  {
    id: '2',
    headline: 'Stop Training. Start Changing Behavior.',
    paragraph: 'Traditional L&D fails because it teaches knowledge, not habits. GWork rewires daily workflows with micro-interventions that stick.',
  },
  {
    id: '3',
    headline: '87% of Change Initiatives Fail. Yours Won\'t.',
    paragraph: 'GWork\'s behavioral science engine turns organizational change from a coin flip into a predictable, measurable process.',
  },
  {
    id: '4',
    headline: 'The ROI of Better Habits Is $4.2M/Year',
    paragraph: 'Enterprise behavioral change isn\'t soft \u2014 it\'s the highest-leverage investment you\'re not making. See the data.',
  },
];
