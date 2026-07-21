// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusModeControl } from './FocusModeControl';

afterEach(cleanup);

describe('FocusModeControl', () => {
  it('shows evidence in purpose-based options and selects an available mode', () => {
    const onChange = vi.fn();
    render(<FocusModeControl mode="all" interfaceLabel="A–B" interfaceScore={0.84} pocketLabel="ATP" domainCount={3} domainSource="mixed" onChange={onChange} />);

    expect(screen.getByText('A–B · ipTM 0.84')).toBeTruthy();
    expect(screen.getByText('ATP · within 5 Å')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Interface/ }));
    expect(onChange).toHaveBeenCalledWith('interface');
    fireEvent.click(screen.getByRole('button', { name: /Domains/ }));
    expect(onChange).toHaveBeenCalledWith('domains');
    expect(screen.getByText('3 regions · mixed sources')).toBeTruthy();
  });

  it('explains unavailable modes instead of offering empty views', () => {
    render(<FocusModeControl mode="all" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Interface/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Ligand pocket/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Domains/ }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText('No ligand found')).toBeTruthy();
  });
});
