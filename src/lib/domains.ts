import type { AF3Result, DomainAnnotation, DomainRegion, Prediction, TokenResidue } from '../types/af3';

const DOMAIN_COLORS = ['#aa73df', '#42bdf5', '#a9d94a', '#f0b455', '#ef7fae', '#5cd6b3', '#7887f5', '#f28b66'];
const MIN_REGION_TOKENS = 18;
const MAX_REGIONS_PER_CHAIN = 4;

type RegionDraft = Omit<DomainAnnotation, 'source'> & {
  source: DomainRegion['source'];
  tokenIndices: number[];
  color: string;
  meanPlddt: number | null;
  meanInternalPae: number | null;
};

function tokensFor(prediction: Prediction): TokenResidue[] {
  if (prediction.confidence?.tokenResidues?.length) return prediction.confidence.tokenResidues;
  const counters = new Map<string, number>();
  return (prediction.confidence?.tokenChainIds ?? []).map((chainId, tokenIndex) => {
    const residueNumber = (counters.get(chainId) ?? 0) + 1;
    counters.set(chainId, residueNumber);
    return { tokenIndex, chainId, residueId: String(residueNumber), residueNumber };
  });
}

function sampledMean(matrix: number[][] | undefined, rows: number[], columns: number[]): number | null {
  if (!matrix?.length || !rows.length || !columns.length) return null;
  const stepRows = Math.max(1, Math.ceil(rows.length / 48));
  const stepColumns = Math.max(1, Math.ceil(columns.length / 48));
  let total = 0;
  let count = 0;
  for (let row = 0; row < rows.length; row += stepRows) {
    for (let column = 0; column < columns.length; column += stepColumns) {
      const forward = matrix[rows[row]]?.[columns[column]];
      const reverse = matrix[columns[column]]?.[rows[row]];
      if (Number.isFinite(forward)) { total += forward; count += 1; }
      if (rows !== columns && Number.isFinite(reverse)) { total += reverse; count += 1; }
    }
  }
  return count ? total / count : null;
}

function meanPlddt(prediction: Prediction, indices: number[]): number | null {
  const scores = prediction.confidence?.tokenPlddts;
  if (!scores?.length) return null;
  const values = indices.map((index) => scores[index]).filter((value) => Number.isFinite(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function bestCut(pae: number[][], indices: number[], start: number, end: number) {
  if (end - start + 1 < MIN_REGION_TOKENS * 2) return null;
  const window = Math.min(14, Math.max(8, Math.floor((end - start + 1) / 8)));
  let best: { cut: number; score: number; cross: number } | null = null;
  for (let cut = start + MIN_REGION_TOKENS; cut <= end - MIN_REGION_TOKENS + 1; cut += 1) {
    const left = indices.slice(Math.max(start, cut - window), cut);
    const right = indices.slice(cut, Math.min(end + 1, cut + window));
    const cross = sampledMean(pae, left, right);
    const withinLeft = sampledMean(pae, left, left);
    const withinRight = sampledMean(pae, right, right);
    if (cross === null || withinLeft === null || withinRight === null) continue;
    const score = cross - (withinLeft + withinRight) / 2;
    if ((!best || score > best.score) && cross >= 10 && score >= 4.5) best = { cut, score, cross };
  }
  return best;
}

function paeSegments(pae: number[][] | undefined, indices: number[]) {
  if (!indices.length) return [];
  if (!pae?.length) return [{ start: 0, end: indices.length - 1 }];
  const segments = [{ start: 0, end: indices.length - 1 }];
  while (segments.length < MAX_REGIONS_PER_CHAIN) {
    let candidate: { segmentIndex: number; cut: number; score: number } | null = null;
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      const segment = segments[segmentIndex];
      const cut = bestCut(pae, indices, segment.start, segment.end);
      if (cut && (!candidate || cut.score > candidate.score)) candidate = { segmentIndex, cut: cut.cut, score: cut.score };
    }
    if (!candidate) break;
    const segment = segments[candidate.segmentIndex];
    segments.splice(candidate.segmentIndex, 1,
      { start: segment.start, end: candidate.cut - 1 },
      { start: candidate.cut, end: segment.end });
  }
  return segments;
}

function draftFromAnnotation(annotation: DomainAnnotation, tokens: TokenResidue[], prediction: Prediction, color: string): RegionDraft {
  const tokenIndices = tokens.filter((token) => token.chainId === annotation.chainId && token.residueNumber !== undefined && token.residueNumber >= annotation.start && token.residueNumber <= annotation.end).map((token) => token.tokenIndex);
  return {
    ...annotation,
    tokenIndices,
    color,
    meanPlddt: meanPlddt(prediction, tokenIndices),
    meanInternalPae: sampledMean(prediction.confidence?.pae, tokenIndices, tokenIndices),
  };
}

export function inferDomains(result: AF3Result, prediction: Prediction): DomainRegion[] {
  const tokens = tokensFor(prediction);
  const annotations = result.domainAnnotations ?? [];
  const annotatedChains = new Set(annotations.map((annotation) => annotation.chainId));
  const drafts: RegionDraft[] = annotations.map((annotation, index) => draftFromAnnotation(annotation, tokens, prediction, DOMAIN_COLORS[index % DOMAIN_COLORS.length]));

  result.chains.filter((chain) => chain.kind === 'protein' && !annotatedChains.has(chain.id)).forEach((chain) => {
    const chainTokens = tokens.filter((token) => token.chainId === chain.id && token.residueNumber !== undefined);
    const indices = chainTokens.map((token) => token.tokenIndex);
    paeSegments(prediction.confidence?.pae, indices).forEach((segment, segmentIndex) => {
      const segmentTokens = chainTokens.slice(segment.start, segment.end + 1);
      const tokenIndices = segmentTokens.map((token) => token.tokenIndex);
      const start = segmentTokens[0]?.residueNumber;
      const end = segmentTokens.at(-1)?.residueNumber;
      if (start === undefined || end === undefined) return;
      const regionIndex = drafts.length;
      drafts.push({
        id: `pae-${chain.id}-${segmentIndex + 1}`,
        label: `Predicted region ${chain.id}.${segmentIndex + 1}`,
        chainId: chain.id,
        start,
        end,
        source: 'pae',
        tokenIndices,
        color: DOMAIN_COLORS[regionIndex % DOMAIN_COLORS.length],
        meanPlddt: meanPlddt(prediction, tokenIndices),
        meanInternalPae: sampledMean(prediction.confidence?.pae, tokenIndices, tokenIndices),
      });
    });
  });

  return drafts.map((draft) => {
    let closest: { id: string; label: string; pae: number } | null = null;
    for (const other of drafts) {
      if (other.id === draft.id) continue;
      const pae = sampledMean(prediction.confidence?.pae, draft.tokenIndices, other.tokenIndices);
      if (pae !== null && (!closest || pae < closest.pae)) closest = { id: other.id, label: other.label, pae };
    }
    const { tokenIndices, ...domain } = draft;
    void tokenIndices;
    return {
      ...domain,
      closestDomainId: closest?.id ?? null,
      closestDomainLabel: closest?.label ?? null,
      closestDomainPae: closest?.pae ?? null,
    };
  });
}
