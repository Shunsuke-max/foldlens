import { z } from 'zod';
import type { AnalysisFacts, AssistantResponse, EvidenceAction } from '../types/analysis';
import type { ResidueRange, Selection } from '../types/af3';
import { buildEvidenceCatalog } from './analysis';

export const ResidueRangeSchema = z.object({
  chainId: z.string().min(1).max(12),
  start: z.number().int(),
  end: z.number().int(),
});

export const EvidenceActionSchema = z.object({
  type: z.enum(['show_interface', 'show_residues', 'show_selection', 'none']),
  chainIds: z.array(z.string()).max(4),
  residueRanges: z.array(ResidueRangeSchema).max(8),
  selection: z.object({
    xStart: z.number().int().nonnegative(),
    xEnd: z.number().int().nonnegative(),
    yStart: z.number().int().nonnegative(),
    yEnd: z.number().int().nonnegative(),
  }).nullable(),
});

export const AssistantIntentSchema = z.enum([
  'overall_assessment',
  'interface_reliability',
  'selection_support',
  'regional_uncertainty',
  'structural_region_priority',
  'clash_review',
  'biological_context',
  'scope_boundary',
  'alternative_interpretation',
  'falsification',
  'comparison',
]);

export const EvidenceRefSchema = z.enum([
  'primary_interface_iptm',
  'primary_interface_pae',
  'lowest_confidence_region',
  'active_selection_pae',
  'top_structural_region_plddt',
  'top_structural_region_pae',
  'ranking_score',
  'overall_ptm',
  'overall_iptm',
  'clash_status',
]);

export const AssistantPlanSchema = z.object({
  intent: AssistantIntentSchema,
  evidenceRefs: z.array(EvidenceRefSchema).max(4)
    .refine((refs) => refs.length === new Set(refs).size, 'Evidence references must be unique'),
  language: z.enum(['en', 'ja']),
  followUpIntents: z.array(AssistantIntentSchema).min(1).max(3)
    .refine((intents) => intents.length === new Set(intents).size, 'Follow-up intents must be unique'),
  backgroundAnswer: z.string().trim().min(1).max(700).nullable(),
}).superRefine((plan, context) => {
  if (plan.intent === 'biological_context' && plan.backgroundAnswer === null) {
    context.addIssue({ code: 'custom', path: ['backgroundAnswer'], message: 'Biological context requires a background answer' });
  }
  if (plan.intent !== 'biological_context' && plan.backgroundAnswer !== null) {
    context.addIssue({ code: 'custom', path: ['backgroundAnswer'], message: 'Only biological context may include a background answer' });
  }
});

export const AssistantDraftSchema = z.object({
  intent: AssistantIntentSchema,
  evidenceRefs: z.array(EvidenceRefSchema).max(4)
    .refine((refs) => refs.length === new Set(refs).size, 'Evidence references must be unique'),
  language: z.enum(['en', 'ja']),
  answer: z.string().trim().min(1).max(1200),
  alternative: z.string().trim().min(1).max(700),
  falsification: z.string().trim().min(1).max(700),
  nextQuestions: z.array(z.string().trim().min(3).max(200)).min(1).max(3)
    .refine((questions) => questions.length === new Set(questions).size, 'Follow-up questions must be unique'),
  caveats: z.array(z.string().trim().min(1).max(320)).min(1).max(4),
});

const AssistantEvidenceSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(100),
  interpretation: z.string().min(1).max(180),
  action: EvidenceActionSchema,
});

export const AssistantResponseSchema = z.object({
  kind: z.enum(['confidence_analysis', 'biological_background']),
  answer: z.string().min(1).max(1200),
  evidence: z.array(AssistantEvidenceSchema).max(4)
    .refine((items) => items.length === new Set(items.map((item) => item.id)).size, 'Evidence IDs must be unique'),
  alternative: z.string().min(1).max(700),
  falsification: z.string().min(1).max(700),
  nextQuestions: z.array(z.string().min(3).max(200)).min(1).max(3),
  caveats: z.array(z.string().min(1).max(320)).max(4),
});

export const AssistantRequestSchema = z.object({
  question: z.string().trim().min(3).max(400),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(1200),
  })).max(8).default([]),
  viewContext: z.object({
    focusMode: z.enum(['all', 'interface', 'pocket', 'domains']),
    comparisonLabel: z.string().max(100).nullable(),
  }).default({ focusMode: 'all', comparisonLabel: null }),
  facts: z.object({
    jobName: z.string().max(200),
    predictionLabel: z.string().max(100),
    rankingScore: z.number().nullable(),
    ptm: z.number().nullable(),
    iptm: z.number().nullable(),
    hasClash: z.boolean().nullable(),
    hasPae: z.boolean(),
    hasPlddt: z.boolean(),
    chainRanges: z.array(ResidueRangeSchema).max(128),
    primaryInterface: z.object({
      chainA: z.string(),
      chainB: z.string(),
      iptm: z.number().nullable(),
      paeMin: z.number().nullable(),
      paeMedian: z.number().nullable(),
      paeMean: z.number().nullable(),
      paeForwardMean: z.number().nullable(),
      paeReverseMean: z.number().nullable(),
      lowPaeFraction: z.number().nullable(),
    }).nullable(),
    domains: z.array(z.object({
      id: z.string().max(80),
      label: z.string().max(120),
      chainId: z.string().max(12),
      start: z.number().int(),
      end: z.number().int(),
      source: z.enum(['interpro', 'provided', 'pae']),
      meanPlddt: z.number().nullable(),
      meanInternalPae: z.number().nullable(),
      closestDomainId: z.string().nullable(),
      closestDomainLabel: z.string().nullable(),
      closestDomainPae: z.number().nullable(),
    })).max(16),
    lowConfidenceRegions: z.array(ResidueRangeSchema.extend({ meanPlddt: z.number() })).max(8),
    selection: z.object({
      label: z.string(),
      meanPae: z.number().nullable(),
      medianPae: z.number().nullable(),
      forwardMeanPae: z.number().nullable(),
      reverseMeanPae: z.number().nullable(),
      lowPaeFraction: z.number().nullable(),
      alignedLabel: z.string(),
      scoredLabel: z.string(),
      residueRanges: z.array(ResidueRangeSchema),
      matrixRange: z.object({
        xStart: z.number().int().nonnegative(),
        xEnd: z.number().int().nonnegative(),
        yStart: z.number().int().nonnegative(),
        yEnd: z.number().int().nonnegative(),
      }),
    }).nullable(),
    biologicalContext: z.object({
      displayName: z.string().min(1).max(160),
      organism: z.string().max(160).optional(),
      summary: z.object({
        en: z.string().min(1).max(700),
        ja: z.string().min(1).max(700),
      }),
      relevance: z.object({
        en: z.string().min(1).max(700),
        ja: z.string().min(1).max(700),
      }).optional(),
      sourceLabel: z.string().min(1).max(160),
    }).nullable(),
    notices: z.array(z.string()).max(8),
  }),
});

function sameStrings(actual: string[], expected: string[]) {
  return actual.length === new Set(actual).size
    && actual.length === expected.length
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}

function sameSelection(actual: Selection, expected: Selection) {
  if (!actual || !expected) return actual === expected;
  return actual.xStart === expected.xStart && actual.xEnd === expected.xEnd
    && actual.yStart === expected.yStart && actual.yEnd === expected.yEnd;
}

function rangeWithin(range: ResidueRange, allowed: ResidueRange[]) {
  return Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start <= range.end
    && allowed.some((candidate) => candidate.chainId === range.chainId && range.start >= candidate.start && range.end <= candidate.end);
}

function sameRanges(actual: ResidueRange[], expected: ResidueRange[]) {
  const key = (range: ResidueRange) => `${range.chainId}:${range.start}:${range.end}`;
  return actual.length === expected.length
    && actual.map(key).sort().every((value, index) => value === expected.map(key).sort()[index]);
}

export function isGroundedEvidenceAction(action: EvidenceAction, facts: AnalysisFacts) {
  if (action.type === 'none') return action.chainIds.length === 0 && action.residueRanges.length === 0 && action.selection === null;
  if (!action.residueRanges.every((range) => rangeWithin(range, facts.chainRanges))) return false;
  const actionRangeChains = [...new Set(action.residueRanges.map((range) => range.chainId))];
  if (action.type === 'show_interface') {
    const primary = facts.primaryInterface;
    return Boolean(primary) && action.selection === null
      && sameStrings(action.chainIds, [primary!.chainA, primary!.chainB])
      && action.residueRanges.length > 0
      && actionRangeChains.every((chainId) => action.chainIds.includes(chainId));
  }
  if (action.type === 'show_residues') {
    return action.selection === null && action.residueRanges.length > 0 && sameStrings(action.chainIds, actionRangeChains);
  }
  const selection = facts.selection;
  return Boolean(selection) && sameSelection(action.selection, selection!.matrixRange)
    && sameRanges(action.residueRanges, selection!.residueRanges)
    && sameStrings(action.chainIds, [...new Set(selection!.residueRanges.map((range) => range.chainId))]);
}

export function isGroundedAssistantResponse(response: AssistantResponse, facts: AnalysisFacts) {
  const catalog = buildEvidenceCatalog(facts);
  if (response.evidence.length !== new Set(response.evidence.map((item) => item.id)).size) return false;
  return response.evidence.every((item) => {
    const expected = catalog.get(item.id);
    return Boolean(expected)
      && item.label === expected!.label
      && item.value === expected!.value
      && item.interpretation === expected!.interpretation
      && item.action.type === expected!.action.type
      && sameStrings(item.action.chainIds, expected!.action.chainIds)
      && sameRanges(item.action.residueRanges, expected!.action.residueRanges)
      && sameSelection(item.action.selection, expected!.action.selection)
      && isGroundedEvidenceAction(item.action, facts);
  });
}

export function normalizeAssistantResponse(raw: unknown, fallback: AssistantResponse, facts: AnalysisFacts): AssistantResponse {
  const parsed = AssistantResponseSchema.safeParse(raw);
  if (parsed.success && isGroundedAssistantResponse(parsed.data, facts)) return parsed.data;
  if (typeof raw !== 'object' || raw === null) return fallback;

  const legacy = raw as Partial<Record<keyof AssistantResponse, unknown>>;
  const evidence = z.array(AssistantEvidenceSchema).max(4).safeParse(legacy.evidence);
  const nextQuestions = z.array(z.string().min(3).max(200)).min(1).max(3).safeParse(legacy.nextQuestions);
  const caveats = z.array(z.string().min(1).max(320)).max(4).safeParse(legacy.caveats);
  const candidate: AssistantResponse = {
    kind: legacy.kind === 'biological_background' ? 'biological_background' : fallback.kind,
    answer: typeof legacy.answer === 'string' && legacy.answer.trim() ? legacy.answer.slice(0, 1200) : fallback.answer,
    evidence: evidence.success ? evidence.data : fallback.evidence,
    alternative: typeof legacy.alternative === 'string' && legacy.alternative.trim() ? legacy.alternative.slice(0, 700) : fallback.alternative,
    falsification: typeof legacy.falsification === 'string' && legacy.falsification.trim() ? legacy.falsification.slice(0, 700) : fallback.falsification,
    nextQuestions: nextQuestions.success ? nextQuestions.data : fallback.nextQuestions,
    caveats: caveats.success ? caveats.data : fallback.caveats,
  };
  if (!isGroundedAssistantResponse(candidate, facts)) candidate.evidence = fallback.evidence;
  return AssistantResponseSchema.safeParse(candidate).success ? candidate : fallback;
}
