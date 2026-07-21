import { z } from 'zod';
import type { AnalysisFacts, AssistantResponse, EvidenceAction } from '../types/analysis';
import type { ResidueRange, Selection } from '../types/af3';

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

export const AssistantResponseSchema = z.object({
  answer: z.string().min(1).max(500),
  evidence: z.array(z.object({
    id: z.string().min(1).max(60),
    label: z.string().min(1).max(80),
    value: z.string().min(1).max(100),
    interpretation: z.string().min(1).max(180),
    action: EvidenceActionSchema,
  })).max(4),
  caveats: z.array(z.string().min(1).max(240)).max(4),
});

export const AssistantRequestSchema = z.object({
  question: z.string().trim().min(3).max(400),
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
  return response.evidence.every((item) => isGroundedEvidenceAction(item.action, facts));
}
