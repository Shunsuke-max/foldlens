// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnalysisFacts } from '../lib/analysis';
import { demoResult } from '../lib/demo';
import { AssistantPanel, AssistantSessionProvider } from './AssistantPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AssistantPanel session lifecycle', () => {
  it('discards an old model response after the selected prediction changes', async () => {
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; })));
    const first = demoResult.predictions[0];
    const second = demoResult.predictions[1];
    const firstFacts = buildAnalysisFacts(demoResult, first, null);
    const secondFacts = buildAnalysisFacts(demoResult, second, null);
    const { rerender } = render(
      <AssistantSessionProvider facts={firstFacts} prediction={first}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );

    fireEvent.change(screen.getByLabelText('Ask about this prediction'), { target: { value: 'Inspect model one' } });
    fireEvent.submit(screen.getByLabelText('Ask about this prediction').closest('form')!);
    rerender(
      <AssistantSessionProvider facts={secondFacts} prediction={second}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );

    await act(async () => {
      resolveFetch(new Response(JSON.stringify({
        data: { answer: 'STALE MODEL ONE ANSWER', evidence: [], caveats: [] },
        source: 'live', model: 'gpt-5.6-sol', fallbackReason: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByText('STALE MODEL ONE ANSWER')).toBeNull());
    expect(screen.getByText('offline confidence brief')).toBeTruthy();
  });

  it('preserves the answer when evidence updates selection in the same model', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { answer: 'LIVE GROUNDED ANSWER', evidence: [], caveats: [] },
      source: 'live', model: 'gpt-5.6-sol', fallbackReason: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const prediction = demoResult.predictions[0];
    const initialFacts = buildAnalysisFacts(demoResult, prediction, null);
    const selectedFacts = buildAnalysisFacts(demoResult, prediction, { xStart: 0, xEnd: 5, yStart: 128, yEnd: 130 });
    const { rerender } = render(
      <AssistantSessionProvider facts={initialFacts} prediction={prediction}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );
    fireEvent.change(screen.getByLabelText('Ask about this prediction'), { target: { value: 'Inspect this model' } });
    fireEvent.submit(screen.getByLabelText('Ask about this prediction').closest('form')!);
    await screen.findByText('LIVE GROUNDED ANSWER');
    rerender(
      <AssistantSessionProvider facts={selectedFacts} prediction={prediction}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );
    expect(screen.getByText('LIVE GROUNDED ANSWER')).toBeTruthy();
  });
});
