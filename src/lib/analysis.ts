import type { AF3Result, DomainRegion, Prediction, ResidueRange, Selection, TokenResidue } from '../types/af3';
import type { AnalysisFacts, AssistantResponse, InterfaceFact, LowConfidenceRegion } from '../types/analysis';
import { inferDomains } from './domains';
import { chainPairPaeSummary, robustPairSelection, selectionPaeSummary } from './pae';

function finite(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) ? value : null;
}

function normalizedTokens(prediction: Prediction): TokenResidue[] {
  const confidence = prediction.confidence;
  if (confidence?.tokenResidues?.length) return confidence.tokenResidues;
  const counters = new Map<string, number>();
  return (confidence?.tokenChainIds ?? []).map((chainId, tokenIndex) => {
    const residueNumber = (counters.get(chainId) ?? 0) + 1;
    counters.set(chainId, residueNumber);
    return { tokenIndex, chainId, residueId: String(residueNumber), residueNumber };
  });
}

function mergeRanges(ranges: ResidueRange[]): ResidueRange[] {
  const sorted = [...ranges].sort((a, b) => a.chainId.localeCompare(b.chainId) || a.start - b.start);
  const merged: ResidueRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous?.chainId === range.chainId && range.start <= previous.end + 1) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function rangesForTokenWindow(tokens: TokenResidue[], start: number, end: number): ResidueRange[] {
  const byChain = new Map<string, number[]>();
  for (const token of tokens.slice(Math.max(0, start), Math.min(tokens.length, end + 1))) {
    if (token.residueNumber === undefined) continue;
    const values = byChain.get(token.chainId) ?? [];
    values.push(token.residueNumber);
    byChain.set(token.chainId, values);
  }
  return [...byChain].map(([chainId, values]) => ({ chainId, start: Math.min(...values), end: Math.max(...values) }));
}

export function selectionResidueRanges(prediction: Prediction, selection: Selection): ResidueRange[] {
  if (!selection) return [];
  const tokens = normalizedTokens(prediction);
  return mergeRanges([
    ...rangesForTokenWindow(tokens, selection.xStart, selection.xEnd),
    ...rangesForTokenWindow(tokens, selection.yStart, selection.yEnd),
  ]);
}

export function formatResidueRanges(ranges: ResidueRange[]) {
  return ranges.map((range) => `${range.chainId} ${range.start}${range.end === range.start ? '' : `–${range.end}`}`).join(' × ');
}

function primaryInterface(prediction: Prediction, excludedChainIds = new Set<string>()): InterfaceFact | null {
  const summary = prediction.summary;
  const ids = summary.chainIds ?? [...new Set(prediction.confidence?.tokenChainIds ?? [])];
  const paeChainIds = prediction.confidence?.tokenChainIds ?? normalizedTokens(prediction).map((token) => token.chainId);
  const includedIndices = ids.map((id, index) => ({ id, index })).filter(({ id }) => !excludedChainIds.has(id));
  if (includedIndices.length < 2) return null;
  let best: { row: number; column: number; score: number; stats: ReturnType<typeof chainPairPaeSummary> } | null = null;
  for (let left = 0; left < includedIndices.length; left += 1) {
    for (let right = left + 1; right < includedIndices.length; right += 1) {
      const row = includedIndices[left].index;
      const column = includedIndices[right].index;
      const iptm = summary.chainPairIptm?.[row]?.[column];
      const paeMinimum = summary.chainPairPaeMin?.[row]?.[column];
      const stats = chainPairPaeSummary(prediction.confidence?.pae, paeChainIds, ids[row], ids[column]);
      const score = Number.isFinite(iptm) ? iptm! : stats.reciprocalMedian !== null ? -stats.reciprocalMedian / 40 : Number.isFinite(paeMinimum) ? -paeMinimum! / 40 : Number.NEGATIVE_INFINITY;
      if (Number.isFinite(score) && (!best || score > best.score)) best = { row, column, score, stats };
    }
  }
  if (!best) return null;
  return {
    chainA: ids[best.row],
    chainB: ids[best.column],
    iptm: finite(summary.chainPairIptm?.[best.row]?.[best.column]),
    paeMin: finite(summary.chainPairPaeMin?.[best.row]?.[best.column]) ?? best.stats.minimum,
    paeMedian: best.stats.reciprocalMedian,
    paeMean: best.stats.reciprocalMean,
    paeForwardMean: best.stats.forward.mean,
    paeReverseMean: best.stats.reverse.mean,
    lowPaeFraction: best.stats.lowFraction,
  };
}

function lowConfidenceRegions(prediction: Prediction): LowConfidenceRegion[] {
  const scores = prediction.confidence?.tokenPlddts;
  const tokens = normalizedTokens(prediction);
  if (!scores?.length || tokens.length !== scores.length) return [];
  const regions: LowConfidenceRegion[] = [];
  let current: Array<{ token: TokenResidue; score: number }> = [];
  const flush = () => {
    if (current.length >= 3) {
      const residues = current.map((item) => item.token.residueNumber).filter((value): value is number => value !== undefined);
      if (residues.length) regions.push({
        chainId: current[0].token.chainId,
        start: Math.min(...residues),
        end: Math.max(...residues),
        meanPlddt: current.reduce((sum, item) => sum + item.score, 0) / current.length,
      });
    }
    current = [];
  };
  scores.forEach((score, index) => {
    const token = tokens[index];
    const previous = current.at(-1)?.token;
    const isContinuous = previous?.chainId === token.chainId && (
      previous.residueNumber === undefined || token.residueNumber === undefined || token.residueNumber <= previous.residueNumber + 1
    );
    if (score < 70) {
      if (current.length && !isContinuous) flush();
      current.push({ token, score });
    } else if (current.length) flush();
  });
  if (current.length) flush();
  return regions.sort((a, b) => a.meanPlddt - b.meanPlddt).slice(0, 3);
}

export function buildAnalysisFacts(result: AF3Result, prediction: Prediction, selection: Selection, domainRegions?: DomainRegion[]): AnalysisFacts {
  const ranges = selectionResidueRanges(prediction, selection);
  const selectionPae = selectionPaeSummary(prediction.confidence?.pae, selection);
  const tokens = normalizedTokens(prediction);
  const alignedLabel = selection ? formatResidueRanges(rangesForTokenWindow(tokens, selection.xStart, selection.xEnd)) : '';
  const scoredLabel = selection ? formatResidueRanges(rangesForTokenWindow(tokens, selection.yStart, selection.yEnd)) : '';
  const ligandChainIds = new Set(result.chains.filter((chain) => chain.kind === 'ligand').map((chain) => chain.id));
  return {
    jobName: result.jobName,
    predictionLabel: prediction.label,
    rankingScore: finite(prediction.summary.rankingScore),
    ptm: finite(prediction.summary.ptm),
    iptm: finite(prediction.summary.iptm),
    hasClash: prediction.summary.hasClash ?? null,
    hasPae: Boolean(prediction.confidence?.pae?.length),
    hasPlddt: Boolean(prediction.confidence?.tokenPlddts?.length),
    chainRanges: mergeRanges(tokens.flatMap((token) => token.residueNumber === undefined ? [] : [{ chainId: token.chainId, start: token.residueNumber, end: token.residueNumber }])),
    primaryInterface: primaryInterface(prediction, ligandChainIds),
    domains: (domainRegions ?? inferDomains(result, prediction)).map(({ color, ...domain }) => {
      void color;
      return domain;
    }),
    lowConfidenceRegions: lowConfidenceRegions(prediction),
    selection: selection ? {
      label: alignedLabel && scoredLabel
        ? `${scoredLabel} scored on ${alignedLabel}`
        : `scored tokens ${selection.yStart + 1}–${selection.yEnd + 1} on aligned tokens ${selection.xStart + 1}–${selection.xEnd + 1}`,
      meanPae: selectionPae.reciprocalMean,
      medianPae: selectionPae.reciprocalMedian,
      forwardMeanPae: selectionPae.forward.mean,
      reverseMeanPae: selectionPae.reverse.mean,
      lowPaeFraction: selectionPae.lowFraction,
      alignedLabel,
      scoredLabel,
      residueRanges: ranges,
      matrixRange: { ...selection },
    } : null,
    notices: result.notices,
  };
}

function rangesForInterface(prediction: Prediction, chainIds: string[]) {
  const tokens = normalizedTokens(prediction).filter((token) => chainIds.includes(token.chainId));
  return mergeRanges(tokens.flatMap((token) => token.residueNumber === undefined ? [] : [{ chainId: token.chainId, start: token.residueNumber, end: token.residueNumber }]));
}

export function interfaceSelection(prediction: Prediction, chainA: string, chainB: string): Selection {
  const chainIds = prediction.confidence?.tokenChainIds ?? normalizedTokens(prediction).map((token) => token.chainId);
  return robustPairSelection(prediction.confidence?.pae, chainIds, chainA, chainB);
}

export function rangesSelection(prediction: Prediction, ranges: ResidueRange[]): Selection {
  const tokens = normalizedTokens(prediction);
  const indices = tokens.filter((token) => ranges.some((range) => token.chainId === range.chainId && token.residueNumber !== undefined && token.residueNumber >= range.start && token.residueNumber <= range.end)).map((token) => token.tokenIndex);
  if (!indices.length) return null;
  return { xStart: Math.min(...indices), xEnd: Math.max(...indices), yStart: Math.min(...indices), yEnd: Math.max(...indices) };
}

export function buildLocalAssistantResponse(facts: AnalysisFacts, prediction?: Prediction, question = ''): AssistantResponse {
  const evidence: AssistantResponse['evidence'] = [];
  const primary = facts.primaryInterface;
  const normalizedQuestion = question.toLowerCase();
  const asksForDomains = /(domain|structural region|ドメイン|構造領域)/.test(normalizedQuestion);
  const domainCandidates = facts.domains.filter((domain) => domain.meanPlddt !== null || domain.meanInternalPae !== null);
  const domainToInspect = [...domainCandidates].sort((a, b) => {
    const confidenceRisk = (a.meanPlddt ?? 100) - (b.meanPlddt ?? 100);
    if (confidenceRisk !== 0) return confidenceRisk;
    return (b.meanInternalPae ?? 0) - (a.meanInternalPae ?? 0);
  })[0];
  if (asksForDomains && domainToInspect) {
    const range = { chainId: domainToInspect.chainId, start: domainToInspect.start, end: domainToInspect.end };
    if (domainToInspect.meanPlddt !== null) evidence.push({
      id: `domain-plddt-${domainToInspect.id}`, label: domainToInspect.label, value: `${domainToInspect.chainId} ${domainToInspect.start}–${domainToInspect.end} · ${Math.round(domainToInspect.meanPlddt)}`,
      interpretation: domainToInspect.meanPlddt >= 90 ? 'Very high local confidence' : domainToInspect.meanPlddt >= 70 ? 'Confident local structure' : 'Inspect local geometry cautiously',
      action: { type: 'show_residues', chainIds: [domainToInspect.chainId], residueRanges: [range], selection: null },
    });
    if (domainToInspect.closestDomainPae !== null && domainToInspect.closestDomainLabel) evidence.push({
      id: `domain-pae-${domainToInspect.id}`, label: 'Nearest domain placement', value: `${domainToInspect.closestDomainPae.toFixed(1)} Å`,
      interpretation: `Relative to ${domainToInspect.closestDomainLabel}`,
      action: { type: 'show_residues', chainIds: [domainToInspect.chainId], residueRanges: [range], selection: null },
    });
  }
  const interfaceRanges = prediction && primary ? rangesForInterface(prediction, [primary.chainA, primary.chainB]) : [];
  if (primary?.iptm !== null && primary?.iptm !== undefined) evidence.push({
    id: 'interface-iptm', label: `${primary.chainA}–${primary.chainB} ipTM`, value: primary.iptm.toFixed(2),
    interpretation: primary.iptm >= 0.8 ? 'Strong interface-level confidence' : primary.iptm >= 0.6 ? 'Moderate interface-level confidence' : 'Weak interface-level confidence',
    action: { type: 'show_interface', chainIds: [primary.chainA, primary.chainB], residueRanges: interfaceRanges, selection: null },
  });
  if (primary?.paeMedian !== null && primary?.paeMedian !== undefined) evidence.push({
    id: 'interface-pae', label: `${primary.chainA}–${primary.chainB} reciprocal median PAE`, value: `${primary.paeMedian.toFixed(1)} Å`,
    interpretation: `${primary.chainB} scored on ${primary.chainA}: ${primary.paeForwardMean?.toFixed(1) ?? '—'} Å · reverse ${primary.paeReverseMean?.toFixed(1) ?? '—'} Å · ${Math.round((primary.lowPaeFraction ?? 0) * 100)}% ≤5 Å`,
    action: { type: 'show_interface', chainIds: [primary.chainA, primary.chainB], residueRanges: interfaceRanges, selection: null },
  });
  const low = facts.lowConfidenceRegions[0];
  if (low) evidence.push({
    id: 'local-plddt', label: 'Local pLDDT', value: `${low.chainId} ${low.start}–${low.end} · ${Math.round(low.meanPlddt)}`,
    interpretation: 'Inspect this flexible or weakly resolved region',
    action: { type: 'show_residues', chainIds: [low.chainId], residueRanges: [{ chainId: low.chainId, start: low.start, end: low.end }], selection: null },
  });
  if (facts.selection?.medianPae !== null && facts.selection?.medianPae !== undefined) evidence.unshift({
    id: 'selected-pae', label: 'Selected reciprocal median PAE', value: `${facts.selection.medianPae.toFixed(1)} Å`,
    interpretation: `${facts.selection.scoredLabel} on ${facts.selection.alignedLabel}: ${facts.selection.forwardMeanPae?.toFixed(1) ?? '—'} Å · reverse ${facts.selection.reverseMeanPae?.toFixed(1) ?? '—'} Å`,
    action: { type: 'show_selection', chainIds: [...new Set(facts.selection.residueRanges.map((range) => range.chainId))], residueRanges: facts.selection.residueRanges, selection: facts.selection.matrixRange },
  });

  const asksForBiology = /(drug|clinical|disease|treat|efficacy|mechanism|function|binds? in vivo|biologically correct)/.test(normalizedQuestion);
  const asksForUncertainty = /(uncertain|avoid|caution|least confident|low confidence|weak|unreliable|inspect first)/.test(normalizedQuestion);
  const asksForClash = /(clash|overlap|steric)/.test(normalizedQuestion);
  const asksForSelection = /(selected|selection|this region)/.test(normalizedQuestion) && Boolean(facts.selection);
  const interfaceIptm = primary?.iptm ?? 0;
  const interfacePae = primary?.paeMedian;
  const strong = interfaceIptm >= 0.8 && interfacePae !== null && interfacePae !== undefined && interfacePae <= 5;
  const mixedStrong = interfaceIptm >= 0.8 && interfacePae !== null && interfacePae !== undefined && interfacePae <= 10;
  const highIptm = interfaceIptm >= 0.8;
  const moderate = (primary?.iptm ?? 0) >= 0.6;
  let answer: string;
  if (asksForBiology) {
    answer = 'The loaded confidence metrics cannot establish biological function, efficacy, or clinical relevance. They only describe confidence in this prediction.';
  } else if (asksForDomains) {
    answer = domainToInspect
      ? `${domainToInspect.label} (${domainToInspect.chainId} ${domainToInspect.start}–${domainToInspect.end}) deserves the closest inspection${domainToInspect.meanPlddt !== null ? `; its mean pLDDT is ${Math.round(domainToInspect.meanPlddt)}` : ''}.`
      : 'No domain annotation or PAE-derived structural region is available in the loaded files.';
  } else if (asksForSelection && facts.selection) {
    answer = facts.selection.medianPae === null
      ? `The selected region (${facts.selection.label}) has no aligned-error value in the loaded files.`
      : `The selected region (${facts.selection.label}) has a reciprocal median PAE of ${facts.selection.medianPae.toFixed(1)} Å.`;
  } else if (asksForClash) {
    answer = facts.hasClash === null ? 'No clash flag was present in the loaded summary.'
      : facts.hasClash ? 'The AF3 summary flags a clash, so inspect the model before interpreting local geometry.'
        : 'The AF3 summary does not flag a clash; this is not a guarantee of physically valid geometry.';
  } else if (asksForUncertainty) {
    answer = low
      ? `Treat ${low.chainId} ${low.start}–${low.end} most cautiously; its mean pLDDT is ${Math.round(low.meanPlddt)}.`
      : facts.hasPlddt
        ? facts.hasPae
          ? 'No sustained low-pLDDT region was detected; inspect high-PAE blocks next.'
          : 'No sustained low-pLDDT region was detected, and no PAE matrix was loaded for relative-placement analysis.'
        : facts.hasPae
          ? 'No pLDDT values were loaded; inspect high-PAE blocks for relative-placement uncertainty.'
          : 'No pLDDT or PAE confidence data was loaded, so FoldLens cannot rank regions by prediction confidence.';
  } else {
    answer = strong
      ? `Likely reliable overall${low ? ', with one local caveat' : ''}.`
      : mixedStrong ? 'The interface score is strong, while reciprocal PAE shows mixed relative-position certainty.'
        : highIptm ? 'ipTM supports an interface, but reciprocal PAE indicates broad relative-placement uncertainty.'
      : moderate ? 'The interface is plausible, but its relative placement needs local inspection.'
        : 'The supplied confidence metrics do not support a reliable interface-level conclusion.';
  }
  return {
    answer,
    evidence: evidence.slice(0, 4),
    caveats: [
      'Confidence is not experimental validation.',
      ...(primary?.paeMin !== null && primary?.paeMin !== undefined ? ['Minimum PAE is the best local cell; representative interpretation uses reciprocal median PAE.'] : []),
      ...(facts.domains.some((domain) => domain.source === 'pae') ? ['PAE-derived regions are structural segments, not functional domain annotations.'] : []),
      ...facts.notices,
    ].slice(0, 3),
  };
}
