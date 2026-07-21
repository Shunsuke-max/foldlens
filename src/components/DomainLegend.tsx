import { useEffect, useRef } from 'react';
import type { DomainRegion } from '../types/af3';

type Props = {
  domains: DomainRegion[];
  selectedDomainId?: string;
  onSelect: (domainId?: string) => void;
};

const sourceLabel = (domain: DomainRegion) => domain.source === 'pae' ? 'PAE-predicted region' : domain.source === 'interpro' ? 'InterPro annotation' : 'Provided annotation';

export function DomainLegend({ domains, selectedDomainId, onSelect }: Props) {
  const selected = domains.find((domain) => domain.id === selectedDomainId);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (typeof activeRef.current?.scrollIntoView === 'function') {
      activeRef.current.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }, [selectedDomainId]);
  return (
    <section className="domain-legend" aria-label="Domain map">
      <div className="domain-legend-heading">
        <span><i />Domain map</span>
        {selected ? <button type="button" onClick={() => onSelect(undefined)}>Show all</button> : <small>Select to isolate</small>}
      </div>
      <div className="domain-legend-list">
        {domains.map((domain) => (
          <button
            type="button"
            key={domain.id}
            ref={selectedDomainId === domain.id ? activeRef : undefined}
            className={selectedDomainId === domain.id ? 'active' : ''}
            aria-pressed={selectedDomainId === domain.id}
            onClick={() => onSelect(selectedDomainId === domain.id ? undefined : domain.id)}
          >
            <i style={{ '--domain-color': domain.color } as React.CSSProperties} />
            <span><strong>{domain.label}</strong><small>{domain.chainId} {domain.start}–{domain.end} · {sourceLabel(domain)}</small></span>
            <b>{domain.meanPlddt === null ? 'pLDDT —' : `pLDDT ${Math.round(domain.meanPlddt)}`}</b>
          </button>
        ))}
      </div>
      <p>
        {selected?.closestDomainPae !== null && selected?.closestDomainPae !== undefined && selected.closestDomainLabel
          ? `Nearest placement: ${selected.closestDomainLabel} · PAE ${selected.closestDomainPae.toFixed(1)} Å`
          : domains.some((domain) => domain.source === 'pae')
            ? 'PAE regions describe structural coherence, not biological function.'
            : 'Named boundaries come from the loaded annotation.'}
      </p>
    </section>
  );
}
