import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { ComparisonSummary } from './components/ComparisonSummary';
import { FocusModeControl } from './components/FocusModeControl';
import { Inspector } from './components/Inspector';
import { MoleculeViewer } from './components/MoleculeViewer';
import { OpenResultDialog } from './components/OpenResultDialog';
import { PaeHeatmap } from './components/PaeHeatmap';
import { PredictionRail } from './components/PredictionRail';
import { ScoreStrip } from './components/ScoreStrip';
import { BrightnessControl, ViewerToolbar, type ColorMode } from './components/ViewerToolbar';
import { WorkspaceInspector } from './components/WorkspaceInspector';
import { AssistantSessionProvider } from './components/AssistantPanel';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Icon } from './components/Icon';
import { buildAnalysisFacts, interfaceSelection, rangesSelection, selectionResidueRanges } from './lib/analysis';
import { parseFiles } from './lib/af3Parser';
import { clampStructureBrightness } from './lib/brightness';
import { buildHtmlReport, createPaeSnapshot, createSession, downloadHtmlReport, downloadSession, parseSessionFile } from './lib/export';
import { demoResult, loadDemoResult } from './lib/demo';
import { inferDomains } from './lib/domains';
import { ligandFocusFromChains } from './lib/focusMode';
import { colorModeAfterClick, restoredVisibleChainIds } from './lib/viewMode';
import { isGroundedEvidenceAction } from './lib/analysisSchema';
import { clearRecentSession, loadRecentSession, loadRecentSummary, resultStorageKey, saveRecentResult, saveRecentView, type RecentSessionSummary } from './lib/sessionStore';
import type { AF3Result, FocusMode, FoldLensViewState, Selection } from './types/af3';
import type { EvidenceAction } from './types/analysis';

type MobileTab = 'structure' | 'pae' | 'models' | 'insights';
const COMPACT_WORKSPACE_QUERY = '(max-width: 960px)';

function useCompactWorkspace() {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPACT_WORKSPACE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(COMPACT_WORKSPACE_QUERY);
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return compact;
}

function getHighlightedChain(result: AF3Result, selectedId: string, selection: Selection) {
  if (!selection) return undefined;
  const prediction = result.predictions.find((item) => item.id === selectedId);
  const tokenIds = prediction?.confidence?.tokenChainIds;
  if (tokenIds?.length) return tokenIds[Math.min(tokenIds.length - 1, selection.xStart)];
  const nonLigands = result.chains.filter((chain) => chain.kind !== 'ligand');
  if (!nonLigands.length) return undefined;
  const size = prediction?.confidence?.pae?.length ?? nonLigands.length;
  return nonLigands[Math.min(nonLigands.length - 1, Math.floor((selection.xStart / size) * nonLigands.length))]?.id;
}

export default function App() {
  const compactWorkspace = useCompactWorkspace();
  const [result, setResult] = useState<AF3Result>(demoResult);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [currentAnalysisPaused, setCurrentAnalysisPaused] = useState(false);
  const [selectedId, setSelectedId] = useState(demoResult.predictions[0].id);
  const [compareId, setCompareId] = useState<string>();
  const [visibleChains, setVisibleChains] = useState(() => new Set(demoResult.chains.map((chain) => chain.id)));
  const [colorMode, setColorMode] = useState<ColorMode>('chains');
  const [brightness, setBrightness] = useState(100);
  const [surface, setSurface] = useState(false);
  const [surfaceOnly, setSurfaceOnly] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<string>();
  const [selection, setSelection] = useState<Selection>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>('structure');
  const [inspectorTab, setInspectorTab] = useState<'analysis' | 'ask'>('ask');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string>();
  const [pendingResult, setPendingResult] = useState<AF3Result>();
  const [pendingView, setPendingView] = useState<FoldLensViewState>();
  const [recentSession, setRecentSession] = useState<RecentSessionSummary | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);
  const persistenceWarningShown = useRef(false);
  const persistedViewResult = useRef<string | undefined>(undefined);

  const prediction = useMemo(
    () => result.predictions.find((item) => item.id === selectedId) ?? result.predictions[0],
    [result, selectedId],
  );
  const comparePrediction = useMemo(() => result.predictions.find((item) => item.id === compareId && item.id !== prediction.id), [compareId, prediction.id, result.predictions]);
  const highlightedChain = getHighlightedChain(result, prediction.id, selection);
  const highlightedResidues = useMemo(() => selectionResidueRanges(prediction, selection), [prediction, selection]);
  const domains = useMemo(() => inferDomains(result, prediction), [result, prediction]);
  const analysisFacts = useMemo(() => buildAnalysisFacts(result, prediction, selection, domains), [domains, result, prediction, selection]);
  const comparisonFacts = useMemo(() => comparePrediction ? buildAnalysisFacts(result, comparePrediction, selection) : undefined, [comparePrediction, result, selection]);
  const selectionLabel = analysisFacts.selection?.label;
  const confidenceAvailable = Boolean(prediction.confidence?.tokenPlddts?.some(Number.isFinite));
  const ligandFocus = useMemo(() => ligandFocusFromChains(result.chains), [result.chains]);
  const interfaceChains = analysisFacts.primaryInterface
    ? [analysisFacts.primaryInterface.chainA, analysisFacts.primaryInterface.chainB] as [string, string]
    : undefined;
  const domainSource = domains.every((domain) => domain.source === 'pae') ? 'pae'
    : domains.some((domain) => domain.source === 'pae') ? 'mixed' : 'annotation';
  const linkedViewParts = [
    focusMode === 'interface' ? `Interface ${interfaceChains?.join('–') ?? ''}`
      : focusMode === 'pocket' ? `Pocket ${ligandFocus.label ?? ''}`
        : focusMode === 'domains' ? 'Domains' : undefined,
    selectionLabel ? `PAE ${selectionLabel}` : undefined,
    comparePrediction ? `Overlay ${comparePrediction.label}` : undefined,
  ].filter((part): part is string => Boolean(part));
  const visibleChainIds = useMemo(() => [...visibleChains], [visibleChains]);
  const persistentView = useMemo<FoldLensViewState>(() => ({
    selectedId: prediction.id,
    compareId: comparePrediction?.id,
    visibleChains: visibleChainIds,
    colorMode,
    brightness,
    surface,
    surfaceOnly,
    focusMode,
    selectedDomainId,
    selection,
    mobileTab,
    inspectorTab,
  }), [brightness, colorMode, comparePrediction?.id, focusMode, inspectorTab, mobileTab, prediction.id, selectedDomainId, selection, surface, surfaceOnly, visibleChainIds]);

  useEffect(() => {
    let active = true;
    void loadRecentSummary().then((summary) => { if (active) setRecentSession(summary); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!workspaceOpen || result.isDemo) return;
    void saveRecentResult(result).catch(() => {
      if (persistenceWarningShown.current) return;
      persistenceWarningShown.current = true;
      setToast('This analysis is open, but the browser could not save it for next time.');
      window.setTimeout(() => setToast(undefined), 4200);
    });
  }, [result, workspaceOpen]);

  useEffect(() => {
    if (!workspaceOpen || result.isDemo) return;
    const resultKey = resultStorageKey(result);
    const delay = persistedViewResult.current === resultKey ? 650 : 0;
    const timeout = window.setTimeout(() => {
      void saveRecentView(result, persistentView).then((summary) => {
        persistedViewResult.current = resultKey;
        setRecentSession(summary);
      }).catch(() => {
        if (persistenceWarningShown.current) return;
        persistenceWarningShown.current = true;
        setToast('Your latest view could not be saved for next time.');
        window.setTimeout(() => setToast(undefined), 4200);
      });
    }, delay);
    return () => window.clearTimeout(timeout);
  }, [persistentView, result, workspaceOpen]);

  useEffect(() => {
    const warm = () => { if (document.visibilityState === 'visible') void fetch('/api/health', { cache: 'no-store' }).catch(() => undefined); };
    warm();
    const interval = window.setInterval(warm, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', warm);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', warm); };
  }, []);

  useEffect(() => {
    if (workspaceOpen) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [result, workspaceOpen]);

  useEffect(() => {
    if (!compactWorkspace || mobileTab !== 'models' || !comparePrediction) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('mobile-comparison-summary')?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compactWorkspace, comparePrediction, mobileTab]);

  const showOpenDialog = () => {
    setError(undefined);
    setPendingResult(undefined);
    setPendingView(undefined);
    setDialogOpen(true);
  };

  const openFiles = async (files: File[]) => {
    setBusy(true);
    setError(undefined);
    setPendingResult(undefined);
    setPendingView(undefined);
    setDialogOpen(true);
    try {
      const session = await parseSessionFile(files);
      const next = session?.result ?? await parseFiles(files);
      setPendingResult(next);
      setPendingView(session?.view);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This result could not be opened.');
      setDialogOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const applyResult = (nextResult: AF3Result, view?: FoldLensViewState) => {
    const defaultId = nextResult.predictions[0].id;
    const selected = nextResult.predictions.some((item) => item.id === view?.selectedId) ? view!.selectedId : defaultId;
    const allChainIds = nextResult.chains.map((chain) => chain.id);
    const visible = restoredVisibleChainIds(allChainIds, view?.visibleChains);
    setResult(nextResult);
    setSelectedId(selected);
    setCompareId(nextResult.predictions.some((item) => item.id === view?.compareId && item.id !== selected) ? view?.compareId : undefined);
    setVisibleChains(new Set(visible));
    const selectedPrediction = nextResult.predictions.find((item) => item.id === selected) ?? nextResult.predictions[0];
    const selectedHasPlddt = Boolean(selectedPrediction.confidence?.tokenPlddts?.some(Number.isFinite));
    setColorMode(view?.colorMode === 'confidence' && selectedHasPlddt ? 'confidence' : 'chains');
    setBrightness(clampStructureBrightness(view?.brightness ?? 100));
    setSelection(view?.selection ?? null);
    setSurface(view?.surface ?? false);
    setSurfaceOnly(view?.surfaceOnly ?? false);
    setFocusMode(view?.focusMode ?? 'all');
    setSelectedDomainId(view?.selectedDomainId);
    setMobileTab(view?.mobileTab ?? 'structure');
    setInspectorTab(view?.inspectorTab ?? 'ask');
    setCurrentAnalysisPaused(false);
    setWorkspaceOpen(true);
  };

  const confirmImport = () => {
    if (!pendingResult) return;
    applyResult(pendingResult, pendingView);
    setPendingResult(undefined);
    setPendingView(undefined);
    setDialogOpen(false);
    setToast(`${pendingResult.predictions.length} prediction${pendingResult.predictions.length === 1 ? '' : 's'} opened locally`);
    window.setTimeout(() => setToast(undefined), 3200);
  };

  const resumeRecentSession = async () => {
    setResumeBusy(true);
    try {
      const session = await loadRecentSession();
      if (!session) {
        setRecentSession(null);
        setToast('The previous analysis is no longer available on this device.');
        window.setTimeout(() => setToast(undefined), 3600);
        return;
      }
      applyResult(session.result, session.view);
      setToast('Previous analysis restored');
      window.setTimeout(() => setToast(undefined), 2800);
    } finally {
      setResumeBusy(false);
    }
  };

  const forgetRecentSession = async () => {
    await clearRecentSession();
    setRecentSession(null);
    setToast('Saved analysis removed from this browser');
    window.setTimeout(() => setToast(undefined), 2800);
  };

  const openDemo = async () => {
    setDemoBusy(true);
    try {
      const loaded = await loadDemoResult();
      setResult(loaded);
      setSelectedId(loaded.predictions[0].id);
      setCompareId(undefined);
      setVisibleChains(new Set(loaded.chains.map((chain) => chain.id)));
      setColorMode('chains');
      setBrightness(100);
      setSurface(false);
      setSurfaceOnly(false);
      setFocusMode('all');
      setSelectedDomainId(undefined);
      setSelection(null);
      setMobileTab('structure');
      setInspectorTab('ask');
      setCurrentAnalysisPaused(false);
      setWorkspaceOpen(true);
    } catch {
      setToast('The sample structure could not be loaded. Open a local AF3 result to continue.');
      window.setTimeout(() => setToast(undefined), 3200);
    } finally {
      setDemoBusy(false);
    }
  };

  const setChainVisibility = (ids: string[], visible: boolean) => {
    setVisibleChains((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (visible) next.add(id); else next.delete(id);
      });
      return next;
    });
  };

  const selectColorMode = (mode: ColorMode) => {
    if (mode === 'confidence' && !confidenceAvailable) return;
    const next = colorModeAfterClick(colorMode, mode, surface, surfaceOnly);
    setColorMode(next.colorMode);
    setSurfaceOnly(next.surfaceOnly);
    if (focusMode === 'domains') {
      setFocusMode('all');
      setSelectedDomainId(undefined);
    }
  };

  const toggleSurface = () => {
    const next = !surface;
    setSurface(next);
    if (next) setSurfaceOnly(false);
    if (focusMode === 'domains') {
      setFocusMode('all');
      setSelectedDomainId(undefined);
    }
  };

  const selectFocusMode = (mode: FocusMode) => {
    setFocusMode(mode);
    setSelectedDomainId(undefined);
    if (mode !== 'all') {
      setSurface(false);
      setSurfaceOnly(false);
    }
    if (mode === 'interface' && interfaceChains) {
      setVisibleChains((current) => new Set([...current, ...interfaceChains]));
    }
    if (mode === 'pocket' && ligandFocus.chainIds.length) {
      setVisibleChains((current) => new Set([...current, ...ligandFocus.chainIds]));
    }
    if (mode === 'domains' && domains.length) {
      setVisibleChains((current) => new Set([...current, ...domains.map((domain) => domain.chainId)]));
    }
  };

  const selectDomain = (domainId?: string) => {
    setSelectedDomainId(domainId);
    const domain = domains.find((item) => item.id === domainId);
    if (domain) setVisibleChains((current) => new Set([...current, domain.chainId]));
  };

  const canvasImage = (selector: string) => {
    try { return document.querySelector<HTMLCanvasElement>(selector)?.toDataURL('image/png'); } catch { return undefined; }
  };

  const exportReport = () => {
    const mobile = window.matchMedia(COMPACT_WORKSPACE_QUERY).matches;
    const html = buildHtmlReport({
      result, prediction, facts: analysisFacts, selectionLabel,
      structureImage: canvasImage(mobile ? '.mobile-viewer .molecule-host canvas' : '.viewer-pane .molecule-host canvas'),
      paeImage: mobile ? createPaeSnapshot(prediction.confidence?.pae) : canvasImage('.desktop-workspace .pae-panel canvas'),
    });
    downloadHtmlReport(result.jobName, html);
    setToast('Confidence report exported');
    window.setTimeout(() => setToast(undefined), 3200);
  };

  const saveSession = () => {
    downloadSession(createSession(result, persistentView));
    setToast('Resumable FoldLens session saved');
    window.setTimeout(() => setToast(undefined), 3200);
  };

  const selectPrediction = (id: string) => {
    setSelectedId(id);
    if (compareId === id) setCompareId(undefined);
    setSelection(null);
    setFocusMode('all');
    setSelectedDomainId(undefined);
    const nextPrediction = result.predictions.find((item) => item.id === id);
    if (colorMode === 'confidence' && !nextPrediction?.confidence?.tokenPlddts?.some(Number.isFinite)) setColorMode('chains');
  };

  const runEvidenceAction = (action: EvidenceAction) => {
    if (!isGroundedEvidenceAction(action, analysisFacts)) {
      setToast('This evidence action was rejected because it does not match the active model');
      window.setTimeout(() => setToast(undefined), 3200);
      return;
    }
    let nextSelection: Selection = null;
    if (action.type === 'show_interface' && action.chainIds.length >= 2) {
      nextSelection = interfaceSelection(prediction, action.chainIds[0], action.chainIds[1]);
      setFocusMode('interface');
      setSurface(false);
      setSurfaceOnly(false);
    } else if (action.type === 'show_selection' && action.selection) {
      nextSelection = action.selection;
    } else if (action.residueRanges.length) {
      nextSelection = rangesSelection(prediction, action.residueRanges);
    }
    if (nextSelection) setSelection(nextSelection);
    if (action.chainIds.length) {
      setVisibleChains((current) => new Set([...current, ...action.chainIds]));
    }
    setToast(nextSelection ? 'Evidence linked to PAE and 3D' : 'Evidence is visible in the analysis panel');
    window.setTimeout(() => setToast(undefined), 2600);
  };

  const clearLinkedView = () => {
    setCompareId(undefined);
    setSelection(null);
    setFocusMode('all');
    setSelectedDomainId(undefined);
    setSurface(false);
    setSurfaceOnly(false);
    setToast('Linked view cleared');
    window.setTimeout(() => setToast(undefined), 2200);
  };

  const selectMobileTab = (tab: MobileTab) => {
    setMobileTab(tab);
    window.requestAnimationFrame(() => document.getElementById(`mobile-tab-${tab}`)?.focus({ preventScroll: true }));
  };

  const tabs: { id: MobileTab; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'pae', label: 'PAE' },
    { id: 'models', label: 'Models' },
    { id: 'insights', label: 'Insights' },
  ];

  const returnHome = () => {
    setDialogOpen(false);
    setCurrentAnalysisPaused(true);
    setWorkspaceOpen(false);
  };

  const continueCurrentAnalysis = () => {
    setCurrentAnalysisPaused(false);
    setWorkspaceOpen(true);
  };

  return (
    <AssistantSessionProvider facts={analysisFacts} prediction={prediction} focusMode={focusMode} comparisonLabel={comparePrediction?.label}>
    <div
      className="app"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void openFiles(Array.from(event.dataTransfer.files)); }}
    >
      {!workspaceOpen ? <WelcomeScreen
        demoBusy={demoBusy}
        currentAnalysis={currentAnalysisPaused ? { jobName: result.jobName, predictionCount: result.predictions.length, isDemo: result.isDemo } : undefined}
        recentSession={recentSession}
        resumeBusy={resumeBusy}
        onFiles={(files) => void openFiles(files)}
        onDemo={() => void openDemo()}
        onContinueCurrent={continueCurrentAnalysis}
        onResume={() => void resumeRecentSession()}
        onForgetRecent={() => void forgetRecentSession()}
      /> : <>
      <AppHeader jobName={result.jobName} isDemo={result.isDemo} onHome={returnHome} onOpen={showOpenDialog} onExportReport={exportReport} onSaveSession={saveSession} />

      {!compactWorkspace && <main className="desktop-workspace">
        <div className="workspace-main">
          <PredictionRail predictions={result.predictions} selectedId={prediction.id} compareId={comparePrediction?.id} onSelect={selectPrediction} onCompare={setCompareId} onOpen={showOpenDialog} />
          <section className="viewer-pane">
            <ViewerToolbar
              colorMode={colorMode}
              surface={surface}
              surfaceOnly={surfaceOnly}
              colorModeSuppressed={focusMode === 'domains'}
              confidenceAvailable={confidenceAvailable}
              brightness={brightness}
              onColorMode={selectColorMode}
              onSurface={toggleSurface}
              onBrightness={setBrightness}
              onReset={() => setResetSignal((value) => value + 1)}
              onExpand={() => document.querySelector('.viewer-pane')?.requestFullscreen?.()}
            />
            <ScoreStrip summary={prediction.summary} />
            <FocusModeControl
              mode={focusMode}
              interfaceLabel={interfaceChains?.join('–')}
              interfaceScore={analysisFacts.primaryInterface?.iptm}
              pocketLabel={ligandFocus.label}
              domainCount={domains.length}
              domainSource={domainSource}
              onChange={selectFocusMode}
            />
            {result.isDemo && <button className="demo-ribbon" type="button" onClick={showOpenDialog}><strong>Sample data</strong><span>One experimental structure · illustrative confidence variants</span><b>Open your result</b></button>}
            {comparePrediction && <ComparisonSummary primary={prediction} comparison={comparePrediction} primarySelection={analysisFacts.selection} comparisonSelection={comparisonFacts?.selection} onClose={() => setCompareId(undefined)} />}
            <MoleculeViewer
              cif={prediction.cif}
              confidence={prediction.confidence}
              compareCif={comparePrediction?.cif}
              compareLabel={comparePrediction?.label}
              chains={result.chains}
              visibleChains={visibleChains}
              colorMode={colorMode}
              brightness={brightness}
              surface={surface}
              surfaceOnly={surfaceOnly}
              onSurfaceOnly={setSurfaceOnly}
              focusMode={focusMode}
              interfaceChains={interfaceChains}
              interfaceScore={analysisFacts.primaryInterface?.iptm}
              ligandFocus={ligandFocus}
              domains={domains}
              selectedDomainId={selectedDomainId}
              onSelectDomain={selectDomain}
              highlightedChain={highlightedResidues.length ? undefined : highlightedChain}
              highlightedResidues={highlightedResidues}
              highlightedLabel={selectionLabel}
              resetSignal={resetSignal}
            />
          </section>
          <WorkspaceInspector tab={inspectorTab} onTabChange={setInspectorTab} prediction={prediction} chains={result.chains} visibleChains={visibleChains} onSetChainVisibility={setChainVisibility} notices={result.notices} onAction={runEvidenceAction} />
        </div>
        <PaeHeatmap
          pae={prediction.confidence?.pae}
          chainIds={prediction.confidence?.tokenChainIds}
          tokenResidues={prediction.confidence?.tokenResidues}
          selection={selection}
          selectionStats={analysisFacts.selection}
          onSelection={setSelection}
          selectionLabel={selectionLabel}
          primaryLabel={prediction.label}
          comparison={comparePrediction ? { label: comparePrediction.label, pae: comparePrediction.confidence?.pae, chainIds: comparePrediction.confidence?.tokenChainIds, tokenResidues: comparePrediction.confidence?.tokenResidues, selectionStats: comparisonFacts?.selection } : undefined}
        />
      </main>}

      {compactWorkspace && <main className="mobile-workspace">
        <section className={`mobile-viewer ${mobileTab === 'structure' ? '' : 'compact'}`}>
          <div className="mobile-viewer-actions">
            <button className="icon-button" type="button" onClick={() => document.querySelector('.mobile-viewer')?.requestFullscreen?.()} aria-label="Expand structure"><Icon name="expand" /></button>
            <span className="mobile-action-spacer" />
            <button className="icon-button" type="button" onClick={() => setResetSignal((value) => value + 1)} aria-label="Reset view"><Icon name="reset" /></button>
            <BrightnessControl brightness={brightness} onBrightness={setBrightness} />
            <button className={`icon-button ${focusMode !== 'domains' && colorMode === 'chains' ? 'active' : ''}`} type="button" aria-pressed={focusMode !== 'domains' && colorMode === 'chains'} disabled={!confidenceAvailable} title={confidenceAvailable ? 'Toggle chain and confidence coloring' : 'No AlphaFold pLDDT values were loaded'} onClick={() => selectColorMode(colorMode === 'chains' ? 'confidence' : 'chains')} aria-label="Toggle chain and confidence coloring"><Icon name="palette" /></button>
          </div>
          <MoleculeViewer
            cif={prediction.cif}
            confidence={prediction.confidence}
            compareCif={comparePrediction?.cif}
            compareLabel={comparePrediction?.label}
            chains={result.chains}
            visibleChains={visibleChains}
            colorMode={colorMode}
            brightness={brightness}
            surface={false}
            focusMode={focusMode}
            interfaceChains={interfaceChains}
            interfaceScore={analysisFacts.primaryInterface?.iptm}
            ligandFocus={ligandFocus}
            domains={domains}
            selectedDomainId={selectedDomainId}
            onSelectDomain={selectDomain}
            highlightedChain={highlightedResidues.length ? undefined : highlightedChain}
            highlightedResidues={highlightedResidues}
            highlightedLabel={selectionLabel}
            resetSignal={resetSignal}
          />
          <FocusModeControl
            mode={focusMode}
            interfaceLabel={interfaceChains?.join('–')}
            interfaceScore={analysisFacts.primaryInterface?.iptm}
            pocketLabel={ligandFocus.label}
            domainCount={domains.length}
            domainSource={domainSource}
            onChange={selectFocusMode}
          />
          {result.isDemo && <button className="demo-ribbon" type="button" onClick={showOpenDialog}><strong>Sample data</strong><span>One structure · illustrative confidence</span><b>Open</b></button>}
        </section>
        <ScoreStrip summary={prediction.summary} compact />
        {linkedViewParts.length > 0 && <div className="mobile-state-bar" role="status" aria-live="polite">
          <span><strong>Current view</strong><small title={linkedViewParts.join(' · ')}>{linkedViewParts.join(' · ')}</small></span>
          <button type="button" onClick={clearLinkedView}>Clear all</button>
        </div>}
        <nav className="mobile-tabs" role="tablist" aria-label="Result sections" onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const current = tabs.findIndex((tab) => tab.id === mobileTab);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          selectMobileTab(tabs[next].id);
        }}>
          {tabs.map((tab) => <button id={`mobile-tab-${tab.id}`} type="button" role="tab" aria-selected={mobileTab === tab.id} aria-controls={`mobile-panel-${tab.id}`} tabIndex={mobileTab === tab.id ? 0 : -1} className={mobileTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => selectMobileTab(tab.id)}>{tab.label}</button>)}
        </nav>
        <div className="mobile-tab-content">
          <section id="mobile-panel-structure" role="tabpanel" aria-labelledby="mobile-tab-structure" hidden={mobileTab !== 'structure'}>{mobileTab === 'structure' && <Inspector summary={prediction.summary} chains={result.chains} visibleChains={visibleChains} onSetChainVisibility={setChainVisibility} notices={result.notices} />}</section>
          <section id="mobile-panel-pae" role="tabpanel" aria-labelledby="mobile-tab-pae" hidden={mobileTab !== 'pae'}>{mobileTab === 'pae' && <PaeHeatmap pae={prediction.confidence?.pae} chainIds={prediction.confidence?.tokenChainIds} tokenResidues={prediction.confidence?.tokenResidues} selection={selection} selectionStats={analysisFacts.selection} onSelection={setSelection} selectionLabel={selectionLabel} primaryLabel={prediction.label} comparison={comparePrediction ? { label: comparePrediction.label, pae: comparePrediction.confidence?.pae, chainIds: comparePrediction.confidence?.tokenChainIds, tokenResidues: comparePrediction.confidence?.tokenResidues, selectionStats: comparisonFacts?.selection } : undefined} compact />}</section>
          <section id="mobile-panel-models" role="tabpanel" aria-labelledby="mobile-tab-models" hidden={mobileTab !== 'models'}>
            {mobileTab === 'models' && <div className="mobile-models-panel">
              {comparePrediction && <ComparisonSummary id="mobile-comparison-summary" primary={prediction} comparison={comparePrediction} primarySelection={analysisFacts.selection} comparisonSelection={comparisonFacts?.selection} onClose={() => setCompareId(undefined)} />}
              <PredictionRail predictions={result.predictions} selectedId={prediction.id} compareId={comparePrediction?.id} onSelect={selectPrediction} onCompare={setCompareId} onOpen={showOpenDialog} />
            </div>}
          </section>
          <section id="mobile-panel-insights" role="tabpanel" aria-labelledby="mobile-tab-insights" hidden={mobileTab !== 'insights'}>{mobileTab === 'insights' && <WorkspaceInspector tab={inspectorTab} onTabChange={setInspectorTab} prediction={prediction} chains={result.chains} visibleChains={visibleChains} onSetChainVisibility={setChainVisibility} notices={result.notices} onAction={runEvidenceAction} />}</section>
        </div>
        <button className="mobile-open" type="button" onClick={showOpenDialog}><Icon name="file" />Open another result</button>
      </main>}
      </>}

      {dragging && <div className="drop-overlay"><Icon name="folder" size={42} /><strong>Drop AlphaFold 3 output</strong><span>ZIP, folder contents, CIF, or confidence JSON</span></div>}
      {toast && <div className="toast" role="status" aria-live="polite"><Icon name="check" />{toast}</div>}
      <OpenResultDialog open={dialogOpen} busy={busy} error={error} preview={pendingResult} onClose={() => { setDialogOpen(false); setPendingResult(undefined); setPendingView(undefined); setError(undefined); }} onFiles={(files) => void openFiles(files)} onConfirm={confirmImport} onBack={() => { setPendingResult(undefined); setPendingView(undefined); setError(undefined); }} />
    </div>
    </AssistantSessionProvider>
  );
}
