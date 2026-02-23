import { memo } from 'react';
import type { AdConfig } from '../types';
import { ASPECT_DIMENSIONS } from '../types';
import { StandardTemplate } from './StandardTemplate';
import { BeforeAfterTemplate } from './BeforeAfterTemplate';
import { TestimonialTemplate } from './TestimonialTemplate';
import { StatsTemplate } from './StatsTemplate';
import { ProductSpotlightTemplate } from './ProductSpotlightTemplate';
import { BoldStatementTemplate } from './BoldStatementTemplate';

interface Props {
  config: AdConfig;
  headline?: string;
  paragraph?: string;
  cta?: string;
  scale?: number;
}

export const AdPreview = memo(function AdPreview({ config, headline, paragraph, cta, scale = 1 }: Props) {
  const dims = ASPECT_DIMENSIONS[config.aspectRatio];
  const templateProps = { config, headline, paragraph, cta, scale, width: dims.w, height: dims.h };

  return (
    <div>
      {config.template === 'standard' && <StandardTemplate {...templateProps} />}
      {config.template === 'before-after' && <BeforeAfterTemplate {...templateProps} />}
      {config.template === 'testimonial' && <TestimonialTemplate {...templateProps} />}
      {config.template === 'stats' && <StatsTemplate {...templateProps} />}
      {config.template === 'product-spotlight' && <ProductSpotlightTemplate {...templateProps} />}
      {config.template === 'bold-statement' && <BoldStatementTemplate {...templateProps} />}
    </div>
  );
});
