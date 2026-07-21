import { describe, expect, it } from 'vitest';
import { buildAnalysisFacts, buildLocalAssistantResponse } from './analysis';
import { AssistantPlanSchema, isGroundedAssistantResponse, isGroundedEvidenceAction, normalizeAssistantResponse } from './analysisSchema';
import { demoResult } from './demo';

describe('assistant evidence grounding', () => {
  const prediction = demoResult.predictions[0];
  const selection = { xStart: 0, xEnd: 5, yStart: 128, yEnd: 130 };
  const facts = buildAnalysisFacts(demoResult, prediction, selection);

  it('accepts deterministic actions that exactly match the active facts', () => {
    expect(isGroundedAssistantResponse(buildLocalAssistantResponse(facts, prediction), facts)).toBe(true);
    expect(isGroundedAssistantResponse(buildLocalAssistantResponse(facts, undefined), facts)).toBe(true);
  });

  it('rejects nonexistent chains, out-of-range residues, and altered PAE rectangles', () => {
    expect(isGroundedEvidenceAction({ type: 'show_residues', chainIds: ['NOPE'], residueRanges: [{ chainId: 'NOPE', start: 1, end: 2 }], selection: null }, facts)).toBe(false);
    expect(isGroundedEvidenceAction({ type: 'show_residues', chainIds: ['Q'], residueRanges: [{ chainId: 'Q', start: -999, end: 999999 }], selection: null }, facts)).toBe(false);
    expect(isGroundedEvidenceAction({ type: 'show_selection', chainIds: ['Q', 'S'], residueRanges: facts.selection!.residueRanges, selection: { ...selection, yEnd: 190 } }, facts)).toBe(false);
  });

  it('rejects altered evidence text and duplicate evidence IDs even when actions are valid', () => {
    const response = buildLocalAssistantResponse(facts, undefined);
    expect(isGroundedAssistantResponse({
      ...response,
      evidence: response.evidence.map((item, index) => index === 0 ? { ...item, value: '99.9 Å' } : item),
    }, facts)).toBe(false);
    expect(isGroundedAssistantResponse({ ...response, evidence: [response.evidence[0], response.evidence[0]] }, facts)).toBe(false);
  });

  it('normalizes an older response shape without allowing ungrounded evidence through', () => {
    const fallback = buildLocalAssistantResponse(facts, undefined);
    const normalized = normalizeAssistantResponse({ answer: 'Legacy answer', evidence: [{ ...fallback.evidence[0], value: 'invented' }], caveats: [] }, fallback, facts);

    expect(normalized.answer).toBe('Legacy answer');
    expect(normalized.alternative).toBe(fallback.alternative);
    expect(normalized.nextQuestions).toEqual(fallback.nextQuestions);
    expect(normalized.evidence).toEqual(fallback.evidence);
    expect(isGroundedAssistantResponse(normalized, facts)).toBe(true);
  });

  it('accepts only bounded, unique analysis plans', () => {
    expect(AssistantPlanSchema.safeParse({
      intent: 'interface_reliability',
      evidenceRefs: ['primary_interface_iptm', 'primary_interface_pae'],
      language: 'en',
      followUpIntents: ['regional_uncertainty', 'falsification'],
    }).success).toBe(true);
    expect(AssistantPlanSchema.safeParse({
      intent: 'interface_reliability',
      evidenceRefs: ['primary_interface_iptm', 'primary_interface_iptm'],
      language: 'en',
      followUpIntents: ['falsification'],
    }).success).toBe(false);
  });
});
