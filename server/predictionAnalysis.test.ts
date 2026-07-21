import { describe, expect, it } from 'vitest';
import { safeFallbackReason } from './predictionAnalysis';

describe('prediction analysis fallback reasons', () => {
  it('does not expose provider error details to the browser', () => {
    const providerError = Object.assign(new Error('sensitive provider diagnostics'), { status: 429 });

    expect(safeFallbackReason(providerError)).toBe('Live analysis is temporarily rate limited');
    expect(safeFallbackReason({ status: 429, code: 'insufficient_quota' })).toBe('Live analysis credits are unavailable');
    expect(safeFallbackReason({ status: 401, code: 'invalid_api_key' })).toBe('Live analysis is not configured');
    expect(safeFallbackReason({ status: 403, code: 'model_not_found' })).toBe('Live analysis model access is unavailable');
    expect(safeFallbackReason({ name: 'APIConnectionTimeoutError' })).toBe('Live analysis timed out');
    expect(safeFallbackReason(new Error('internal network details'))).toBe('Live analysis request failed');
  });
});
