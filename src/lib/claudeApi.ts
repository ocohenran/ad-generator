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
