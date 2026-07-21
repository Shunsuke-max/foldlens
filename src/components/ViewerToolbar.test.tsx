// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewerToolbar } from './ViewerToolbar';

afterEach(cleanup);

describe('ViewerToolbar', () => {
  it('keeps color buttons visible but unselected during Surface only', () => {
    const props = {
      colorMode: 'chains' as const,
      surface: true,
      surfaceOnly: true,
      onColorMode: vi.fn(),
      onSurface: vi.fn(),
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
    render(<ViewerToolbar colorMode="chains" surface={false} colorModeSuppressed onColorMode={vi.fn()} onSurface={vi.fn()} onReset={vi.fn()} onExpand={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Chains' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Confidence' }).getAttribute('aria-pressed')).toBe('false');
  });
});
