import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { buildLocalAssistantResponse } from '../lib/analysis';
import type { FocusMode, Prediction } from '../types/af3';
import type { AnalysisFacts, AssistantEnvelope, AssistantResponse, EvidenceAction } from '../types/analysis';
import { Icon } from './Icon';

type Props = {
  facts: AnalysisFacts;
  prediction: Prediction;
  focusMode?: FocusMode;
  onAction: (action: EvidenceAction) => void;
};

function questionFor(facts: AnalysisFacts, focusMode: FocusMode) {
  if (focusMode === 'domains' && facts.domains.length) return 'Which domain should I inspect first?';
  const pair = facts.primaryInterface;
  return pair ? `Is the ${pair.chainA}–${pair.chainB} interface reliable?` : 'What should I inspect first?';
}

export function AssistantPanel({ facts, prediction, focusMode = 'all', onAction }: Props) {
  const defaultQuestion = useMemo(() => questionFor(facts, focusMode), [facts, focusMode]);
  const localPreview = useMemo(() => buildLocalAssistantResponse(facts, prediction, defaultQuestion), [defaultQuestion, facts, prediction]);
  const [question, setQuestion] = useState(defaultQuestion);
  const [askedQuestion, setAskedQuestion] = useState(defaultQuestion);
  const [answer, setAnswer] = useState<AssistantResponse>(localPreview);
  const [source, setSource] = useState<'live' | 'local'>('local');
  const [model, setModel] = useState('deterministic metrics');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    setQuestion(defaultQuestion);
    setAskedQuestion(defaultQuestion);
    setAnswer(localPreview);
    setSource('local');
    setModel('deterministic metrics');
    setStatus(undefined);
  }, [defaultQuestion, localPreview]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [answer, askedQuestion]);

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (nextQuestion.length < 3 || busy) return;
    setBusy(true);
    setAskedQuestion(nextQuestion);
    setStatus(undefined);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nextQuestion, facts }),
      });
      const payload = await response.json() as AssistantEnvelope | { message?: string };
      if (!response.ok || !('data' in payload)) throw new Error('message' in payload ? payload.message : 'Analysis request failed');
      setAnswer(payload.data);
      setSource(payload.source);
      setModel(payload.model);
      setStatus(payload.fallbackReason ? 'Live explanation is unavailable. This answer was computed only from the loaded confidence metrics.' : undefined);
    } catch {
      setAnswer(buildLocalAssistantResponse(facts, prediction, nextQuestion));
      setSource('local');
      setModel('deterministic metrics');
      setStatus('Live explanation is unavailable. This answer was computed only from the loaded confidence metrics.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-scroll" ref={scrollRef}>
        <div className="assistant-question">
          <span>You asked</span>
          <p>{askedQuestion}</p>
        </div>
        <div className="assistant-answer">
          <div className="assistant-byline"><span>FoldLens</span><small>{source === 'live' ? model : 'offline confidence brief'}</small></div>
          <h2>{answer.answer}</h2>
        </div>
        <section className="evidence-section" aria-label="Evidence used in this answer">
          <h3>Evidence</h3>
          <div className="evidence-list">
            {answer.evidence.map((item) => (
              <button key={item.id} type="button" onClick={() => onAction(item.action)} disabled={item.action.type === 'none'}>
                <span>{item.label}</span><strong>{item.value}</strong><small>{item.interpretation}</small>
              </button>
            ))}
          </div>
        </section>
        <div className="evidence-actions">
          {(['show_interface', 'show_residues', 'show_selection'] as const).map((type) => answer.evidence.find((item) => item.action.type === type)).filter((item) => item !== undefined).slice(0, 2).map((item) => (
            <button type="button" key={`action-${item.id}`} onClick={() => onAction(item.action)}>
              <Icon name={item.action.type === 'show_interface' ? 'expand' : 'link'} size={16} />
              {item.action.type === 'show_interface' ? 'Show interface' : `Show ${item.value.split(' · ')[0]}`}
            </button>
          ))}
        </div>
        <div className="assistant-caveats">
          <span>Caveat</span>
          {answer.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
        </div>
        {status && <p className="assistant-status" role="status" aria-live="polite">{status}</p>}
      </div>
      <form className="assistant-composer" onSubmit={ask}>
        <label className="sr-only" htmlFor={inputId}>Ask about this prediction</label>
        <input id={inputId} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this prediction…" maxLength={400} />
        <button type="submit" aria-label="Ask FoldLens" disabled={busy || question.trim().length < 3}>
          {busy ? <span className="composer-spinner" /> : <span aria-hidden="true">↗</span>}
        </button>
      </form>
    </div>
  );
}
