import { describe, expect, it } from 'vitest';
import { buildAnalysisFacts, buildLocalAssistantResponse } from './analysis';
import { isGroundedAssistantResponse, isGroundedEvidenceAction } from './analysisSchema';
import { demoResult } from './demo';

describe('assistant evidence grounding', () => {
  const prediction = demoResult.predictions[0];
  const selection = { xStart: 0, xEnd: 5, yStart: 128, yEnd: 130 };
  const facts = buildAnalysisFacts(demoResult, prediction, selection);

  it('accepts deterministic actions that exactly match the active facts', () => {
    expect(isGroundedAssistantResponse(buildLocalAssistantResponse(facts, prediction), facts)).toBe(true);
  });

  it('rejects nonexistent chains, out-of-range residues, and altered PAE rectangles', () => {
    expect(isGroundedEvidenceAction({ type: 'show_residues', chainIds: ['NOPE'], residueRanges: [{ chainId: 'NOPE', start: 1, end: 2 }], selection: null }, facts)).toBe(false);
    expect(isGroundedEvidenceAction({ type: 'show_residues', chainIds: ['Q'], residueRanges: [{ chainId: 'Q', start: -999, end: 999999 }], selection: null }, facts)).toBe(false);
    expect(isGroundedEvidenceAction({ type: 'show_selection', chainIds: ['Q', 'S'], residueRanges: facts.selection!.residueRanges, selection: { ...selection, yEnd: 190 } }, facts)).toBe(false);
  });
});
