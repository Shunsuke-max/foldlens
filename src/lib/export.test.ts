// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildAnalysisFacts } from './analysis';
import { buildHtmlReport, createSession } from './export';
import { demoResult } from './demo';

describe('FoldLens exports', () => {
  it('creates a versioned resumable session', () => {
    const session = createSession(demoResult, { selectedId: 'demo-1', visibleChains: ['Q', 'S'], colorMode: 'chains', surface: true, surfaceOnly: true, selection: null });
    expect(session).toMatchObject({ format: 'foldlens-session', version: 1 });
    expect(session.view.visibleChains).toEqual(['Q', 'S']);
    expect(session.view.surfaceOnly).toBe(true);
  });

  it('builds a self-contained confidence report with scoped metrics and caveats', () => {
    const prediction = demoResult.predictions[0];
    const html = buildHtmlReport({ result: demoResult, prediction, facts: buildAnalysisFacts(demoResult, prediction, null), selectionLabel: 'S 612–626' });
    expect(html).toContain('Global ipTM');
    expect(html).toContain('Q–S');
    expect(html).toContain('not experimental validation or biological truth');
    expect(html).toContain('S 612–626');
  });
});
