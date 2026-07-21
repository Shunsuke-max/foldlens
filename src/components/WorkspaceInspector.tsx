import { useState } from 'react';
import type { Prediction, ChainInfo, FocusMode } from '../types/af3';
import type { AnalysisFacts, EvidenceAction } from '../types/analysis';
import { AssistantPanel } from './AssistantPanel';
import { Inspector } from './Inspector';

type Props = {
  prediction: Prediction;
  facts: AnalysisFacts;
  chains: ChainInfo[];
  visibleChains: Set<string>;
  notices: string[];
  focusMode?: FocusMode;
  onToggleChain: (id: string) => void;
  onAction: (action: EvidenceAction) => void;
};

export function WorkspaceInspector({ prediction, facts, chains, visibleChains, notices, focusMode = 'all', onToggleChain, onAction }: Props) {
  const [tab, setTab] = useState<'analysis' | 'ask'>('ask');
  return (
    <aside className="workspace-inspector" aria-label="Prediction analysis workspace">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector mode">
        <button type="button" role="tab" aria-selected={tab === 'analysis'} onClick={() => setTab('analysis')}>Analysis</button>
        <button type="button" role="tab" aria-selected={tab === 'ask'} onClick={() => setTab('ask')}>Ask FoldLens</button>
      </div>
      {tab === 'analysis'
        ? <Inspector summary={prediction.summary} chains={chains} visibleChains={visibleChains} onToggleChain={onToggleChain} notices={notices} embedded />
        : <AssistantPanel facts={facts} prediction={prediction} focusMode={focusMode} onAction={onAction} />}
    </aside>
  );
}
