import type { Prediction } from '../types/af3';
import { Icon } from './Icon';

type Props = {
  predictions: Prediction[];
  selectedId: string;
  compareId?: string;
  onSelect: (id: string) => void;
  onCompare?: (id?: string) => void;
  onOpen: () => void;
};

function score(prediction: Prediction) {
  const value = prediction.summary.rankingScore;
  return value === undefined ? '—' : value.toFixed(2);
}

function sourceLabel(prediction: Prediction) {
  if (prediction.seed) return `seed ${prediction.seed} · sample ${prediction.sample ?? '—'}`;
  const filename = prediction.path.split('/').at(-1) ?? prediction.path;
  return filename.match(/(?:^|_)(model(?:[_-]\d+)?\.(?:cif|mmcif))$/i)?.[1] ?? filename;
}

export function PredictionRail({ predictions, selectedId, compareId, onSelect, onCompare, onOpen }: Props) {
  return (
    <aside className="prediction-rail" aria-label="Predictions">
      <h2>Predictions</h2>
      <div className="prediction-list">
        {predictions.map((prediction, index) => <div className={`prediction-row-group ${selectedId === prediction.id ? 'selected' : ''} ${compareId === prediction.id ? 'comparing' : ''}`} key={prediction.id}>
          <button className="prediction-row" type="button" onClick={() => onSelect(prediction.id)} aria-current={selectedId === prediction.id ? 'true' : undefined}>
            <span className="prediction-index">{index + 1}</span>
            <span className="prediction-name"><strong>{prediction.label}</strong><small title={prediction.path}>{sourceLabel(prediction)}</small></span>
            <span className="prediction-score">{score(prediction)}</span>
          </button>
          {predictions.length > 1 && prediction.id !== selectedId && onCompare && <button className="compare-toggle" type="button" aria-pressed={compareId === prediction.id} aria-label={`${compareId === prediction.id ? 'Stop comparing' : 'Compare with'} ${prediction.label}`} onClick={() => onCompare(compareId === prediction.id ? undefined : prediction.id)}><Icon name="layers" size={15} /></button>}
        </div>)}
      </div>
      <button className="drop-target" type="button" onClick={onOpen}>
        <Icon name="folder" size={29} />
        <span><strong>Open AlphaFold 3 result</strong><small>ZIP, folder, CIF, or JSON</small></span>
      </button>
    </aside>
  );
}
