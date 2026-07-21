import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('analysis rate limiter', () => {
  it('allows requests up to the configured limit and then rejects them', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1_000, now: () => 100 });

    expect(limiter.take('judge').allowed).toBe(true);
    expect(limiter.take('judge')).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.take('judge')).toMatchObject({ allowed: false, remaining: 0 });
    expect(limiter.take('another-judge').allowed).toBe(true);
  });

  it('opens a fresh window after the reset time', () => {
    let timestamp = 100;
    const limiter = createRateLimiter({ max: 1, windowMs: 1_000, now: () => timestamp });

    expect(limiter.take('judge').allowed).toBe(true);
    expect(limiter.take('judge').allowed).toBe(false);
    timestamp = 1_100;
    expect(limiter.take('judge')).toMatchObject({ allowed: true, remaining: 0, resetAt: 2_100 });
  });
});
