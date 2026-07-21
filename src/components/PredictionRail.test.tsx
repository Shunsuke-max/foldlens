// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prediction } from '../types/af3';
import { PredictionRail } from './PredictionRail';

afterEach(cleanup);

describe('PredictionRail', () => {
  it('shows the source model filename for numbered AlphaFold Server predictions', () => {
    const prediction: Prediction = {
      id: 'model-0',
      label: 'Model 1',
      path: 'job/fold_example_model_0.cif',
      cif: 'data_model',
      summary: { rankingScore: 0.9 },
    };

    render(<PredictionRail predictions={[prediction]} selectedId={prediction.id} onSelect={vi.fn()} onOpen={vi.fn()} />);

    expect(screen.getByText('model_0.cif')).toBeTruthy();
    expect(screen.getByTitle(prediction.path)).toBeTruthy();
  });
});
