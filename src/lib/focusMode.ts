import type { ChainInfo } from '../types/af3';

export type LigandFocus = {
  /** Logical FoldLens entity ids used by visibility controls. */
  chainIds: string[];
  /** Chain ids present in the coordinate model. */
  structureChainIds: string[];
  residueNames: string[];
  label?: string;
};

export type LigandGroup = {
  key: string;
  label: string;
  code: string;
  entityIds: string[];
  count: number;
  color: string;
};

function descriptionFromLabel(label: string) {
  return label.split('·').slice(1).join('·').trim();
}

function codesFor(chain: ChainInfo) {
  if (chain.ligandCodes?.length) return chain.ligandCodes;
  const description = descriptionFromLabel(chain.label);
  if (!description || /^chain\s+/i.test(description) || /custom ligand/i.test(description)) return [];
  return description.split(',').map((value) => value.trim()).filter((value) => /^[A-Za-z0-9]{1,8}$/.test(value));
}

export function ligandFocusFromChains(chains: ChainInfo[]): LigandFocus {
  const ligands = chains.filter((chain) => chain.kind === 'ligand');
  const residueNames = [...new Set(ligands.flatMap(codesFor))];
  const descriptions = [...new Set(ligands.map((chain) => descriptionFromLabel(chain.label)).filter(Boolean))];
  const namedDescriptions = descriptions.filter((description) => !/^chain\s+/i.test(description));
  const label = namedDescriptions.length > 1 ? `${namedDescriptions[0]} +${namedDescriptions.length - 1}` : namedDescriptions[0] ?? ligands[0]?.label;
  return {
    chainIds: ligands.map((chain) => chain.id),
    structureChainIds: [...new Set(ligands.flatMap((chain) => codesFor(chain).length ? [] : (chain.sourceChainIds ?? [chain.id])))],
    residueNames,
    label,
  };
}

export function groupLigands(chains: ChainInfo[]): LigandGroup[] {
  const groups = new Map<string, LigandGroup>();
  chains.filter((chain) => chain.kind === 'ligand').forEach((chain) => {
    const codes = codesFor(chain);
    const key = codes.length ? codes.map((code) => code.toUpperCase()).sort().join(',') : chain.label;
    const existing = groups.get(key);
    if (existing) {
      existing.entityIds.push(chain.id);
      existing.count += chain.instanceCount ?? 1;
      return;
    }
    groups.set(key, {
      key,
      label: chain.label,
      code: codes.join('/') || chain.id,
      entityIds: [chain.id],
      count: chain.instanceCount ?? 1,
      color: chain.color,
    });
  });
  return [...groups.values()];
}
