// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';

afterEach(cleanup);

describe('AppHeader menu', () => {
  it('returns keyboard focus to the trigger when Escape closes the menu', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callback(0); return 1; });
    render(<AppHeader jobName="Test" onHome={() => undefined} onOpen={() => undefined} onExportReport={() => undefined} onSaveSession={() => undefined} />);
    const trigger = screen.getByRole('button', { name: 'More options' });
    fireEvent.click(trigger);
    const menuItem = screen.getByRole('menuitem', { name: /Open result/ });
    menuItem.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('offers a direct and overflow route back to the home screen', () => {
    const onHome = vi.fn();
    render(<AppHeader jobName="Test" onHome={onHome} onOpen={() => undefined} onExportReport={() => undefined} onSaveSession={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to FoldLens home' }));
    expect(onHome).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to home' }));
    expect(onHome).toHaveBeenCalledTimes(2);
  });
});
