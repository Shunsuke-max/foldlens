import { describe, expect, it } from 'vitest';
import { resolveRenderEndpoint } from './renderProxy';

describe('resolveRenderEndpoint', () => {
  it('joins a Render origin and API path', () => {
    expect(resolveRenderEndpoint('/api/health', 'https://foldlens.onrender.com').toString())
      .toBe('https://foldlens.onrender.com/api/health');
  });

  it('allows localhost for local proxy verification', () => {
    expect(resolveRenderEndpoint('/api/analyze', 'http://127.0.0.1:4178/').toString())
      .toBe('http://127.0.0.1:4178/api/analyze');
  });

  it('rejects a missing or insecure public origin', () => {
    expect(() => resolveRenderEndpoint('/api/health', '')).toThrow('not configured');
    expect(() => resolveRenderEndpoint('/api/health', 'http://example.com')).toThrow('must use HTTPS');
  });
});
