import type { AF3Result, DomainRegion, Prediction, ResidueRange, Selection, TokenResidue } from '../types/af3';
import type { AnalysisFacts, AssistantEvidence, AssistantIntent, AssistantPlan, AssistantResponse, EvidenceRef, InterfaceFact, LowConfidenceRegion } from '../types/analysis';
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

function factRangesForChains(facts: AnalysisFacts, chainIds: string[]) {
  return facts.chainRanges.filter((range) => chainIds.includes(range.chainId));
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

function legacyBuildLocalAssistantResponse(facts: AnalysisFacts, prediction?: Prediction, question = ''): AssistantResponse {
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
  const interfaceRanges = primary
    ? prediction ? rangesForInterface(prediction, [primary.chainA, primary.chainB]) : factRangesForChains(facts, [primary.chainA, primary.chainB])
    : [];
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
  const asksForAlternative = /(challenge|alternative|another interpretation|competing explanation|反証|別の解釈)/.test(normalizedQuestion);
  const asksForFalsification = /(falsif|change this conclusion|change the conclusion|weaken this conclusion|結論を変|覆す)/.test(normalizedQuestion);
  const interfaceIptm = primary?.iptm ?? 0;
  const interfacePae = primary?.paeMedian;
  const strong = interfaceIptm >= 0.8 && interfacePae !== null && interfacePae !== undefined && interfacePae <= 5;
  const mixedStrong = interfaceIptm >= 0.8 && interfacePae !== null && interfacePae !== undefined && interfacePae <= 10;
  const highIptm = interfaceIptm >= 0.8;
  const moderate = (primary?.iptm ?? 0) >= 0.6;
  const alternative = asksForBiology
    ? 'A biological explanation may be plausible, but the loaded confidence outputs cannot distinguish it from other functional interpretations.'
    : facts.selection
      ? 'The selected PAE may reflect uncertain relative placement rather than poor local folding; inspect local pLDDT separately.'
      : highIptm
        ? 'A high interface score can coexist with uncertain relative placement, so the interface may be plausible without being geometrically precise.'
        : moderate
          ? 'The model may capture a real interaction mode, but the current confidence evidence also permits an unstable or incorrectly oriented interface.'
          : 'A weak interface-level result does not prove that no interaction exists; it only means this prediction does not support one confidently.';
  const falsification = facts.selection
    ? 'A materially different PAE pattern for the same residues in another prediction would change this interpretation.'
    : primary
      ? 'A different prediction with a conflicting ipTM, reciprocal PAE pattern, or clash status would change this interface-level conclusion.'
      : 'Additional pLDDT or PAE evidence tied to a specific region would be needed to replace this limited conclusion.';
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
  } else if (asksForAlternative) {
    answer = alternative;
  } else if (asksForFalsification) {
    answer = falsification;
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
    alternative,
    falsification,
    nextQuestions: facts.selection
      ? ['What is the strongest evidence for this selection?', 'Challenge this interpretation.', 'What would change this conclusion?']
      : primary
        ? [`Which part of the ${primary.chainA}–${primary.chainB} interface is least certain?`, 'Challenge this interface conclusion.', 'What would change this conclusion?']
        : ['What should I inspect first?', 'Which region is least certain?', 'What would change this conclusion?'],
    caveats: [
      'Confidence is not experimental validation.',
      ...(primary?.paeMin !== null && primary?.paeMin !== undefined ? ['Minimum PAE is the best local cell; representative interpretation uses reciprocal median PAE.'] : []),
      ...(facts.domains.some((domain) => domain.source === 'pae') ? ['PAE-derived regions are structural segments, not functional domain annotations.'] : []),
      ...facts.notices,
    ].slice(0, 3),
  };
}

function topStructuralRegion(facts: AnalysisFacts) {
  return [...facts.domains]
    .filter((domain) => domain.meanPlddt !== null || domain.meanInternalPae !== null)
    .sort((a, b) => {
      const confidenceRisk = (a.meanPlddt ?? 100) - (b.meanPlddt ?? 100);
      return confidenceRisk !== 0 ? confidenceRisk : (b.meanInternalPae ?? 0) - (a.meanInternalPae ?? 0);
    })[0];
}

function loadedDomainRange(facts: AnalysisFacts, chainId: string, start: number, end: number): ResidueRange | null {
  const overlaps = facts.chainRanges
    .filter((range) => range.chainId === chainId && range.end >= start && range.start <= end)
    .map((range) => ({ chainId, start: Math.max(start, range.start), end: Math.min(end, range.end) }))
    .sort((a, b) => (b.end - b.start) - (a.end - a.start));
  return overlaps[0] ?? null;
}

export function buildEvidenceCatalog(facts: AnalysisFacts): Map<string, AssistantEvidence> {
  const catalog = new Map<string, AssistantEvidence>();
  const add = (ref: EvidenceRef, evidence: Omit<AssistantEvidence, 'id'>) => catalog.set(ref, { id: ref, ...evidence });
  const noAction = { type: 'none' as const, chainIds: [], residueRanges: [], selection: null };
  const primary = facts.primaryInterface;
  const interfaceRanges = primary
    ? facts.chainRanges.filter((range) => range.chainId === primary.chainA || range.chainId === primary.chainB)
    : [];

  if (primary?.iptm !== null && primary?.iptm !== undefined && interfaceRanges.length) add('primary_interface_iptm', {
    label: `${primary.chainA}–${primary.chainB} ipTM`,
    value: primary.iptm.toFixed(2),
    interpretation: primary.iptm >= 0.8 ? 'Strong interface-level confidence' : primary.iptm >= 0.6 ? 'Moderate interface-level confidence' : 'Weak interface-level confidence',
    action: { type: 'show_interface', chainIds: [primary.chainA, primary.chainB], residueRanges: interfaceRanges, selection: null },
  });
  if (primary?.paeMedian !== null && primary?.paeMedian !== undefined && interfaceRanges.length) add('primary_interface_pae', {
    label: `${primary.chainA}–${primary.chainB} reciprocal median PAE`,
    value: `${primary.paeMedian.toFixed(1)} Å`,
    interpretation: `${primary.chainB} scored on ${primary.chainA}: ${primary.paeForwardMean?.toFixed(1) ?? '—'} Å · reverse ${primary.paeReverseMean?.toFixed(1) ?? '—'} Å · ${Math.round((primary.lowPaeFraction ?? 0) * 100)}% ≤5 Å`,
    action: { type: 'show_interface', chainIds: [primary.chainA, primary.chainB], residueRanges: interfaceRanges, selection: null },
  });

  const low = facts.lowConfidenceRegions[0];
  if (low) add('lowest_confidence_region', {
    label: 'Local pLDDT',
    value: `${low.chainId} ${low.start}–${low.end} · ${Math.round(low.meanPlddt)}`,
    interpretation: 'Inspect this flexible or weakly resolved region',
    action: { type: 'show_residues', chainIds: [low.chainId], residueRanges: [{ chainId: low.chainId, start: low.start, end: low.end }], selection: null },
  });

  if (facts.selection?.medianPae !== null && facts.selection?.medianPae !== undefined) add('active_selection_pae', {
    label: 'Selected reciprocal median PAE',
    value: `${facts.selection.medianPae.toFixed(1)} Å`,
    interpretation: `${facts.selection.scoredLabel} on ${facts.selection.alignedLabel}: ${facts.selection.forwardMeanPae?.toFixed(1) ?? '—'} Å · reverse ${facts.selection.reverseMeanPae?.toFixed(1) ?? '—'} Å`,
    action: {
      type: 'show_selection',
      chainIds: [...new Set(facts.selection.residueRanges.map((range) => range.chainId))],
      residueRanges: facts.selection.residueRanges,
      selection: facts.selection.matrixRange,
    },
  });

  const domain = topStructuralRegion(facts);
  if (domain) {
    const loadedRange = loadedDomainRange(facts, domain.chainId, domain.start, domain.end);
    const residueRanges = loadedRange ? [loadedRange] : [];
    if (domain.meanPlddt !== null && loadedRange) add('top_structural_region_plddt', {
      label: domain.label,
      value: `${loadedRange.chainId} ${loadedRange.start}–${loadedRange.end} · ${Math.round(domain.meanPlddt)}`,
      interpretation: domain.meanPlddt >= 90 ? 'Very high local confidence' : domain.meanPlddt >= 70 ? 'Confident local structure' : 'Inspect local geometry cautiously',
      action: { type: 'show_residues', chainIds: [domain.chainId], residueRanges, selection: null },
    });
    if (domain.closestDomainPae !== null && domain.closestDomainLabel && loadedRange) add('top_structural_region_pae', {
      label: 'Nearest region placement',
      value: `${domain.closestDomainPae.toFixed(1)} Å`,
      interpretation: `Relative to ${domain.closestDomainLabel}`,
      action: { type: 'show_residues', chainIds: [domain.chainId], residueRanges, selection: null },
    });
  }

  if (facts.rankingScore !== null) add('ranking_score', {
    label: 'Ranking score', value: facts.rankingScore.toFixed(3), interpretation: 'Ranks this prediction within the loaded job', action: noAction,
  });
  if (facts.ptm !== null) add('overall_ptm', {
    label: 'pTM', value: facts.ptm.toFixed(2), interpretation: 'Global fold-level confidence', action: noAction,
  });
  if (facts.iptm !== null) add('overall_iptm', {
    label: 'Overall ipTM', value: facts.iptm.toFixed(2), interpretation: 'Overall interface confidence across the prediction', action: noAction,
  });
  if (facts.hasClash !== null) add('clash_status', {
    label: 'Clash flag',
    value: facts.hasClash ? 'Flagged' : 'Not flagged',
    interpretation: facts.hasClash ? 'Inspect local geometry before interpretation' : 'No summary-level clash was reported',
    action: noAction,
  });
  return catalog;
}

function detectLanguage(question: string): 'en' | 'ja' {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(question) ? 'ja' : 'en';
}

function inferIntent(question: string, facts: AnalysisFacts): AssistantIntent {
  const normalized = question.toLowerCase();
  if (!normalized.trim() && facts.selection) return 'selection_support';
  if (/(drug|clinical|disease|treat|efficacy|mechanism|function|binds? in vivo|biologically correct|薬|臨床|疾患|治療|有効|効能|機序|機能|生物学)/.test(normalized)) return 'scope_boundary';
  if (/(compare|comparison|versus|difference|比較|違い|差分)/.test(normalized)) return 'comparison';
  if (/(domain|structural region|ドメイン|構造領域)/.test(normalized)) return 'structural_region_priority';
  if (/(selected|selection|this region|選択|この領域)/.test(normalized) && facts.selection) return 'selection_support';
  if (/(clash|overlap|steric|衝突|重なり)/.test(normalized)) return 'clash_review';
  if (/(challenge|alternative|another interpretation|competing explanation|別の解釈|対立仮説)/.test(normalized)) return 'alternative_interpretation';
  if (/(falsif|change this conclusion|change the conclusion|weaken this conclusion|反証|結論を変|覆す)/.test(normalized)) return 'falsification';
  if (/(uncertain|avoid|caution|least confident|low confidence|weak|unreliable|inspect first|不確実|避け|注意|信頼できない|信頼性が低|最初に確認)/.test(normalized)) return 'regional_uncertainty';
  if (/(interface|interaction|界面|相互作用)/.test(normalized)) return 'interface_reliability';
  return 'overall_assessment';
}

function questionForIntent(intent: AssistantIntent) {
  const questions: Record<AssistantIntent, string> = {
    overall_assessment: 'Summarize the prediction confidence.',
    interface_reliability: 'Is the interface reliable?',
    selection_support: 'What does the selected region support?',
    regional_uncertainty: 'Which region should I inspect first?',
    structural_region_priority: 'Which structural region should I inspect first?',
    clash_review: 'Does this model have a clash?',
    scope_boundary: 'Will this work clinically?',
    alternative_interpretation: 'Challenge this interpretation.',
    falsification: 'What would change this conclusion?',
    comparison: 'Compare these predictions.',
  };
  return questions[intent];
}

function defaultEvidenceRefs(intent: AssistantIntent): EvidenceRef[] {
  if (intent === 'selection_support') return ['active_selection_pae', 'lowest_confidence_region', 'primary_interface_pae'];
  if (intent === 'structural_region_priority') return ['top_structural_region_plddt', 'top_structural_region_pae', 'lowest_confidence_region'];
  if (intent === 'regional_uncertainty') return ['lowest_confidence_region', 'primary_interface_pae', 'primary_interface_iptm'];
  if (intent === 'clash_review') return ['clash_status', 'primary_interface_pae'];
  return ['primary_interface_iptm', 'primary_interface_pae', 'lowest_confidence_region'];
}

function followUpQuestion(intent: AssistantIntent, facts: AnalysisFacts, language: 'en' | 'ja') {
  const pair = facts.primaryInterface ? `${facts.primaryInterface.chainA}–${facts.primaryInterface.chainB}` : 'primary';
  const english: Record<AssistantIntent, string> = {
    overall_assessment: 'What is the strongest evidence for this conclusion?',
    interface_reliability: `Which part of the ${pair} interface is least certain?`,
    selection_support: 'What is the strongest evidence for this selection?',
    regional_uncertainty: 'Which region should I inspect first?',
    structural_region_priority: 'Which structural region should I inspect first?',
    clash_review: 'Does the summary report a clash?',
    scope_boundary: 'What can these confidence metrics support?',
    alternative_interpretation: 'Challenge this interpretation.',
    falsification: 'What would change this conclusion?',
    comparison: 'What evidence is available for the active prediction?',
  };
  const japanese: Record<AssistantIntent, string> = {
    overall_assessment: 'この結論を支える最も強い根拠は何ですか？',
    interface_reliability: `${pair}界面で最も不確実な部分はどこですか？`,
    selection_support: '選択領域を支える最も強い根拠は何ですか？',
    regional_uncertainty: '最初に確認すべき領域はどこですか？',
    structural_region_priority: '最初に確認すべき構造領域はどこですか？',
    clash_review: 'サマリーに衝突フラグはありますか？',
    scope_boundary: 'この信頼度指標から何が言えますか？',
    alternative_interpretation: 'この解釈に対する別の説明はありますか？',
    falsification: '何があればこの結論は変わりますか？',
    comparison: '現在の予測で利用できる根拠は何ですか？',
  };
  return (language === 'ja' ? japanese : english)[intent];
}

function japaneseResponse(base: AssistantResponse, intent: AssistantIntent, facts: AnalysisFacts): AssistantResponse {
  const primary = facts.primaryInterface;
  const low = facts.lowConfidenceRegions[0];
  const domain = topStructuralRegion(facts);
  const domainRange = domain ? loadedDomainRange(facts, domain.chainId, domain.start, domain.end) : null;
  const interfacePae = primary?.paeMedian;
  const highIptm = (primary?.iptm ?? 0) >= 0.8;
  const moderate = (primary?.iptm ?? 0) >= 0.6;
  const strong = highIptm && interfacePae !== null && interfacePae !== undefined && interfacePae <= 5;
  const mixed = highIptm && interfacePae !== null && interfacePae !== undefined && interfacePae <= 10;
  const alternative = intent === 'scope_boundary'
    ? '生物学的な説明は仮説として考えられますが、読み込んだ信頼度出力だけでは他の機能解釈と区別できません。'
    : facts.selection
      ? '選択領域のPAEは局所構造の崩れではなく相対配置の不確実性を示す可能性があります。局所pLDDTも確認してください。'
      : highIptm
        ? '高い界面スコアと不確実な相対配置は両立します。界面は妥当でも幾何学的な精度が低い可能性があります。'
        : '弱い界面指標は相互作用が存在しない証明ではなく、この予測単独では強く支持できないことを示します。';
  const falsification = facts.selection
    ? '別の予測で同じ残基に大きく異なるPAEパターンが得られれば、この解釈は変わります。'
    : primary
      ? '別の予測でipTM、双方向PAE、衝突フラグが矛盾すれば、この界面レベルの結論は変わります。'
      : '特定領域に対応するpLDDTまたはPAEが追加されれば、この限定的な結論を更新できます。';
  let answer: string;
  if (intent === 'scope_boundary') answer = '読み込んだ信頼度指標から、生物学的機能・治療効果・臨床的意義を確定することはできません。この予測に対する信頼度だけを示します。';
  else if (intent === 'comparison') answer = '比較対象のラベルだけではモデル間の差を根拠付きで評価できません。各予測の同じ指標を並べた比較データが必要です。';
  else if (intent === 'structural_region_priority') answer = domain && domainRange
    ? `${domain.label}（${domainRange.chainId} ${domainRange.start}–${domainRange.end}）を優先して確認してください${domain.meanPlddt !== null ? `。平均pLDDTは${Math.round(domain.meanPlddt)}です` : ''}。`
    : '読み込んだファイルにはドメイン注釈またはPAE由来の構造領域がありません。';
  else if (intent === 'selection_support' && facts.selection) answer = facts.selection.medianPae === null
    ? `選択領域（${facts.selection.label}）には整列誤差の値がありません。`
    : `選択領域（${facts.selection.label}）の双方向PAE中央値は${facts.selection.medianPae.toFixed(1)} Åです。`;
  else if (intent === 'clash_review') answer = facts.hasClash === null ? '読み込んだサマリーには衝突フラグがありません。'
    : facts.hasClash ? 'サマリーに衝突フラグがあります。局所形状を確認してから解釈してください。'
      : 'サマリーに衝突フラグはありませんが、物理的に妥当な形状である保証ではありません。';
  else if (intent === 'alternative_interpretation') answer = alternative;
  else if (intent === 'falsification') answer = falsification;
  else if (intent === 'regional_uncertainty') answer = low
    ? `${low.chainId} ${low.start}–${low.end}を最も慎重に扱ってください。平均pLDDTは${Math.round(low.meanPlddt)}です。`
    : facts.hasPlddt ? (facts.hasPae ? '持続的な低pLDDT領域は検出されませんでした。次に高PAEブロックを確認してください。' : '持続的な低pLDDT領域は検出されず、PAE行列もありません。')
      : facts.hasPae ? 'pLDDTがありません。相対配置の不確実性は高PAEブロックで確認してください。' : 'pLDDTもPAEもないため、領域の優先順位付けはできません。';
  else answer = strong ? `全体として信頼できる可能性が高いです${low ? 'が、局所的な注意点があります' : ''}。`
    : mixed ? '界面スコアは強い一方、双方向PAEは相対配置の確実性が混在していることを示します。'
      : highIptm ? 'ipTMは界面を支持しますが、双方向PAEは相対配置に広い不確実性を示します。'
        : moderate ? '界面は妥当な可能性がありますが、相対配置を局所的に確認する必要があります。'
          : '与えられた信頼度指標だけでは、信頼できる界面レベルの結論を支持できません。';
  return {
    ...base,
    answer,
    alternative,
    falsification,
    caveats: [
      '信頼度は実験的検証ではありません。',
      ...(primary?.paeMin !== null && primary?.paeMin !== undefined ? ['最小PAEは最良の局所セルです。代表的な解釈には双方向PAE中央値を使います。'] : []),
      ...(facts.domains.some((item) => item.source === 'pae') ? ['PAE由来の領域は構造セグメントであり、機能ドメイン注釈ではありません。'] : []),
      ...facts.notices,
    ].slice(0, 3),
  };
}

export function buildLocalAssistantResponse(facts: AnalysisFacts, prediction?: Prediction, question = '', plan?: AssistantPlan): AssistantResponse {
  const intent = plan?.intent ?? inferIntent(question, facts);
  const language = plan?.language ?? detectLanguage(question);
  const base = legacyBuildLocalAssistantResponse(facts, prediction, plan ? questionForIntent(intent) : question);
  const domain = topStructuralRegion(facts);
  const domainRange = domain ? loadedDomainRange(facts, domain.chainId, domain.start, domain.end) : null;
  const localized = language === 'ja' ? japaneseResponse(base, intent, facts) : intent === 'comparison'
    ? { ...base, answer: 'A comparison label alone cannot support a model-to-model conclusion. Matching deterministic metrics from both predictions are required.' }
    : intent === 'structural_region_priority' && domain && domainRange
      ? { ...base, answer: `${domain.label} (${domainRange.chainId} ${domainRange.start}–${domainRange.end}) deserves the closest inspection${domain.meanPlddt !== null ? `; its mean pLDDT is ${Math.round(domain.meanPlddt)}` : ''}.` }
      : base;
  const catalog = buildEvidenceCatalog(facts);
  const requestedRefs = plan?.evidenceRefs.length ? plan.evidenceRefs : defaultEvidenceRefs(intent);
  let evidence = requestedRefs.map((ref) => catalog.get(ref)).filter((item): item is AssistantEvidence => Boolean(item));
  if (!evidence.length) evidence = defaultEvidenceRefs(intent).map((ref) => catalog.get(ref)).filter((item): item is AssistantEvidence => Boolean(item));
  const defaultFollowUps: AssistantIntent[] = facts.selection
    ? ['selection_support', 'alternative_interpretation', 'falsification']
    : facts.primaryInterface
      ? ['regional_uncertainty', 'alternative_interpretation', 'falsification']
      : ['overall_assessment', 'regional_uncertainty', 'falsification'];
  const followUpIntents = plan?.followUpIntents.length ? plan.followUpIntents : defaultFollowUps;
  return {
    ...localized,
    evidence: evidence.slice(0, 4),
    nextQuestions: [...new Set(followUpIntents.map((nextIntent) => followUpQuestion(nextIntent, facts, language)))].slice(0, 3),
  };
}
