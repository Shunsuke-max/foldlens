// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewerToolbar } from './ViewerToolbar';

afterEach(cleanup);

describe('ViewerToolbar', () => {
  it('keeps color buttons visible but unselected during Surface only', () => {
    const props = {
      colorMode: 'chains' as const,
      surface: true,
      surfaceOnly: true,
      brightness: 100,
      onColorMode: vi.fn(),
      onSurface: vi.fn(),
      onBrightness: vi.fn(),
      onReset: vi.fn(),
      onExpand: vi.fn(),
    };
    const { rerender } = render(<ViewerToolbar {...props} />);

    expect(screen.getByRole('button', { name: 'Chains' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Confidence' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Surface' }).getAttribute('aria-pressed')).toBe('true');

    rerender(<ViewerToolbar {...props} surfaceOnly={false} />);

    expect(screen.getByRole('button', { name: 'Chains' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows categorical domain coloring as separate from chain and confidence colors', () => {
    render(<ViewerToolbar colorMode="chains" surface={false} colorModeSuppressed brightness={100} onColorMode={vi.fn()} onSurface={vi.fn()} onBrightness={vi.fn()} onReset={vi.fn()} onExpand={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Chains' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Confidence' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeTruthy();
  });

  it('lets the user adjust and reset structure brightness', () => {
    const onBrightness = vi.fn();
    render(<ViewerToolbar colorMode="chains" surface={false} brightness={115} onColorMode={vi.fn()} onSurface={vi.fn()} onBrightness={onBrightness} onReset={vi.fn()} onExpand={vi.fn()} />);

    fireEvent.change(screen.getByRole('slider', { name: 'Structure brightness' }), { target: { value: '200' } });
    expect(onBrightness).toHaveBeenCalledWith(200);

    fireEvent.click(screen.getByRole('button', { name: 'Set structure brightness to 200%' }));
    expect(onBrightness).toHaveBeenLastCalledWith(200);

    fireEvent.click(screen.getByRole('button', { name: 'Reset brightness' }));
    expect(onBrightness).toHaveBeenCalledWith(100);
  });
});
