import { describe, expect, it } from 'vitest';
import type { AssistantPlan } from '../types/analysis';
import { buildAnalysisFacts, buildLocalAssistantResponse } from './analysis';
import { isGroundedAssistantResponse } from './analysisSchema';
import { demoResult } from './demo';

describe('grounded assistant evaluation set', () => {
  const prediction = demoResult.predictions[0];
  const baseFacts = buildAnalysisFacts(demoResult, prediction, null);
  const selectedFacts = buildAnalysisFacts(demoResult, prediction, { xStart: 0, xEnd: 5, yStart: 99, yEnd: 101 });
  const cases: Array<{
    name: string;
    question: string;
    facts: typeof baseFacts;
    plan: AssistantPlan;
    expectedEvidence?: string;
    expectedText: RegExp;
  }> = [
    {
      name: 'default interface CTA',
      question: 'Is the A–B interface reliable?',
      facts: baseFacts,
      plan: { intent: 'interface_reliability', evidenceRefs: ['primary_interface_iptm', 'primary_interface_pae'], language: 'en', followUpIntents: ['regional_uncertainty', 'falsification'], backgroundAnswer: null },
      expectedEvidence: 'primary_interface_iptm',
      expectedText: /interface/i,
    },
    {
      name: 'Japanese uncertainty question',
      question: '最も不確実な領域はどこですか？',
      facts: baseFacts,
      plan: { intent: 'regional_uncertainty', evidenceRefs: ['lowest_confidence_region'], language: 'ja', followUpIntents: ['falsification'], backgroundAnswer: null },
      expectedEvidence: 'lowest_confidence_region',
      expectedText: /慎重/,
    },
    {
      name: 'selected PAE question',
      question: 'What does this selected PAE region support?',
      facts: selectedFacts,
      plan: { intent: 'selection_support', evidenceRefs: ['active_selection_pae'], language: 'en', followUpIntents: ['alternative_interpretation'], backgroundAnswer: null },
      expectedEvidence: 'active_selection_pae',
      expectedText: /reciprocal median PAE/i,
    },
    {
      name: 'clinical scope boundary',
      question: 'Will this drug work clinically?',
      facts: baseFacts,
      plan: { intent: 'scope_boundary', evidenceRefs: [], language: 'en', followUpIntents: ['overall_assessment'], backgroundAnswer: null },
      expectedText: /cannot establish therapeutic efficacy/i,
    },
    {
      name: 'Japanese biological background',
      question: 'このタンパク質は何に使われますか？',
      facts: baseFacts,
      plan: {
        intent: 'biological_context', evidenceRefs: [], language: 'ja', followUpIntents: ['overall_assessment', 'scope_boundary'],
        backgroundAnswer: 'HIV-1プロテアーゼは、ウイルスのポリプロテインを切断して成熟したウイルス粒子の形成を可能にする酵素です。',
      },
      expectedText: /ポリプロテイン/,
    },
    {
      name: 'structural region priority',
      question: 'Which domain should I inspect first?',
      facts: baseFacts,
      plan: { intent: 'structural_region_priority', evidenceRefs: ['top_structural_region_plddt'], language: 'en', followUpIntents: ['regional_uncertainty'], backgroundAnswer: null },
      expectedEvidence: 'top_structural_region_plddt',
      expectedText: /deserves the closest inspection/i,
    },
    {
      name: 'comparison without paired facts',
      question: 'Compare this with model two.',
      facts: baseFacts,
      plan: { intent: 'comparison', evidenceRefs: ['overall_ptm'], language: 'en', followUpIntents: ['overall_assessment'], backgroundAnswer: null },
      expectedEvidence: 'overall_ptm',
      expectedText: /label alone cannot support/i,
    },
  ];

  for (const item of cases) {
    it(item.name, () => {
      const response = buildLocalAssistantResponse(item.facts, undefined, item.question, item.plan);
      expect(response.answer).toMatch(item.expectedText);
      expect(response.nextQuestions.length).toBeGreaterThan(0);
      expect(isGroundedAssistantResponse(response, item.facts)).toBe(true);
      if (item.expectedEvidence) expect(response.evidence.map((evidence) => evidence.id)).toContain(item.expectedEvidence);
    });
  }
});
