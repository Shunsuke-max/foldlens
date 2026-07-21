import type { Selection } from '../types/af3';

const MAX_AXIS_SAMPLES = 64;
export const LOW_PAE_THRESHOLD = 5;

export type PaeSummary = {
  mean: number | null;
  median: number | null;
  lowFraction: number | null;
  minimum: number | null;
  count: number;
};

export type ReciprocalPaeSummary = {
  forward: PaeSummary;
  reverse: PaeSummary;
  reciprocalMean: number | null;
  reciprocalMedian: number | null;
  lowFraction: number | null;
  minimum: number | null;
};

function finiteValues(values: Array<number | undefined>) {
  return values.filter((value): value is number => value !== undefined && Number.isFinite(value));
}

function summarize(values: number[]): PaeSummary {
  if (!values.length) return { mean: null, median: null, lowFraction: null, minimum: null, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median,
    lowFraction: values.filter((value) => value <= LOW_PAE_THRESHOLD).length / values.length,
    minimum: sorted[0],
    count: values.length,
  };
}

function sampledValues(matrix: number[][], rows: number[], columns: number[]) {
  if (!rows.length || !columns.length) return [];
  const rowStep = Math.max(1, Math.ceil(rows.length / MAX_AXIS_SAMPLES));
  const columnStep = Math.max(1, Math.ceil(columns.length / MAX_AXIS_SAMPLES));
  const values: Array<number | undefined> = [];
  for (let row = 0; row < rows.length; row += rowStep) {
    for (let column = 0; column < columns.length; column += columnStep) {
      values.push(matrix[rows[row]]?.[columns[column]]);
    }
  }
  return finiteValues(values);
}

function boundedRange(start: number, end: number, upperBound: number) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= upperBound) return [];
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function reciprocalPaeSummary(matrix: number[][] | undefined, alignedIndices: number[], scoredIndices: number[]): ReciprocalPaeSummary {
  if (!matrix?.length) {
    const empty = summarize([]);
    return { forward: empty, reverse: empty, reciprocalMean: null, reciprocalMedian: null, lowFraction: null, minimum: null };
  }
  // AF3 defines matrix[i][j] as token j scored in the frame of aligned token i.
  const forwardValues = sampledValues(matrix, alignedIndices, scoredIndices);
  const reverseValues = sampledValues(matrix, scoredIndices, alignedIndices);
  const combined = [...forwardValues, ...reverseValues];
  const forward = summarize(forwardValues);
  const reverse = summarize(reverseValues);
  const reciprocal = summarize(combined);
  return {
    forward,
    reverse,
    reciprocalMean: reciprocal.mean,
    reciprocalMedian: reciprocal.median,
    lowFraction: reciprocal.lowFraction,
    minimum: reciprocal.minimum,
  };
}

export function selectionPaeSummary(matrix: number[][] | undefined, selection: Selection) {
  if (!selection) return reciprocalPaeSummary(matrix, [], []);
  const size = matrix?.length ?? 0;
  if (!size) return reciprocalPaeSummary(matrix, [], []);
  return reciprocalPaeSummary(
    matrix,
    boundedRange(selection.xStart, selection.xEnd, size),
    boundedRange(selection.yStart, selection.yEnd, size),
  );
}

export function chainPairPaeSummary(matrix: number[][] | undefined, chainIds: string[], chainA: string, chainB: string) {
  const alignedIndices: number[] = [];
  const scoredIndices: number[] = [];
  chainIds.forEach((chainId, index) => {
    if (chainId === chainA) alignedIndices.push(index);
    if (chainId === chainB) scoredIndices.push(index);
  });
  return reciprocalPaeSummary(matrix, alignedIndices, scoredIndices);
}

function candidateStarts(indices: number[], window: number) {
  const first = indices[0];
  const lastStart = Math.max(first, indices.at(-1)! - window + 1);
  const step = Math.max(1, Math.floor(window / 2));
  const starts: number[] = [];
  for (let start = first; start <= lastStart; start += step) starts.push(start);
  if (starts.at(-1) !== lastStart) starts.push(lastStart);
  return starts;
}

export function robustPairSelection(matrix: number[][] | undefined, chainIds: string[], chainA: string, chainB: string): Selection {
  const aligned = chainIds.map((id, index) => id === chainA ? index : -1).filter((index) => index >= 0);
  const scored = chainIds.map((id, index) => id === chainB ? index : -1).filter((index) => index >= 0);
  if (!aligned.length || !scored.length) return null;
  if (!matrix?.length) return { xStart: aligned[0], xEnd: aligned.at(-1)!, yStart: scored[0], yEnd: scored.at(-1)! };

  const window = Math.max(6, Math.min(16, Math.floor(Math.min(aligned.length, scored.length) * 0.22)));
  let best: { selection: NonNullable<Selection>; mean: number; lowFraction: number } | null = null;
  for (const xStart of candidateStarts(aligned, window)) {
    for (const yStart of candidateStarts(scored, window)) {
      const selection = {
        xStart,
        xEnd: Math.min(aligned.at(-1)!, xStart + window - 1),
        yStart,
        yEnd: Math.min(scored.at(-1)!, yStart + window - 1),
      };
      const stats = selectionPaeSummary(matrix, selection);
      if (stats.reciprocalMean === null) continue;
      const lowFraction = stats.lowFraction ?? 0;
      if (!best || stats.reciprocalMean < best.mean || (stats.reciprocalMean === best.mean && lowFraction > best.lowFraction)) {
        best = { selection, mean: stats.reciprocalMean, lowFraction };
      }
    }
  }
  return best?.selection ?? { xStart: aligned[0], xEnd: aligned.at(-1)!, yStart: scored[0], yEnd: scored.at(-1)! };
}
