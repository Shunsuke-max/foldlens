import type { FocusMode } from '../types/af3';
import { Icon } from './Icon';

type Props = {
  mode: FocusMode;
  interfaceLabel?: string;
  interfaceScore?: number | null;
  pocketLabel?: string;
  domainCount?: number;
  domainSource?: 'annotation' | 'pae' | 'mixed';
  onChange: (mode: FocusMode) => void;
};

export function FocusModeControl({ mode, interfaceLabel, interfaceScore, pocketLabel, domainCount = 0, domainSource = 'pae', onChange }: Props) {
  const options: Array<{
    id: FocusMode;
    label: string;
    detail: string;
    icon: 'eye' | 'link' | 'molecule' | 'layers';
    disabled?: boolean;
    title?: string;
  }> = [
    { id: 'all', label: 'All', detail: 'Whole structure', icon: 'eye' },
    {
      id: 'interface',
      label: 'Interface',
      detail: interfaceLabel
        ? `${interfaceLabel}${interfaceScore !== null && interfaceScore !== undefined ? ` · ipTM ${interfaceScore.toFixed(2)}` : ''}`
        : 'No chain pair',
      icon: 'link',
      disabled: !interfaceLabel,
      title: interfaceLabel ? `Focus the most confident chain interface (${interfaceLabel})` : 'This result has fewer than two non-ligand chains.',
    },
    {
      id: 'pocket',
      label: 'Pocket',
      detail: pocketLabel ? `${pocketLabel} · within 5 Å` : 'No ligand found',
      icon: 'molecule',
      disabled: !pocketLabel,
      title: pocketLabel ? `Focus residues within 5 Å of ${pocketLabel}` : 'No ligand or ion was identified in this result.',
    },
    {
      id: 'domains',
      label: 'Domains',
      detail: domainCount ? `${domainCount} regions · ${domainSource === 'annotation' ? 'annotated' : domainSource === 'mixed' ? 'mixed sources' : 'from PAE'}` : 'No regions found',
      icon: 'layers',
      disabled: domainCount === 0,
      title: domainCount ? 'Color and inspect annotated or PAE-derived structural regions' : 'No protein domain annotation or usable PAE regions were found.',
    },
  ];

  return (
    <div className="focus-mode-control" role="group" aria-label="Purpose-based structure view">
      <span>Focus</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={mode === option.id ? 'active' : ''}
          aria-pressed={mode === option.id}
          aria-label={option.id === 'pocket' ? `Ligand pocket · ${option.detail}` : undefined}
          disabled={option.disabled}
          title={option.title}
          onClick={() => onChange(option.id)}
        >
          <Icon name={option.icon} />
          <span><strong>{option.label}</strong><small>{option.detail}</small></span>
        </button>
      ))}
    </div>
  );
}
