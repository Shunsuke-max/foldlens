import type { DomainRegion, ResidueRange, Selection } from './af3';

export type InterfaceFact = {
  chainA: string;
  chainB: string;
  iptm: number | null;
  paeMin: number | null;
  paeMedian: number | null;
  paeMean: number | null;
  paeForwardMean: number | null;
  paeReverseMean: number | null;
  lowPaeFraction: number | null;
};

export type LowConfidenceRegion = ResidueRange & {
  meanPlddt: number;
};

export type SelectionFact = {
  label: string;
  meanPae: number | null;
  medianPae: number | null;
  forwardMeanPae: number | null;
  reverseMeanPae: number | null;
  lowPaeFraction: number | null;
  alignedLabel: string;
  scoredLabel: string;
  residueRanges: ResidueRange[];
  matrixRange: NonNullable<Selection>;
};

export type DomainFact = Omit<DomainRegion, 'color'>;

export type AnalysisFacts = {
  jobName: string;
  predictionLabel: string;
  rankingScore: number | null;
  ptm: number | null;
  iptm: number | null;
  hasClash: boolean | null;
  hasPae: boolean;
  hasPlddt: boolean;
  chainRanges: ResidueRange[];
  primaryInterface: InterfaceFact | null;
  domains: DomainFact[];
  lowConfidenceRegions: LowConfidenceRegion[];
  selection: SelectionFact | null;
  notices: string[];
};

export type EvidenceAction = {
  type: 'show_interface' | 'show_residues' | 'show_selection' | 'none';
  chainIds: string[];
  residueRanges: ResidueRange[];
  selection: Selection;
};

export type AssistantEvidence = {
  id: string;
  label: string;
  value: string;
  interpretation: string;
  action: EvidenceAction;
};

export type AssistantResponse = {
  answer: string;
  evidence: AssistantEvidence[];
  alternative: string;
  falsification: string;
  nextQuestions: string[];
  caveats: string[];
};

export type AssistantIntent =
  | 'overall_assessment'
  | 'interface_reliability'
  | 'selection_support'
  | 'regional_uncertainty'
  | 'structural_region_priority'
  | 'clash_review'
  | 'scope_boundary'
  | 'alternative_interpretation'
  | 'falsification'
  | 'comparison';

export type EvidenceRef =
  | 'primary_interface_iptm'
  | 'primary_interface_pae'
  | 'lowest_confidence_region'
  | 'active_selection_pae'
  | 'top_structural_region_plddt'
  | 'top_structural_region_pae'
  | 'ranking_score'
  | 'overall_ptm'
  | 'overall_iptm'
  | 'clash_status';

export type AssistantPlan = {
  intent: AssistantIntent;
  evidenceRefs: EvidenceRef[];
  language: 'en' | 'ja';
  followUpIntents: AssistantIntent[];
};

export type AssistantHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantEnvelope = {
  schemaVersion?: 2;
  data: AssistantResponse;
  source: 'live' | 'local';
  model: string;
  fallbackReason: string | null;
};
