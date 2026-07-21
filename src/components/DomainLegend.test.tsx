// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DomainLegend } from './DomainLegend';

afterEach(cleanup);

describe('DomainLegend', () => {
  const domains = [{
    id: 'a-core', label: 'Catalytic domain', chainId: 'A', start: 10, end: 90, source: 'interpro' as const,
    color: '#42bdf5', meanPlddt: 88.2, meanInternalPae: 3.1,
    closestDomainId: 'a-reg', closestDomainLabel: 'Regulatory domain', closestDomainPae: 7.4,
  }];

  it('labels domain evidence and supports isolate and reset interactions', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<DomainLegend domains={domains} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Catalytic domain/ }));
    expect(onSelect).toHaveBeenCalledWith('a-core');

    rerender(<DomainLegend domains={domains} selectedDomainId="a-core" onSelect={onSelect} />);
    expect(screen.getByText('Nearest placement: Regulatory domain · PAE 7.4 Å')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
