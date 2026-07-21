import type { AF3Summary } from '../types/af3';
import { confidenceLabel } from '../lib/confidence';

const metric = (value?: number) => value === undefined ? '—' : value.toFixed(2);

export function ScoreStrip({ summary, compact = false }: { summary: AF3Summary; compact?: boolean }) {
  const items = [
    { label: 'Ranking', value: metric(summary.rankingScore), tone: 'cyan', status: summary.rankingScore === undefined ? 'Not available' : 'Relative score' },
    { label: 'Global ipTM', value: metric(summary.iptm), tone: 'lime', status: confidenceLabel(summary.iptm) },
    { label: 'Global pTM', value: metric(summary.ptm), tone: 'cyan', status: confidenceLabel(summary.ptm) },
    { label: 'Clashes', value: summary.hasClash === undefined ? '—' : summary.hasClash ? 'Detected' : 'None', tone: summary.hasClash ? 'error' : 'lime', status: summary.hasClash === undefined ? 'Not checked' : summary.hasClash ? 'Review' : 'Clear' },
  ];
  return (
    <div className={`score-strip ${compact ? 'compact' : ''}`} aria-label="Prediction confidence summary">
      {items.map((item) => (
        <div className="score-item" key={item.label} aria-label={`${item.label}: ${item.value}, ${item.status}`}>
          <span>{item.label}</span>
          <div className="score-value"><strong className={item.tone}>{item.value}</strong><small className={`status-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>{item.status}</small></div>
        </div>
      ))}
    </div>
  );
}
