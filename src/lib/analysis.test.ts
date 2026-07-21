import { describe, expect, it } from 'vitest';
import { buildAnalysisFacts, buildLocalAssistantResponse, formatResidueRanges, interfaceSelection, rangesSelection, selectionResidueRanges } from './analysis';
import { demoResult } from './demo';

describe('confidence analysis', () => {
  const prediction = demoResult.predictions[0];

  it('builds deterministic interface and local-confidence facts', () => {
    const facts = buildAnalysisFacts(demoResult, prediction, null);
    expect(facts.primaryInterface).toMatchObject({ chainA: 'Q', chainB: 'S', iptm: 0.87, paeMin: 2.1 });
    expect(facts.primaryInterface?.paeMedian).toBeCloseTo(10.08, 1);
    expect(facts.primaryInterface?.paeForwardMean).not.toBe(facts.primaryInterface?.paeReverseMean);
    expect(facts.lowConfidenceRegions[0]).toMatchObject({ chainId: 'S', start: 612, end: 626, meanPlddt: 54 });

    const response = buildLocalAssistantResponse(facts, prediction);
    expect(response.answer).toContain('ipTM supports an interface');
    expect(response.evidence.map((item) => item.label)).toEqual(['Q–S ipTM', 'Q–S reciprocal median PAE', 'Local pLDDT']);
    expect(response.caveats[0]).toBe('Confidence is not experimental validation.');
    expect(response.caveats[1]).toContain('Minimum PAE');
  });

  it('answers supported offline questions honestly from deterministic metrics', () => {
    const facts = buildAnalysisFacts(demoResult, prediction, null);
    expect(buildLocalAssistantResponse(facts, prediction, 'Which region should I avoid interpreting?').answer).toBe('Treat S 612–626 most cautiously; its mean pLDDT is 54.');
    expect(buildLocalAssistantResponse(facts, prediction, 'Will this drug work clinically?').answer).toContain('cannot establish biological function');
  });

  it('grounds domain questions in loaded boundaries and confidence metrics', () => {
    const facts = buildAnalysisFacts(demoResult, prediction, null);
    const response = buildLocalAssistantResponse(facts, prediction, 'Which domain should I inspect first?');

    expect(response.answer).toContain('REM domain');
    expect(response.evidence[0]).toMatchObject({ label: 'REM domain', action: { type: 'show_residues', chainIds: ['S'] } });
  });

  it('links precise PAE windows to residue ranges', () => {
    const selection = { xStart: 0, xEnd: 5, yStart: 128, yEnd: 130 };
    const ranges = selectionResidueRanges(prediction, selection);
    expect(formatResidueRanges(ranges)).toBe('Q 1–6 × S 564–566');
    expect(buildAnalysisFacts(demoResult, prediction, selection).selection?.meanPae).not.toBeNull();
    expect(buildAnalysisFacts(demoResult, prediction, selection).selection?.label).toBe('S 564–566 scored on Q 1–6');
  });

  it('converts evidence actions back into PAE selections', () => {
    const focusedInterface = interfaceSelection(prediction, 'Q', 'S');
    expect(focusedInterface).not.toBeNull();
    expect(focusedInterface!.xStart).toBeGreaterThanOrEqual(0);
    expect(focusedInterface!.xEnd).toBeLessThan(64);
    expect(focusedInterface!.yStart).toBeGreaterThanOrEqual(128);
    expect(focusedInterface!.yEnd).toBeLessThan(192);
    expect(focusedInterface!.xEnd - focusedInterface!.xStart).toBeLessThan(16);
    expect(rangesSelection(prediction, [{ chainId: 'S', start: 612, end: 626 }])).toEqual({ xStart: 176, xEnd: 190, yStart: 176, yEnd: 190 });
  });
});
