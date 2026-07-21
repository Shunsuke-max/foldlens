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
    expect(buildLocalAssistantResponse(facts, prediction, '最も不確実な領域はどこですか？').answer).toBe('S 612–626を最も慎重に扱ってください。平均pLDDTは54です。');
  });

  it('materializes model plans from canonical facts instead of model-authored measurements', () => {
    const facts = buildAnalysisFacts(demoResult, prediction, null);
    const response = buildLocalAssistantResponse(facts, undefined, 'Is the interface reliable?', {
      intent: 'interface_reliability',
      evidenceRefs: ['primary_interface_pae', 'primary_interface_iptm'],
      language: 'en',
      followUpIntents: ['regional_uncertainty', 'falsification'],
    });

    expect(response.evidence.map((item) => item.id)).toEqual(['primary_interface_pae', 'primary_interface_iptm']);
    expect(response.evidence[0].value).toBe(`${facts.primaryInterface!.paeMedian!.toFixed(1)} Å`);
    expect(response.evidence[0].action.residueRanges).toEqual(facts.chainRanges.filter((range) => ['Q', 'S'].includes(range.chainId)));
    expect(response.nextQuestions).toHaveLength(2);
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
    expect(buildLocalAssistantResponse(buildAnalysisFacts(demoResult, prediction, selection), prediction).evidence[0].action.selection).toEqual(selection);
  });

  it('does not assign global ipTM to an arbitrary chain pair', () => {
    const withoutPairFacts = buildAnalysisFacts(demoResult, {
      ...prediction,
      summary: { iptm: 0.95, chainIds: ['Q', 'R', 'S'] },
      confidence: { tokenChainIds: prediction.confidence!.tokenChainIds, tokenResidues: prediction.confidence!.tokenResidues },
    }, null);
    expect(withoutPairFacts.primaryInterface).toBeNull();
    expect(buildLocalAssistantResponse(withoutPairFacts).answer).not.toContain('supports an interface');
  });

  it('does not recommend PAE inspection when no confidence arrays were loaded', () => {
    const structureOnly = {
      ...prediction,
      summary: {},
      confidence: { tokenResidues: prediction.confidence!.tokenResidues, tokenChainIds: prediction.confidence!.tokenChainIds },
    };
    const facts = buildAnalysisFacts({ ...demoResult, notices: ['No PAE array was found.'] }, structureOnly, null);
    expect(facts).toMatchObject({ hasPae: false, hasPlddt: false });
    expect(buildLocalAssistantResponse(facts, structureOnly, 'What should I inspect first?').answer)
      .toBe('No pLDDT or PAE confidence data was loaded, so FoldLens cannot rank regions by prediction confidence.');
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
