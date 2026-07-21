// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WelcomeScreen } from './WelcomeScreen';

afterEach(cleanup);

describe('WelcomeScreen', () => {
  it('starts from local AF3 inputs and keeps the sample explicit', () => {
    const onFiles = vi.fn();
    const onDemo = vi.fn();
    render(<WelcomeScreen demoBusy={false} onFiles={onFiles} onDemo={onDemo} />);

    expect(screen.getByRole('heading', { name: 'Open an AlphaFold 3 result' })).toBeTruthy();
    const file = new File(['data_demo'], 'prediction.cif', { type: 'chemical/x-cif' });
    fireEvent.change(screen.getByLabelText('Select AlphaFold 3 ZIP or files'), { target: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);

    fireEvent.click(screen.getByRole('button', { name: 'Explore sample result' }));
    expect(onDemo).toHaveBeenCalledOnce();
  });
});
