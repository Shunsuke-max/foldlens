// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { confidenceLabel } from '../lib/confidence';
import { ScoreStrip } from './ScoreStrip';

afterEach(cleanup);

describe('ScoreStrip confidence labels', () => {
  it('maps confidence values to visible semantic labels', () => {
    expect(confidenceLabel(0.85)).toBe('High');
    expect(confidenceLabel(0.7)).toBe('Mixed');
    expect(confidenceLabel(0.4)).toBe('Low');
    render(<ScoreStrip summary={{ rankingScore: 0.91, iptm: 0.85, ptm: 0.7, hasClash: false }} />);
    expect(screen.getByLabelText('Global ipTM: 0.85, High')).toBeTruthy();
    expect(screen.getByLabelText('Global pTM: 0.70, Mixed')).toBeTruthy();
    expect(screen.getByLabelText('Clashes: None, Clear')).toBeTruthy();
  });
});
