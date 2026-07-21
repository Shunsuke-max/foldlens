import type { AF3Summary, ChainInfo } from '../types/af3';
import { groupLigands } from '../lib/focusMode';
import { Icon } from './Icon';

function interpretation(summary: AF3Summary) {
  if (summary.iptm === undefined && summary.ptm === undefined) {
    return 'The structure is ready to inspect. Add the matching summary confidence JSON to see confidence-aware interpretation.';
  }
  const clash = summary.hasClash ? ' Significant steric clashes were reported.' : summary.hasClash === false ? ' No significant clashes were reported.' : '';
  if (summary.iptm === undefined) {
    const foldQuality = summary.ptm! >= 0.8 ? 'High global fold confidence' : summary.ptm! >= 0.5 ? 'Moderate global fold confidence' : 'Low global fold confidence';
    return `${foldQuality}. pTM describes the overall predicted fold; no interface-confidence score was loaded.${clash}`;
  }
  const iptm = summary.iptm;
  const quality = iptm >= 0.8 ? 'High-confidence interface' : iptm >= 0.6 ? 'Mixed-confidence interface' : 'Low-confidence interface';
  const detail = iptm >= 0.8
    ? 'The predicted chain arrangement is well defined. Inspect local PAE before interpreting flexible loops or termini.'
    : iptm >= 0.6
      ? 'The global arrangement is plausible, but some interfaces may move between samples. Compare models and inspect chain-pair PAE.'
      : 'The relative chain placement is uncertain. Treat the interface as a hypothesis and compare samples before drawing conclusions.';
  return `${quality}. ${detail}${clash}`;
}

type Props = {
  summary: AF3Summary;
  chains: ChainInfo[];
  visibleChains: Set<string>;
  onSetChainVisibility: (ids: string[], visible: boolean) => void;
  notices?: string[];
  embedded?: boolean;
};

export function Inspector({ summary, chains, visibleChains, onSetChainVisibility, notices = [], embedded = false }: Props) {
  const structureChains = chains.filter((chain) => chain.kind !== 'ligand');
  const ligandGroups = groupLigands(chains);
  const ligandCount = ligandGroups.reduce((count, ligand) => count + ligand.count, 0);
  const matrix = summary.chainPairPaeMin ?? summary.chainPairIptm;
  const matrixIds = (summary.chainIds ?? structureChains.map((chain) => chain.id)).slice(0, 4);
  const isPae = Boolean(summary.chainPairPaeMin);

  return (
    <div className={`inspector ${embedded ? 'embedded' : ''}`} aria-label="Interpretation and chains">
      <section className="interpretation-section">
        <div className="section-title"><h2>Interpretation</h2><Icon name="info" size={16} /></div>
        <p>{interpretation(summary)}</p>
        {notices.map((notice) => <small className="notice" key={notice}>{notice}</small>)}
      </section>
      <section className="chain-section">
        <div className="section-title"><h2>Chains</h2><span>{structureChains.length}</span></div>
        <div className="chain-list">
          {structureChains.map((chain) => {
            const visible = visibleChains.has(chain.id);
            return (
              <button type="button" className="chain-row" key={chain.id} onClick={() => onSetChainVisibility([chain.id], !visible)} aria-pressed={visible}>
                <Icon name={visible ? 'eye' : 'eyeOff'} />
                <i style={{ '--chain-color': chain.color } as React.CSSProperties}>{chain.id}</i>
                <span><strong>{chain.label}</strong>{chain.range && <small>Residues {chain.range}</small>}</span>
              </button>
            );
          })}
        </div>
      </section>
      {ligandGroups.length > 0 && <section className="ligand-section">
        <div className="section-title"><h2>Ligands</h2><span>{ligandCount}</span></div>
        <div className="chain-list ligand-list">
          {ligandGroups.map((ligand) => {
            const visible = ligand.entityIds.every((id) => visibleChains.has(id));
            return (
              <button type="button" className="chain-row ligand-row" key={ligand.key} onClick={() => onSetChainVisibility(ligand.entityIds, !visible)} aria-pressed={visible}>
                <Icon name={visible ? 'eye' : 'eyeOff'} />
                <i title={ligand.code} style={{ '--chain-color': ligand.color } as React.CSSProperties}>{ligand.code.slice(0, 4)}</i>
                <span><strong>{ligand.label}</strong><small>{ligand.count} {ligand.count === 1 ? 'instance' : 'instances'}</small></span>
              </button>
            );
          })}
        </div>
      </section>}
      <section className="matrix-section">
        <div className="section-title"><h2>{isPae ? 'Chain-pair minimum PAE' : 'Chain-pair ipTM'}</h2><span>{isPae ? 'Å · lower is better' : 'higher is better'}</span></div>
        {matrix && matrixIds.length ? (
          <div className="matrix-wrap">
            <table aria-label={isPae ? 'Chain-pair minimum predicted aligned error matrix' : 'Chain-pair ipTM matrix'}>
              <thead><tr><th /><>{matrixIds.map((id) => <th key={id}>{id}</th>)}</></tr></thead>
              <tbody>
                {matrixIds.map((id, row) => (
                  <tr key={id}><th>{id}</th>{matrixIds.map((_, col) => {
                    const value = matrix[row]?.[col];
                    const normalized = isPae ? 1 - Math.min(1, (value ?? 40) / 40) : Math.min(1, value ?? 0);
                    return <td key={`${row}-${col}`} style={{ '--confidence': normalized } as React.CSSProperties}>{row === col ? '—' : value?.toFixed(2) ?? '—'}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
            <div className="matrix-legend"><span>Lower confidence</span><i /><span>Higher</span></div>
            {isPae && <p className="matrix-note">Minimum PAE is the best local cell. Use the heatmap’s reciprocal median for representative chain-pair interpretation.</p>}
          </div>
        ) : <div className="empty-mini">Add summary confidence JSON to compare chain pairs.</div>}
      </section>
    </div>
  );
}
