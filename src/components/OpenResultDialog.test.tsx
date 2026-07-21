// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoResult } from '../lib/demo';
import { OpenResultDialog } from './OpenResultDialog';

afterEach(cleanup);

describe('OpenResultDialog', () => {
  it('shows a validated import manifest before opening predictions', () => {
    const confirm = vi.fn();
    render(<OpenResultDialog open busy={false} preview={demoResult} onClose={vi.fn()} onFiles={vi.fn()} onConfirm={confirm} onBack={vi.fn()} />);
    expect(screen.getByText('Ready to open')).toBeTruthy();
    expect(screen.getByText('1 ligand')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open 5 predictions' }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('closes with Escape when idle', () => {
    const close = vi.fn();
    render(<OpenResultDialog open busy={false} onClose={close} onFiles={vi.fn()} onConfirm={vi.fn()} onBack={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
});
