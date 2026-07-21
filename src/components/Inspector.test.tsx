// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Inspector } from './Inspector';

afterEach(cleanup);

describe('Inspector interpretation', () => {
  it('describes pTM-only monomers without inventing an interface assessment', () => {
    render(<Inspector summary={{ ptm: 0.9 }} chains={[{ id: 'A', label: 'Protein A', kind: 'protein', color: '#fff' }]} visibleChains={new Set(['A'])} onToggleChain={() => undefined} />);
    expect(screen.getByText(/High global fold confidence/)).toBeTruthy();
    expect(screen.queryByText(/Low-confidence interface/)).toBeNull();
  });
});
