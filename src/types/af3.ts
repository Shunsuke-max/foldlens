export type ChainInfo = {
  id: string;
  label: string;
  kind: 'protein' | 'nucleic' | 'ligand' | 'unknown';
  color: string;
  range?: string;
};

export type AF3Summary = {
  ptm?: number;
  iptm?: number;
  rankingScore?: number;
  hasClash?: boolean;
  fractionDisordered?: number;
  chainIds?: string[];
  chainPtm?: number[];
  chainIptm?: number[];
  chainPairIptm?: number[][];
  chainPairPaeMin?: number[][];
};

export type AF3Confidence = {
  pae?: number[][];
  tokenChainIds?: string[];
  tokenResidues?: TokenResidue[];
  tokenPlddts?: number[];
  atomPlddts?: number[];
  atomChainIds?: string[];
  contactProbs?: number[][];
};

export type TokenResidue = {
  tokenIndex: number;
  chainId: string;
  residueId: string;
  residueNumber?: number;
  residueName?: string;
  isHetero?: boolean;
};

export type Prediction = {
  id: string;
  label: string;
  path: string;
  cif: string;
  seed?: string;
  sample?: number;
  summary: AF3Summary;
  confidence?: AF3Confidence;
};

export type AF3Result = {
  jobName: string;
  sourceName: string;
  predictions: Prediction[];
  chains: ChainInfo[];
  domainAnnotations?: DomainAnnotation[];
  notices: string[];
  isDemo?: boolean;
};

export type Selection = {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
} | null;

export type FocusMode = 'all' | 'interface' | 'pocket' | 'domains';

export type DomainAnnotation = ResidueRange & {
  id: string;
  label: string;
  source: 'interpro' | 'provided';
};

export type DomainRegion = Omit<DomainAnnotation, 'source'> & {
  source: DomainAnnotation['source'] | 'pae';
  color: string;
  meanPlddt: number | null;
  meanInternalPae: number | null;
  closestDomainId: string | null;
  closestDomainLabel: string | null;
  closestDomainPae: number | null;
};

export type FoldLensViewState = {
  selectedId: string;
  compareId?: string;
  visibleChains: string[];
  colorMode: 'confidence' | 'chains';
  brightness?: number;
  surface: boolean;
  surfaceOnly?: boolean;
  focusMode?: FocusMode;
  selectedDomainId?: string;
  selection: Selection;
};

export type FoldLensSession = {
  format: 'foldlens-session';
  version: 1;
  savedAt: string;
  result: AF3Result;
  view: FoldLensViewState;
};

export type ResidueRange = {
  chainId: string;
  start: number;
  end: number;
};
