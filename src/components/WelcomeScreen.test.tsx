// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from './WelcomeScreen';

afterEach(cleanup);

describe('WelcomeScreen', () => {
  it('starts from local AF3 inputs and keeps the sample explicit', () => {
    const onFiles = vi.fn();
    const onDemo = vi.fn();
    render(<WelcomeScreen
      demoBusy={false}
      recentSession={null}
      resumeBusy={false}
      onFiles={onFiles}
      onDemo={onDemo}
      onResume={vi.fn()}
      onForgetRecent={vi.fn()}
    />);

    expect(screen.getByRole('heading', { name: 'Open an AlphaFold 3 result' })).toBeTruthy();
    const file = new File(['data_demo'], 'prediction.cif', { type: 'chemical/x-cif' });
    fireEvent.change(screen.getByLabelText('Select AlphaFold 3 ZIP or files'), { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);

    fireEvent.click(screen.getByRole('button', { name: 'Explore sample result' }));
    expect(onDemo).toHaveBeenCalledOnce();
  });

  it('offers the previous local analysis without hiding the open flow', () => {
    const onResume = vi.fn();
    const onForgetRecent = vi.fn();
    render(<WelcomeScreen
      demoBusy={false}
      recentSession={{ jobName: 'My AF3 run', sourceName: 'result.zip', predictionCount: 5, savedAt: '2026-07-22T00:00:00.000Z' }}
      resumeBusy={false}
      onFiles={vi.fn()}
      onDemo={vi.fn()}
      onResume={onResume}
      onForgetRecent={onForgetRecent}
    />);

    expect(screen.getByRole('heading', { name: 'My AF3 run' })).toBeTruthy();
    expect(screen.getByText((_, element) => (
      element?.tagName === 'P' && element.textContent?.includes('5 predictions') === true
    ))).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Open an AlphaFold 3 result' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Continue analysis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onForgetRecent).toHaveBeenCalledOnce();
  });
});
