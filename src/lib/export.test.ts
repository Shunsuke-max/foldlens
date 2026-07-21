// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnalysisFacts } from './analysis';
import { buildHtmlReport, createPaeSnapshot, createSession, isSession, parseSessionFile } from './export';
import { demoResult } from './demo';

afterEach(() => vi.restoreAllMocks());

describe('FoldLens exports', () => {
  it('creates a versioned resumable session', () => {
    const session = createSession(demoResult, { selectedId: 'demo-1', visibleChains: ['Q', 'S'], colorMode: 'chains', brightness: 120, surface: true, surfaceOnly: true, selection: null });
    expect(session).toMatchObject({ format: 'foldlens-session', version: 1 });
    expect(session.view.visibleChains).toEqual(['Q', 'S']);
    expect(session.view.surfaceOnly).toBe(true);
    expect(session.view.brightness).toBe(120);
  });

  it('builds a self-contained confidence report with scoped metrics and caveats', () => {
    const prediction = demoResult.predictions[0];
    const html = buildHtmlReport({ result: demoResult, prediction, facts: buildAnalysisFacts(demoResult, prediction, null), selectionLabel: 'S 612–626' });
    expect(html).toContain('Global ipTM');
    expect(html).toContain('Q–S');
    expect(html).toContain('not experimental validation or biological truth');
    expect(html).toContain('S 612–626');
  });

  it('rejects malformed sessions and selections before they reach the workspace', async () => {
    expect(isSession({ format: 'foldlens-session', version: 1, result: { jobName: 'bad', sourceName: 'bad', predictions: [{}], chains: [], notices: [] }, view: { selectedId: 'x', visibleChains: [], colorMode: 'chains', surface: false, selection: null } })).toBe(false);
    const unsafe = createSession(demoResult, { selectedId: 'demo-1', visibleChains: [], colorMode: 'chains', surface: false, selection: { xStart: 0, xEnd: 1_000_000_000, yStart: 0, yEnd: 1 } });
    const file = new File([JSON.stringify(unsafe)], 'unsafe.foldlens.json', { type: 'application/json' });
    expect(await parseSessionFile([file])).toBeNull();
  });

  it('rejects inconsistent optional arrays and unknown view references', () => {
    const inconsistent = structuredClone(createSession(demoResult, { selectedId: 'demo-1', visibleChains: ['Q'], colorMode: 'chains', surface: false, selection: null }));
    inconsistent.result.predictions[0].confidence!.atomPlddts = [90, 80];
    inconsistent.result.predictions[0].confidence!.atomChainIds = ['Q'];
    expect(isSession(inconsistent)).toBe(false);

    const unknownDomain = structuredClone(createSession(demoResult, { selectedId: 'demo-1', visibleChains: ['Q'], colorMode: 'chains', surface: false, focusMode: 'domains', selectedDomainId: 'missing', selection: null }));
    expect(isSession(unknownDomain)).toBe(false);
  });

  it('creates a PAE report snapshot without relying on the currently visible mobile tab', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
      putImageData: vi.fn(),
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,pae');
    expect(createPaeSnapshot([[1, 2], [3, 4]])).toBe('data:image/png;base64,pae');
  });
});
