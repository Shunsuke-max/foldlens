import type { ChainInfo } from '../types/af3';

export type LigandFocus = {
  chainIds: string[];
  residueNames: string[];
  label?: string;
};

export function ligandFocusFromChains(chains: ChainInfo[]): LigandFocus {
  const ligands = chains.filter((chain) => chain.kind === 'ligand');
  const residueNames = ligands.flatMap((chain) => {
    const description = chain.label.split('·').slice(1).join('·').trim();
    if (!description || /^chain\s+/i.test(description) || /custom ligand/i.test(description)) return [];
    return description.split(',').map((value) => value.trim()).filter((value) => /^[A-Za-z0-9]{1,8}$/.test(value));
  });
  const firstDescription = ligands[0]?.label.split('·').slice(1).join('·').trim();
  const label = firstDescription && !/^chain\s+/i.test(firstDescription) ? firstDescription : ligands[0]?.label;
  return { chainIds: ligands.map((chain) => chain.id), residueNames: [...new Set(residueNames)], label };
}
