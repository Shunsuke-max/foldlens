import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildLocalAssistantResponse } from '../lib/analysis';
import { isGroundedEvidenceAction, normalizeAssistantResponse } from '../lib/analysisSchema';
import type { FocusMode, Prediction } from '../types/af3';
import type { AnalysisFacts, AssistantEnvelope, AssistantHistoryItem, AssistantResponse, EvidenceAction } from '../types/analysis';
import { Icon } from './Icon';

type Props = {
  onAction: (action: EvidenceAction) => void;
};

type SessionProps = {
  facts: AnalysisFacts;
  prediction: Prediction;
  focusMode?: FocusMode;
  comparisonLabel?: string;
  children: ReactNode;
};

type AssistantTurn = {
  id: number;
  question: string;
  response: AssistantResponse;
  source: 'live' | 'local';
  model: string;
  notice?: string;
};

type AssistantSession = {
  question: string;
  setQuestion: (question: string) => void;
  turns: AssistantTurn[];
  pendingQuestion?: string;
  baseline: AssistantResponse;
  facts: AnalysisFacts;
  contextItems: string[];
  busy: boolean;
  submitQuestion: (question: string) => Promise<void>;
  cancelRequest: () => void;
};

const AssistantSessionContext = createContext<AssistantSession | null>(null);
const CLIENT_ANALYSIS_TIMEOUT_MS = 15_000;

function fallbackNotice(reason?: string | null) {
  return `${reason ? `${reason}. ` : ''}This turn was computed only from the loaded confidence metrics.`;
}

function questionFor(facts: AnalysisFacts, focusMode: FocusMode) {
  if (facts.selection) return 'What does the selected PAE region support?';
  if (focusMode === 'domains' && facts.domains.length) return 'Which structural region should I inspect first?';
  const pair = facts.primaryInterface;
  return pair ? `Is the ${pair.chainA}–${pair.chainB} interface reliable?` : 'What should I inspect first?';
}

function focusLabel(facts: AnalysisFacts, focusMode: FocusMode) {
  if (focusMode === 'interface' && facts.primaryInterface) return `Interface ${facts.primaryInterface.chainA}–${facts.primaryInterface.chainB}`;
  if (focusMode === 'pocket') return 'Ligand pocket';
  if (focusMode === 'domains') return 'Structural regions';
  return 'Whole structure';
}

function historyFor(turns: AssistantTurn[]): AssistantHistoryItem[] {
  return turns.slice(-4).flatMap((turn) => [
    { role: 'user' as const, content: turn.question },
    {
      role: 'assistant' as const,
      content: JSON.stringify({
        conclusion: turn.response.answer,
        alternative: turn.response.alternative,
        falsification: turn.response.falsification,
      }),
    },
  ]);
}

export function AssistantSessionProvider({ facts, prediction, focusMode = 'all', comparisonLabel, children }: SessionProps) {
  const defaultQuestion = useMemo(() => questionFor(facts, focusMode), [facts, focusMode]);
  const baseline = useMemo(() => buildLocalAssistantResponse(facts, prediction, defaultQuestion), [defaultQuestion, facts, prediction]);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string>();
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const requestIdRef = useRef(0);
  const predictionIdRef = useRef(prediction.id);

  const contextItems = useMemo(() => [
    prediction.label,
    focusLabel(facts, focusMode),
    facts.selection ? `PAE ${facts.selection.label}` : undefined,
    comparisonLabel ? `Compared with ${comparisonLabel}` : undefined,
  ].filter((item): item is string => Boolean(item)), [comparisonLabel, facts, focusMode, prediction.label]);

  useEffect(() => {
    if (predictionIdRef.current === prediction.id) return;
    predictionIdRef.current = prediction.id;
    requestRef.current?.controller.abort();
    requestIdRef.current += 1;
    setQuestion('');
    setTurns([]);
    setPendingQuestion(undefined);
    setBusy(false);
  }, [prediction.id]);

  useEffect(() => {
    return () => requestRef.current?.controller.abort();
  }, []);

  const cancelRequest = () => {
    const interruptedQuestion = pendingQuestion;
    requestRef.current?.controller.abort();
    requestRef.current = null;
    requestIdRef.current += 1;
    setPendingQuestion(undefined);
    setBusy(false);
    if (interruptedQuestion) setQuestion(interruptedQuestion);
  };

  const submitQuestion = async (rawQuestion: string) => {
    const nextQuestion = rawQuestion.trim();
    if (nextQuestion.length < 3 || busy) return;
    requestRef.current?.controller.abort();
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    requestRef.current = { id: requestId, controller };
    setBusy(true);
    setPendingQuestion(nextQuestion);
    setQuestion('');

    let responseData: AssistantResponse;
    let source: AssistantTurn['source'] = 'local';
    let model = 'deterministic metrics';
    let notice: string | undefined;
    const localResponse = buildLocalAssistantResponse(facts, prediction, nextQuestion);
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_ANALYSIS_TIMEOUT_MS);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: nextQuestion,
          history: historyFor(turns),
          viewContext: { focusMode, comparisonLabel: comparisonLabel ?? null },
          facts,
        }),
        signal: controller.signal,
      });
      const payload = await response.json() as AssistantEnvelope | { message?: string };
      if (!response.ok || !('data' in payload)) throw new Error('message' in payload ? payload.message : 'Analysis request failed');
      if (requestId !== requestIdRef.current) return;
      responseData = normalizeAssistantResponse(payload.data, localResponse, facts);
      source = payload.source;
      model = payload.model;
      notice = payload.fallbackReason ? fallbackNotice(payload.fallbackReason) : undefined;
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      if (controller.signal.aborted && !timedOut || error instanceof DOMException && error.name === 'AbortError' && !timedOut) return;
      responseData = localResponse;
      notice = fallbackNotice(timedOut ? 'Live analysis timed out after 15 seconds' : 'Live analysis request failed');
    } finally {
      window.clearTimeout(timeout);
    }

    if (requestId !== requestIdRef.current) return;
    setTurns((current) => [...current, { id: requestId, question: nextQuestion, response: responseData, source, model, notice }]);
    requestRef.current = null;
    setPendingQuestion(undefined);
    setBusy(false);
  };

  return (
    <AssistantSessionContext.Provider value={{ question, setQuestion, turns, pendingQuestion, baseline, facts, contextItems, busy, submitQuestion, cancelRequest }}>
      {children}
    </AssistantSessionContext.Provider>
  );
}

function EvidenceSection({ response, facts, onAction }: { response: AssistantResponse; facts: AnalysisFacts; onAction: Props['onAction'] }) {
  if (!response.evidence.length) return null;
  const actionableEvidence = response.evidence.filter((item) => item.action.type !== 'none' && isGroundedEvidenceAction(item.action, facts));
  const actionableIds = new Set(actionableEvidence.map((item) => item.id));
  const seenActionTypes = new Set<EvidenceAction['type']>();
  const quickActions = actionableEvidence.filter((item) => {
    if (seenActionTypes.has(item.action.type)) return false;
    seenActionTypes.add(item.action.type);
    return true;
  }).slice(0, 2);
  return (
    <section className="evidence-section" aria-label="Evidence used in this answer">
      <h3>Observed evidence</h3>
      <div className="evidence-list">
        {response.evidence.map((item) => {
          const actionable = actionableIds.has(item.id);
          return (
            <button key={item.id} type="button" onClick={() => onAction(item.action)} disabled={!actionable} title={actionable ? 'Show this evidence in the structure and PAE views' : undefined}>
              <span>{item.label}</span><strong>{item.value}</strong><small>{item.interpretation}</small>
            </button>
          );
        })}
      </div>
      <div className="evidence-actions">
        {quickActions.map((item) => (
            <button type="button" key={`action-${item.id}`} onClick={() => onAction(item.action)}>
              <Icon name={item.action.type === 'show_interface' ? 'expand' : 'link'} size={16} />
              {item.action.type === 'show_interface' ? 'Show interface' : `Show ${item.value.split(' · ')[0]}`}
            </button>
        ))}
      </div>
    </section>
  );
}

function ScientificResponse({ turn, facts, onAction, onFollowUp, onRetry, busy }: {
  turn: AssistantTurn;
  facts: AnalysisFacts;
  onAction: Props['onAction'];
  onFollowUp: (question: string) => void;
  onRetry: (question: string) => void;
  busy: boolean;
}) {
  return (
    <article className="assistant-response">
      <div className="assistant-byline">
        <span>FoldLens discussion</span>
        <small>{turn.source === 'live' ? turn.model : 'local metric fallback'}</small>
      </div>
      <section className="assistant-conclusion">
        <span>Conclusion</span>
        <h2>{turn.response.answer}</h2>
      </section>
      <EvidenceSection response={turn.response} facts={facts} onAction={onAction} />
      <div className="scientific-interpretations">
        <section>
          <span>Alternative interpretation</span>
          <p>{turn.response.alternative}</p>
        </section>
        <section>
          <span>What would change this</span>
          <p>{turn.response.falsification}</p>
        </section>
      </div>
      <details className="assistant-caveats">
        <summary>Limits of this interpretation <b>{turn.response.caveats.length}</b></summary>
        {turn.response.caveats.map((caveat) => <p key={caveat}>{caveat}</p>)}
      </details>
      {turn.notice ? (
        <div className="assistant-status" role="status">
          <p>{turn.notice}</p>
          <button type="button" disabled={busy} onClick={() => onRetry(turn.question)}>Retry live analysis</button>
        </div>
      ) : null}
      <section className="assistant-followups" aria-label="Suggested follow-up questions">
        <span>Continue the discussion</span>
        <div>
          {turn.response.nextQuestions.map((nextQuestion) => (
            <button type="button" key={nextQuestion} disabled={busy} onClick={() => onFollowUp(nextQuestion)}>{nextQuestion}</button>
          ))}
        </div>
      </section>
    </article>
  );
}

export function AssistantPanel({ onAction }: Props) {
  const session = useContext(AssistantSessionContext);
  if (!session) throw new Error('AssistantPanel must be rendered inside AssistantSessionProvider.');
  const { question, setQuestion, turns, pendingQuestion, baseline, facts, contextItems, busy, submitQuestion, cancelRequest } = session;
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (!scrollRef.current) return;
    const hasDiscussion = turns.length > 0 || Boolean(pendingQuestion);
    scrollRef.current.scrollTo?.({ top: hasDiscussion ? scrollRef.current.scrollHeight : 0, behavior: turns.length ? 'smooth' : 'auto' });
  }, [pendingQuestion, turns]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitQuestion(question);
  };

  return (
    <div className="assistant-panel" aria-busy={busy}>
      <div className="assistant-context" aria-label="Current structure context">
        <div><span>Live structure context</span><small>Attached to every turn</small></div>
        <ul>{contextItems.map((item) => <li key={item} title={item}>{item}</li>)}</ul>
      </div>
      <div className="assistant-scroll" ref={scrollRef}>
        {turns.length === 0 ? (
          <div className="assistant-empty">
            <div className="assistant-answer baseline">
              <div className="assistant-byline"><span>Metric baseline</span><small>before GPT-5.6</small></div>
              <h2>{baseline.answer}</h2>
              <p className="assistant-baseline-note">Discuss the loaded metrics without treating prediction confidence as experimental validation.</p>
            </div>
            <EvidenceSection response={baseline} facts={facts} onAction={onAction} />
            <section className="assistant-starters" aria-label="Suggested questions">
              <span>Start a scientific discussion</span>
              {baseline.nextQuestions.map((starter) => <button type="button" key={starter} disabled={busy} onClick={() => void submitQuestion(starter)}>{starter}</button>)}
            </section>
          </div>
        ) : null}
        {turns.map((turn) => (
          <div className="assistant-turn" key={turn.id}>
            <div className="assistant-question"><span>You asked</span><p>{turn.question}</p></div>
            <ScientificResponse turn={turn} facts={facts} onAction={onAction} onFollowUp={(nextQuestion) => void submitQuestion(nextQuestion)} onRetry={(retryQuestion) => void submitQuestion(retryQuestion)} busy={busy} />
          </div>
        ))}
        {pendingQuestion ? (
          <div className="assistant-turn pending" aria-live="polite">
            <div className="assistant-question"><span>You asked</span><p>{pendingQuestion}</p></div>
            <div className="assistant-thinking"><span className="composer-spinner" /><p>Testing the question against the attached evidence…</p></div>
          </div>
        ) : null}
      </div>
      <form className="assistant-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>Ask about this prediction</label>
        <textarea
          id={inputId}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            void submitQuestion(question);
          }}
          placeholder={turns.length ? 'Ask a grounded follow-up…' : 'Ask about the current structure…'}
          rows={1}
          maxLength={400}
        />
        {busy ? (
          <button type="button" className="assistant-cancel" aria-label="Cancel analysis" onClick={cancelRequest}>
            <Icon name="close" size={17} />
          </button>
        ) : (
          <button type="submit" aria-label="Ask FoldLens" disabled={question.trim().length < 3}>
            <Icon name="upload" size={17} />
          </button>
        )}
      </form>
    </div>
  );
}
