import demoCifUrl from '../assets/4hla.cif?url';
import type { AF3Result } from '../types/af3';

const CHAIN_IDS = ['A', 'B'];

export function makeDemoPae(size = 198, variant = 0): number[][] {
  const boundary = Math.floor(size / CHAIN_IDS.length);
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const sameBlock = Math.floor(x / boundary) === Math.floor(y / boundary);
      const diagonal = Math.abs(x - y);
      const texture = 1.1 * (Math.sin(x * 0.19) + Math.cos(y * 0.13) + 2);
      const modelVariation = variant * 0.42 + Math.sin((x + y + variant * 11) * 0.07) * variant * 0.08;
      if (sameBlock) return Math.min(31, 2.1 + diagonal * 0.045 + texture + modelVariation);
      return Math.min(31, 5.2 + diagonal * 0.02 + texture + modelVariation);
    }),
  );
}

const scores = [0.92, 0.89, 0.84, 0.81, 0.76];
const tokenChainIds = Array.from({ length: 198 }, (_, i) => CHAIN_IDS[Math.min(CHAIN_IDS.length - 1, Math.floor(i / 99))]);
const tokenResidues = tokenChainIds.map((chainId, tokenIndex) => {
  const residueNumber = tokenIndex % 99 + 1;
  return { tokenIndex, chainId, residueId: String(residueNumber), residueNumber, residueName: 'RES' };
});
const tokenPlddts = tokenResidues.map((token) => {
  if (token.chainId === 'B' && token.residueNumber !== undefined && token.residueNumber >= 43 && token.residueNumber <= 58) {
    return 50 + ((token.residueNumber - 43) % 5) * 2;
  }
  return 84 + (token.tokenIndex % 9);
});

export const demoResult: AF3Result = {
  jobName: 'HIV-1 protease · darunavir',
  sourceName: 'FoldLens demo',
  predictions: scores.map((score, index) => ({
    id: `demo-${index + 1}`,
    label: `Illustrative variant ${index + 1}`,
    path: `demo/model_${index + 1}.cif`,
    cif: '',
    summary: {
      rankingScore: score,
      iptm: Math.max(0.61, 0.88 - index * 0.045),
      ptm: Math.max(0.69, 0.91 - index * 0.035),
      hasClash: index === 4,
      chainIds: CHAIN_IDS,
      chainPairIptm: [
        [0.93, 0.90],
        [0.90, 0.94],
      ],
      chainPairPaeMin: [
        [0, 2.1],
        [2.1, 0],
      ],
    },
    confidence: { pae: makeDemoPae(198, index), tokenChainIds, tokenResidues, tokenPlddts },
  })),
  chains: [
    { id: 'A', label: 'HIV-1 protease · monomer A', kind: 'protein', color: '#a9d94a', range: '1–99' },
    { id: 'B', label: 'HIV-1 protease · monomer B', kind: 'protein', color: '#42bdf5', range: '1–99' },
    { id: 'ligand:017', label: 'Ligand · darunavir (017)', kind: 'ligand', color: '#aa73df', ligandCodes: ['017'], sourceChainIds: ['A', 'B'], instanceCount: 1 },
  ],
  domainAnnotations: [
    { id: 'a-catalytic-loop', label: 'Catalytic loop A', chainId: 'A', start: 23, end: 32, source: 'provided' },
    { id: 'a-flap', label: 'Flap A', chainId: 'A', start: 43, end: 58, source: 'provided' },
    { id: 'b-catalytic-loop', label: 'Catalytic loop B', chainId: 'B', start: 23, end: 32, source: 'provided' },
    { id: 'b-flap', label: 'Flap B', chainId: 'B', start: 43, end: 58, source: 'provided' },
  ],
  biologicalContext: {
    displayName: 'HIV-1 protease',
    organism: 'Human immunodeficiency virus 1 (HIV-1)',
    summary: {
      en: 'HIV-1 protease is a viral enzyme that cleaves Gag and Gag–Pol polyproteins into the mature proteins needed to assemble an infectious virus particle.',
      ja: 'HIV-1プロテアーゼは、ウイルスのGagおよびGag–Polポリプロテインを切断し、感染性を持つウイルス粒子の形成に必要な成熟タンパク質を作る酵素です。',
    },
    relevance: {
      en: 'Because this cleavage step is essential for viral maturation, HIV-1 protease is a major antiretroviral drug target. The 4HLA structure contains the protease inhibitor darunavir in its active site.',
      ja: 'この切断はウイルス成熟に不可欠なため、HIV-1プロテアーゼは主要な抗レトロウイルス薬の標的です。4HLA構造では、阻害薬ダルナビルが活性部位に結合しています。',
    },
    sourceLabel: 'PDB 4HLA sample annotation',
  },
  notices: ['Demo structure: PDB 4HLA. All five entries reuse the same experimental coordinates; only the illustrative confidence values vary.'],
  isDemo: true,
};

export async function loadDemoResult(): Promise<AF3Result> {
  const response = await fetch(demoCifUrl);
  if (!response.ok) throw new Error('The sample structure could not be loaded.');
  const cif = await response.text();
  return { ...demoResult, predictions: demoResult.predictions.map((prediction) => ({ ...prediction, cif })) };
}
