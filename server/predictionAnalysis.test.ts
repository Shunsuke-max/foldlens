import { describe, expect, it } from 'vitest';
import { safeFallbackReason } from './predictionAnalysis';

describe('prediction analysis fallback reasons', () => {
  it('does not expose provider error details to the browser', () => {
    const providerError = Object.assign(new Error('sensitive provider diagnostics'), { status: 429 });

    expect(safeFallbackReason(providerError)).toBe('Live analysis quota is unavailable');
    expect(safeFallbackReason(new Error('internal network details'))).toBe('Live analysis request failed');
  });
});
