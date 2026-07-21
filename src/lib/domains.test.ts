import { describe, expect, it } from 'vitest';
import { inferDomains } from './domains';
import type { AF3Result, Prediction } from '../types/af3';

function syntheticResult(pae: number[][], annotations: AF3Result['domainAnnotations'] = []): { result: AF3Result; prediction: Prediction } {
  const tokenResidues = Array.from({ length: pae.length }, (_, tokenIndex) => ({ tokenIndex, chainId: 'A', residueId: String(tokenIndex + 1), residueNumber: tokenIndex + 1 }));
  const prediction: Prediction = { id: 'one', label: 'Model 1', path: 'one.cif', cif: '', summary: {}, confidence: { pae, tokenResidues, tokenChainIds: tokenResidues.map(() => 'A'), tokenPlddts: tokenResidues.map((_, index) => 92 - index * 0.2) } };
  const result: AF3Result = { jobName: 'test', sourceName: 'test', predictions: [prediction], chains: [{ id: 'A', label: 'Protein · Chain A', kind: 'protein', color: '#fff' }], domainAnnotations: annotations, notices: [] };
  return { result, prediction };
}

describe('domain inference', () => {
  it('does not claim PAE-derived regions when no PAE matrix exists', () => {
    const { result, prediction } = syntheticResult([[1]]);
    prediction.confidence = { tokenResidues: prediction.confidence!.tokenResidues, tokenChainIds: ['A'] };
    expect(inferDomains(result, prediction)).toEqual([]);
  });

  it('splits strong diagonal PAE blocks into predicted structural regions', () => {
    const pae = Array.from({ length: 48 }, (_, y) => Array.from({ length: 48 }, (_, x) => Math.floor(x / 24) === Math.floor(y / 24) ? 3 : 18));
    const { result, prediction } = syntheticResult(pae);
    const domains = inferDomains(result, prediction);

    expect(domains).toHaveLength(2);
    expect(domains.map((domain) => [domain.start, domain.end])).toEqual([[1, 24], [25, 48]]);
    expect(domains[0].label).toBe('Predicted region A.1');
    expect(domains[0].closestDomainPae).toBeCloseTo(18);
  });

  it('prefers named annotations and attaches confidence metrics', () => {
    const pae = Array.from({ length: 40 }, (_, y) => Array.from({ length: 40 }, (_, x) => Math.abs(x - y) < 20 ? 4 : 12));
    const { result, prediction } = syntheticResult(pae, [
      { id: 'a-core', label: 'Catalytic domain', chainId: 'A', start: 1, end: 20, source: 'interpro' },
      { id: 'a-reg', label: 'Regulatory domain', chainId: 'A', start: 21, end: 40, source: 'interpro' },
    ]);
    const domains = inferDomains(result, prediction);

    expect(domains.map((domain) => domain.label)).toEqual(['Catalytic domain', 'Regulatory domain']);
    expect(domains[0].source).toBe('interpro');
    expect(domains[0].meanPlddt).not.toBeNull();
  });
});
