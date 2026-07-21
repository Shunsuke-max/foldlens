// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Inspector } from './Inspector';

afterEach(cleanup);

describe('Inspector interpretation', () => {
  it('describes pTM-only monomers without inventing an interface assessment', () => {
    render(<Inspector summary={{ ptm: 0.9 }} chains={[{ id: 'A', label: 'Protein A', kind: 'protein', color: '#fff' }]} visibleChains={new Set(['A'])} onSetChainVisibility={() => undefined} />);
    expect(screen.getByText(/High global fold confidence/)).toBeTruthy();
    expect(screen.queryByText(/Low-confidence interface/)).toBeNull();
  });

  it('separates and groups ligands from polymer chains', () => {
    const setVisibility = vi.fn();
    render(<Inspector
      summary={{}}
      chains={[
        { id: 'A', label: 'Protein · Chain A', kind: 'protein', color: '#fff' },
        { id: 'heme', label: 'Ligand · HEM', kind: 'ligand', color: '#f0b455', ligandCodes: ['HEM'], instanceCount: 4 },
      ]}
      visibleChains={new Set(['A', 'heme'])}
      onSetChainVisibility={setVisibility}
    />);
    expect(screen.getByRole('heading', { name: 'Ligands' })).toBeTruthy();
    expect(screen.getByText('4 instances')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Ligand · HEM/ }));
    expect(setVisibility).toHaveBeenCalledWith(['heme'], false);
  });
});
