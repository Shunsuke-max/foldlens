import { z } from 'zod';

export const ResidueRangeSchema = z.object({
  chainId: z.string().min(1).max(12),
  start: z.number().int(),
  end: z.number().int(),
});

export const EvidenceActionSchema = z.object({
  type: z.enum(['show_interface', 'show_residues', 'show_selection', 'none']),
  chainIds: z.array(z.string()).max(4),
  residueRanges: z.array(ResidueRangeSchema).max(8),
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
    }).nullable(),
    notices: z.array(z.string()).max(8),
  }),
});
