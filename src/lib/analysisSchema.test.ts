import { describe, expect, it } from 'vitest';
import { buildAnalysisFacts, buildDraftedAssistantResponse, buildLocalAssistantResponse } from './analysis';
import { AssistantDraftSchema, AssistantPlanSchema, isGroundedAssistantResponse, isGroundedEvidenceAction, normalizeAssistantResponse } from './analysisSchema';
import { demoResult } from './demo';

describe('assistant evidence grounding', () => {
  const prediction = demoResult.predictions[0];
  const selection = { xStart: 0, xEnd: 5, yStart: 99, yEnd: 101 };
  const facts = buildAnalysisFacts(demoResult, prediction, selection);

  it('accepts deterministic actions that exactly match the active facts', () => {
    expect(isGroundedAssistantResponse(buildLocalAssistantResponse(facts, prediction), facts)).toBe(true);
    expect(isGroundedAssistantResponse(buildLocalAssistantResponse(facts, undefined), facts)).toBe(true);
  });

  it('rejects nonexistent chains, out-of-range residues, and altered PAE rectangles', () => {
    expect(isGroundedEvidenceAction({ type: 'show_residues', chainIds: ['NOPE'], residueRanges: [{ chainId: 'NOPE', start: 1, end: 2 }], selection: null }, facts)).toBe(false);
    expect(isGroundedEvidenceAction({ type: 'show_residues', chainIds: ['A'], residueRanges: [{ chainId: 'A', start: -999, end: 999999 }], selection: null }, facts)).toBe(false);
    expect(isGroundedEvidenceAction({ type: 'show_selection', chainIds: ['A', 'B'], residueRanges: facts.selection!.residueRanges, selection: { ...selection, yEnd: 190 } }, facts)).toBe(false);
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
      backgroundAnswer: null,
    }).success).toBe(true);
    expect(AssistantPlanSchema.safeParse({
      intent: 'interface_reliability',
      evidenceRefs: ['primary_interface_iptm', 'primary_interface_iptm'],
      language: 'en',
      followUpIntents: ['falsification'],
      backgroundAnswer: null,
    }).success).toBe(false);
    expect(AssistantPlanSchema.safeParse({
      intent: 'biological_context',
      evidenceRefs: [],
      language: 'ja',
      followUpIntents: ['overall_assessment'],
      backgroundAnswer: 'HIV-1プロテアーゼはウイルス成熟に必要な酵素です。',
    }).success).toBe(true);
    expect(AssistantPlanSchema.safeParse({
      intent: 'overall_assessment',
      evidenceRefs: [],
      language: 'en',
      followUpIntents: ['falsification'],
      backgroundAnswer: 'This should not be allowed.',
    }).success).toBe(false);
  });

  it('materializes a model-written answer while keeping evidence deterministic', () => {
    const draft = AssistantDraftSchema.parse({
      intent: 'interface_reliability',
      evidenceRefs: ['primary_interface_iptm', 'primary_interface_pae'],
      language: 'en',
      answer: 'The interface is plausible, but the loaded result supports a cautious rather than definitive interpretation.',
      alternative: 'The chains may have a plausible contact while their relative orientation remains uncertain.',
      falsification: 'A consistent interface across independent predictions with tighter reciprocal PAE would strengthen this conclusion.',
      nextQuestions: ['Which interface region should I inspect first?', 'How do local and relative confidence differ here?'],
      caveats: ['The loaded confidence output does not demonstrate binding in an experiment.'],
    });
    const response = buildDraftedAssistantResponse(facts, 'How reliable is this interface?', draft);
    const catalogResponse = buildLocalAssistantResponse(facts, undefined, 'How reliable is this interface?', {
      intent: draft.intent,
      evidenceRefs: draft.evidenceRefs,
      language: draft.language,
      followUpIntents: [],
      backgroundAnswer: null,
    });

    expect(response.answer).toBe(draft.answer);
    expect(response.alternative).toBe(draft.alternative);
    expect(response.nextQuestions).toEqual(draft.nextQuestions);
    expect(response.evidence).toEqual(catalogResponse.evidence);
    expect(response.caveats[0]).toBe('Confidence is not experimental validation.');
    expect(isGroundedAssistantResponse(response, facts)).toBe(true);
  });

  it('rejects incomplete or duplicated full answer drafts', () => {
    const base = {
      intent: 'overall_assessment',
      evidenceRefs: ['overall_ptm'],
      language: 'en',
      answer: 'The global fold confidence is useful but not sufficient on its own.',
      alternative: 'Local uncertainty may be hidden by the global score.',
      falsification: 'Residue-level confidence and PAE would refine this interpretation.',
      nextQuestions: ['Where is confidence lowest?'],
      caveats: ['Confidence is not validation.'],
    };
    expect(AssistantDraftSchema.safeParse(base).success).toBe(true);
    expect(AssistantDraftSchema.safeParse({ ...base, alternative: '' }).success).toBe(false);
    expect(AssistantDraftSchema.safeParse({ ...base, nextQuestions: ['Repeat?', 'Repeat?'] }).success).toBe(false);
  });
});
