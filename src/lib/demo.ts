import demoCifUrl from '../assets/kras-sos1.cif?url';
import type { AF3Result } from '../types/af3';

const CHAIN_IDS = ['Q', 'R', 'S'];

export function makeDemoPae(size = 192, variant = 0): number[][] {
  const boundary = Math.floor(size / 3);
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const sameBlock = Math.floor(x / boundary) === Math.floor(y / boundary);
      const diagonal = Math.abs(x - y);
      const texture = 1.1 * (Math.sin(x * 0.19) + Math.cos(y * 0.13) + 2);
      const modelVariation = variant * 0.42 + Math.sin((x + y + variant * 11) * 0.07) * variant * 0.08;
      if (sameBlock) return Math.min(31, 2.1 + diagonal * 0.045 + texture + modelVariation);
      const qToS =
        (x < boundary && y >= boundary * 2) ||
        (y < boundary && x >= boundary * 2);
      return Math.min(31, (qToS ? 5.2 : 9.5) + diagonal * 0.02 + texture + modelVariation);
    }),
  );
}

const scores = [0.92, 0.89, 0.84, 0.81, 0.76];
const tokenChainIds = Array.from({ length: 192 }, (_, i) => CHAIN_IDS[Math.min(2, Math.floor(i / 64))]);
const tokenResidues = tokenChainIds.map((chainId, tokenIndex) => {
  const ordinal = tokenIndex % 64;
  const residueNumber = chainId === 'S' ? 564 + ordinal : 1 + ordinal;
  return { tokenIndex, chainId, residueId: String(residueNumber), residueNumber, residueName: 'RES' };
});
const tokenPlddts = tokenResidues.map((token) => {
  if (token.chainId === 'S' && token.residueNumber !== undefined && token.residueNumber >= 612 && token.residueNumber <= 626) {
    return 50 + ((token.residueNumber - 612) % 5) * 2;
  }
  return 84 + (token.tokenIndex % 9);
});

export const demoResult: AF3Result = {
  jobName: 'KRAS · SOS1 complex',
  sourceName: 'FoldLens demo',
  predictions: scores.map((score, index) => ({
    id: `demo-${index + 1}`,
    label: `Model ${index + 1}`,
    path: `demo/model_${index + 1}.cif`,
    cif: '',
    summary: {
      rankingScore: score,
      iptm: Math.max(0.61, 0.88 - index * 0.045),
      ptm: Math.max(0.69, 0.91 - index * 0.035),
      hasClash: index === 4,
      chainIds: CHAIN_IDS,
      chainPairIptm: [
        [0.91, 0.78, 0.87],
        [0.78, 0.89, 0.82],
        [0.87, 0.82, 0.93],
      ],
      chainPairPaeMin: [
        [0, 7.8, 2.1],
        [7.8, 0, 3.6],
        [2.1, 3.6, 0],
      ],
    },
    confidence: { pae: makeDemoPae(192, index), tokenChainIds, tokenResidues, tokenPlddts },
  })),
  chains: [
    { id: 'Q', label: 'KRAS · allosteric', kind: 'protein', color: '#a9d94a', range: '1–166' },
    { id: 'R', label: 'KRAS · active site', kind: 'protein', color: '#42bdf5', range: '1–166' },
    { id: 'S', label: 'SOS1', kind: 'protein', color: '#367de8', range: '564–1049' },
    { id: 'L', label: 'Ligand · GNP', kind: 'ligand', color: '#aa73df' },
  ],
  domainAnnotations: [
    { id: 'q-ras-g', label: 'Ras G domain', chainId: 'Q', start: 1, end: 166, source: 'provided' },
    { id: 'r-ras-g', label: 'Ras G domain', chainId: 'R', start: 1, end: 166, source: 'provided' },
    { id: 's-rem', label: 'REM domain', chainId: 'S', start: 564, end: 741, source: 'provided' },
    { id: 's-cdc25', label: 'CDC25 domain', chainId: 'S', start: 742, end: 1049, source: 'provided' },
  ],
  notices: ['Demo structure: PDB 1NVV. Confidence values are illustrative.'],
  isDemo: true,
};

export async function loadDemoResult(): Promise<AF3Result> {
  const response = await fetch(demoCifUrl);
  if (!response.ok) throw new Error('The sample structure could not be loaded.');
  const cif = await response.text();
  return { ...demoResult, predictions: demoResult.predictions.map((prediction) => ({ ...prediction, cif })) };
}
