import { describe, expect, it } from 'vitest';
import { groupLigands, ligandFocusFromChains } from './focusMode';

describe('purpose-based focus modes', () => {
  it('extracts chain and CCD identifiers for a ligand pocket', () => {
    expect(ligandFocusFromChains([
      { id: 'A', label: 'Protein · Chain A', kind: 'protein', color: '#fff' },
      { id: 'L', label: 'Ligand · ATP, MG', kind: 'ligand', color: '#aaa' },
    ])).toEqual({ chainIds: ['L'], structureChainIds: [], residueNames: ['ATP', 'MG'], label: 'ATP, MG' });
  });

  it('keeps a chain-only custom ligand focusable without inventing a residue name', () => {
    expect(ligandFocusFromChains([
      { id: 'X', label: 'Ligand · Chain X', kind: 'ligand', color: '#aaa' },
    ])).toEqual({ chainIds: ['X'], structureChainIds: ['X'], residueNames: [], label: 'Ligand · Chain X' });
  });

  it('groups equivalent ligand copies for one visibility row', () => {
    expect(groupLigands([
      { id: 'L1', label: 'Ligand · HEM', kind: 'ligand', color: '#aaa', ligandCodes: ['HEM'] },
      { id: 'L2', label: 'Ligand · HEM', kind: 'ligand', color: '#bbb', ligandCodes: ['HEM'], instanceCount: 3 },
    ])).toEqual([expect.objectContaining({ code: 'HEM', entityIds: ['L1', 'L2'], count: 4 })]);
  });
});
