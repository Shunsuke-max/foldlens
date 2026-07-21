import type { RequestHandler } from 'express';

type RateLimitOptions = {
  max?: number;
  windowMs?: number;
  now?: () => number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const max = options.max ?? positiveInteger(process.env.ANALYSIS_RATE_LIMIT_MAX, 20);
  const windowMs = options.windowMs ?? positiveInteger(process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS, 60 * 60 * 1000);
  const now = options.now ?? Date.now;
  const entries = new Map<string, RateLimitEntry>();

  const take = (key: string): RateLimitDecision => {
    const timestamp = now();
    const previous = entries.get(key);
    const entry = !previous || timestamp >= previous.resetAt
      ? { count: 0, resetAt: timestamp + windowMs }
      : previous;

    const allowed = entry.count < max;
    if (allowed) entry.count += 1;
    entries.set(key, entry);

    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) {
        if (timestamp >= value.resetAt) entries.delete(entryKey);
      }
    }

    return {
      allowed,
      limit: max,
      remaining: Math.max(0, max - entry.count),
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - timestamp) / 1000)),
    };
  };

  const middleware: RequestHandler = (request, response, next) => {
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const decision = take(key);
    response.setHeader('RateLimit-Limit', String(decision.limit));
    response.setHeader('RateLimit-Remaining', String(decision.remaining));
    response.setHeader('RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));
    if (!decision.allowed) {
      response.setHeader('Retry-After', String(decision.retryAfterSeconds));
      response.status(429).json({
        error: 'rate_limited',
        message: 'The public demo analysis limit has been reached. Please try again later.',
      });
      return;
    }
    next();
  };

  return { middleware, take };
}
