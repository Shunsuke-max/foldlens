import { describe, expect, it } from 'vitest';
import { ligandFocusFromChains } from './focusMode';

describe('purpose-based focus modes', () => {
  it('extracts chain and CCD identifiers for a ligand pocket', () => {
    expect(ligandFocusFromChains([
      { id: 'A', label: 'Protein · Chain A', kind: 'protein', color: '#fff' },
      { id: 'L', label: 'Ligand · ATP, MG', kind: 'ligand', color: '#aaa' },
    ])).toEqual({ chainIds: ['L'], residueNames: ['ATP', 'MG'], label: 'ATP, MG' });
  });

  it('keeps a chain-only custom ligand focusable without inventing a residue name', () => {
    expect(ligandFocusFromChains([
      { id: 'X', label: 'Ligand · Chain X', kind: 'ligand', color: '#aaa' },
    ])).toEqual({ chainIds: ['X'], residueNames: [], label: 'Ligand · Chain X' });
  });
});
