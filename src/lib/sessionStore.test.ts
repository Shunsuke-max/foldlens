// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { demoResult } from './demo';
import { createSession } from './export';
import { clearRecentSession, loadRecentSession, loadRecentSummary, recentSessionSummary, resultStorageKey } from './sessionStore';

describe('recent FoldLens session storage', () => {
  it('builds stable, minimal metadata for the continue card', () => {
    const savedAt = '2026-07-22T00:00:00.000Z';
    const session = createSession(demoResult, { selectedId: 'demo-1', visibleChains: ['Q', 'S'], colorMode: 'chains', brightness: 120, surface: false, selection: null });
    session.savedAt = savedAt;

    expect(recentSessionSummary(session)).toEqual({
      jobName: demoResult.jobName,
      sourceName: demoResult.sourceName,
      predictionCount: demoResult.predictions.length,
      savedAt,
    });
    expect(resultStorageKey(demoResult)).toBe(resultStorageKey({ ...demoResult }));
    expect(resultStorageKey({ ...demoResult, sourceName: 'another-result' })).not.toBe(resultStorageKey(demoResult));
  });

  it('degrades safely when browser storage is unavailable', async () => {
    expect(await loadRecentSummary()).toBeNull();
    expect(await loadRecentSession()).toBeNull();
    await expect(clearRecentSession()).resolves.toBeUndefined();
  });
});
