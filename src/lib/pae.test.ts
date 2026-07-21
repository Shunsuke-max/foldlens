import { describe, expect, it } from 'vitest';
import { chainPairPaeSummary, robustPairSelection, selectionPaeSummary } from './pae';

describe('PAE statistics', () => {
  it('keeps scored-on-aligned directionality and reports a reciprocal median', () => {
    const matrix = Array.from({ length: 4 }, () => Array(4).fill(20));
    for (let y = 2; y < 4; y += 1) for (let x = 0; x < 2; x += 1) matrix[y][x] = 2;
    for (let y = 0; y < 2; y += 1) for (let x = 2; x < 4; x += 1) matrix[y][x] = 12;

    const stats = chainPairPaeSummary(matrix, ['A', 'A', 'B', 'B'], 'A', 'B');
    expect(stats.forward.mean).toBe(12);
    expect(stats.reverse.mean).toBe(2);
    expect(stats.reciprocalMedian).toBe(7);
    expect(stats.lowFraction).toBe(0.5);
  });

  it('uses both directions for an arbitrary rectangular selection', () => {
    const matrix = [
      [1, 1, 9, 9],
      [1, 1, 9, 9],
      [3, 3, 1, 1],
      [3, 3, 1, 1],
    ];
    const stats = selectionPaeSummary(matrix, { xStart: 0, xEnd: 1, yStart: 2, yEnd: 3 });
    expect(stats.forward.mean).toBe(9);
    expect(stats.reverse.mean).toBe(3);
    expect(stats.reciprocalMean).toBe(6);
  });

  it('rejects an out-of-bounds selection without allocating the requested range', () => {
    const matrix = [[1, 2], [2, 1]];
    const stats = selectionPaeSummary(matrix, { xStart: 0, xEnd: 1_000_000_000, yStart: 0, yEnd: 1 });
    expect(stats.reciprocalMean).toBeNull();
    expect(stats.forward.count).toBe(0);
  });

  it('selects a coherent low-PAE window instead of an isolated minimum cell', () => {
    const size = 40;
    const matrix = Array.from({ length: size }, () => Array(size).fill(18));
    matrix[20][0] = 0.1;
    matrix[0][20] = 0.1;
    for (let y = 28; y <= 33; y += 1) {
      for (let x = 8; x <= 13; x += 1) {
        matrix[y][x] = 4;
        matrix[x][y] = 4;
      }
    }

    const selection = robustPairSelection(matrix, [...Array(20).fill('A'), ...Array(20).fill('B')], 'A', 'B');
    expect(selection).not.toBeNull();
    expect(selection!.xStart).toBeGreaterThan(0);
    expect(selection!.yStart).toBeGreaterThan(20);
    expect(selectionPaeSummary(matrix, selection).reciprocalMean).toBeLessThan(9);
  });
});
