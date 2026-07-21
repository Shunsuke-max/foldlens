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
  it('starts with transparent measured facts, live structure context, and discussion starters', () => {
    const prediction = demoResult.predictions[0];
    render(
      <AssistantSessionProvider facts={buildAnalysisFacts(demoResult, prediction, null)} prediction={prediction}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );

    expect(screen.getByText('Metric baseline')).toBeTruthy();
    expect(screen.getByText('before GPT-5.6')).toBeTruthy();
    expect(screen.queryByText('You asked')).toBeNull();
    expect(screen.getByText('Live structure context')).toBeTruthy();
    expect(screen.getByText(prediction.label)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show interface' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show S 612–626' })).toBeTruthy();
    expect((screen.getByLabelText('Ask about this prediction') as HTMLTextAreaElement).value).toBe('');
    expect(screen.getByRole('button', { name: 'Ask FoldLens' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Ask FoldLens' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'What should I inspect first?' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Which region has the lowest confidence?' })).toBeTruthy();
  });

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
        data: {
          answer: 'STALE MODEL ONE ANSWER', evidence: [], alternative: 'Stale alternative',
          falsification: 'Stale falsification', nextQuestions: ['Stale follow-up'], caveats: [],
        },
        source: 'live', model: 'gpt-5.6-sol', fallbackReason: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.queryByText('STALE MODEL ONE ANSWER')).toBeNull());
    expect(screen.getByText('Metric baseline')).toBeTruthy();
    expect(screen.getByText('before GPT-5.6')).toBeTruthy();
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
    expect(screen.getByText(`PAE ${selectedFacts.selection!.label}`)).toBeTruthy();
  });

  it('sends prior conclusions as bounded discussion history for follow-up questions', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      data: {
        answer: 'GROUNDED CONCLUSION', evidence: [], alternative: 'A grounded alternative',
        falsification: 'A grounded falsification condition', nextQuestions: ['Ask the second grounded question'], caveats: ['Confidence is not validation.'],
      },
      source: 'live', model: 'gpt-5.6-sol', fallbackReason: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const prediction = demoResult.predictions[0];
    render(
      <AssistantSessionProvider facts={buildAnalysisFacts(demoResult, prediction, null)} prediction={prediction} focusMode="interface">
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );

    fireEvent.change(screen.getByLabelText('Ask about this prediction'), { target: { value: 'Ask the first grounded question' } });
    fireEvent.submit(screen.getByLabelText('Ask about this prediction').closest('form')!);
    await screen.findByText('GROUNDED CONCLUSION');
    fireEvent.click(screen.getByRole('button', { name: 'Ask the second grounded question' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const secondCall = fetchMock.mock.calls[1] as unknown as [RequestInfo | URL, RequestInit];
    const secondRequest = JSON.parse(String(secondCall[1].body));
    expect(secondRequest.history).toHaveLength(2);
    expect(secondRequest.history[0]).toEqual({ role: 'user', content: 'Ask the first grounded question' });
    expect(secondRequest.history[1].role).toBe('assistant');
    expect(secondRequest.viewContext.focusMode).toBe('interface');
  });

  it('lets the user cancel a slow analysis and restores the interrupted question', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    const prediction = demoResult.predictions[0];
    render(
      <AssistantSessionProvider facts={buildAnalysisFacts(demoResult, prediction, null)} prediction={prediction}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );

    const input = screen.getByLabelText('Ask about this prediction');
    fireEvent.change(input, { target: { value: 'Inspect the slow request' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel analysis' }));

    expect((screen.getByLabelText('Ask about this prediction') as HTMLTextAreaElement).value).toBe('Inspect the slow request');
    expect(screen.getByRole('button', { name: 'Ask FoldLens' })).toBeTruthy();
    expect(screen.queryByText('Testing the question against the attached evidence…')).toBeNull();
  });

  it('offers a retry after a safe local fallback', async () => {
    const prediction = demoResult.predictions[0];
    const facts = buildAnalysisFacts(demoResult, prediction, null);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { answer: 'LOCAL FALLBACK', evidence: [], caveats: [] },
        source: 'local', model: 'gpt-5.6-sol', fallbackReason: 'Live analysis is temporarily rate limited',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { answer: 'LIVE RETRY', evidence: [], caveats: [] },
        source: 'live', model: 'gpt-5.6-sol', fallbackReason: null,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AssistantSessionProvider facts={facts} prediction={prediction}>
        <AssistantPanel onAction={() => undefined} />
      </AssistantSessionProvider>,
    );

    const input = screen.getByLabelText('Ask about this prediction');
    fireEvent.change(input, { target: { value: 'Inspect and retry this model' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry live analysis' }));

    await screen.findByText('LIVE RETRY');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
