import type { Prediction } from '../types/af3';
import type { SelectionFact } from '../types/analysis';

const value = (number?: number) => number === undefined ? '—' : number.toFixed(2);
const delta = (primary?: number, comparison?: number) => primary === undefined || comparison === undefined ? '—' : `${comparison - primary >= 0 ? '+' : ''}${(comparison - primary).toFixed(2)}`;

export function ComparisonSummary({ primary, comparison, primarySelection, comparisonSelection, onClose }: { primary: Prediction; comparison: Prediction; primarySelection?: SelectionFact | null; comparisonSelection?: SelectionFact | null; onClose: () => void }) {
  return <section className="comparison-summary" aria-label={`Comparing ${primary.label} with ${comparison.label}`}>
    <div><span>Coordinate-frame overlay</span><strong>{primary.label} <b>vs</b> {comparison.label}</strong></div>
    <dl>
      <div><dt>Ranking</dt><dd>{value(comparison.summary.rankingScore)} <small>{delta(primary.summary.rankingScore, comparison.summary.rankingScore)}</small></dd></div>
      <div><dt>Global ipTM</dt><dd>{value(comparison.summary.iptm)} <small>{delta(primary.summary.iptm, comparison.summary.iptm)}</small></dd></div>
      <div><dt>Global pTM</dt><dd>{value(comparison.summary.ptm)} <small>{delta(primary.summary.ptm, comparison.summary.ptm)}</small></dd></div>
      {primarySelection?.medianPae !== null && primarySelection?.medianPae !== undefined && comparisonSelection?.medianPae !== null && comparisonSelection?.medianPae !== undefined && <div><dt>Selected median PAE</dt><dd>{comparisonSelection.medianPae.toFixed(1)} Å <small>{delta(primarySelection.medianPae, comparisonSelection.medianPae)} Å</small></dd></div>}
    </dl>
    <button type="button" onClick={onClose}>Clear overlay</button>
  </section>;
}
