import { useId, useRef, useState } from 'react';
import type { Prediction, ChainInfo } from '../types/af3';
import type { EvidenceAction } from '../types/analysis';
import { AssistantPanel } from './AssistantPanel';
import { Inspector } from './Inspector';

type Props = {
  tab?: 'analysis' | 'ask';
  onTabChange?: (tab: 'analysis' | 'ask') => void;
  prediction: Prediction;
  chains: ChainInfo[];
  visibleChains: Set<string>;
  notices: string[];
  onSetChainVisibility: (ids: string[], visible: boolean) => void;
  onAction: (action: EvidenceAction) => void;
};

export function WorkspaceInspector({ tab: controlledTab, onTabChange, prediction, chains, visibleChains, notices, onSetChainVisibility, onAction }: Props) {
  const [localTab, setLocalTab] = useState<'analysis' | 'ask'>('ask');
  const tab = controlledTab ?? localTab;
  const tabListRef = useRef<HTMLDivElement>(null);
  const analysisTabId = useId();
  const askTabId = useId();
  const analysisPanelId = useId();
  const askPanelId = useId();
  const selectTab = (next: 'analysis' | 'ask') => {
    if (controlledTab === undefined) setLocalTab(next);
    onTabChange?.(next);
    const index = next === 'analysis' ? 0 : 1;
    window.requestAnimationFrame(() => tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus());
  };
  return (
    <aside className="workspace-inspector" aria-label="Prediction analysis workspace">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector mode" ref={tabListRef} onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        selectTab(event.key === 'ArrowLeft' || event.key === 'Home' ? 'analysis' : 'ask');
      }}>
        <button id={analysisTabId} type="button" role="tab" aria-selected={tab === 'analysis'} aria-controls={analysisPanelId} tabIndex={tab === 'analysis' ? 0 : -1} onClick={() => selectTab('analysis')}>Measured facts</button>
        <button id={askTabId} type="button" role="tab" aria-selected={tab === 'ask'} aria-controls={askPanelId} tabIndex={tab === 'ask' ? 0 : -1} onClick={() => selectTab('ask')}>Scientific discussion</button>
      </div>
      <div id={analysisPanelId} role="tabpanel" aria-labelledby={analysisTabId} hidden={tab !== 'analysis'}>
        <Inspector summary={prediction.summary} chains={chains} visibleChains={visibleChains} onSetChainVisibility={onSetChainVisibility} notices={notices} embedded />
      </div>
      <div id={askPanelId} role="tabpanel" aria-labelledby={askTabId} hidden={tab !== 'ask'}>
        <AssistantPanel onAction={onAction} />
      </div>
    </aside>
  );
}
