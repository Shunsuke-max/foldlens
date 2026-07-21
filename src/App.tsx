import { useMemo, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { ComparisonSummary } from './components/ComparisonSummary';
import { FocusModeControl } from './components/FocusModeControl';
import { Inspector } from './components/Inspector';
import { MoleculeViewer } from './components/MoleculeViewer';
import { OpenResultDialog } from './components/OpenResultDialog';
import { PaeHeatmap } from './components/PaeHeatmap';
import { PredictionRail } from './components/PredictionRail';
import { ScoreStrip } from './components/ScoreStrip';
import { ViewerToolbar, type ColorMode } from './components/ViewerToolbar';
import { WorkspaceInspector } from './components/WorkspaceInspector';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Icon } from './components/Icon';
import { buildAnalysisFacts, interfaceSelection, rangesSelection, selectionResidueRanges } from './lib/analysis';
import { parseFiles } from './lib/af3Parser';
import { buildHtmlReport, createSession, downloadHtmlReport, downloadSession, parseSessionFile } from './lib/export';
import { demoResult, loadDemoResult } from './lib/demo';
import { inferDomains } from './lib/domains';
import { ligandFocusFromChains } from './lib/focusMode';
import { colorModeAfterClick } from './lib/viewMode';
import type { AF3Result, FocusMode, FoldLensViewState, Selection } from './types/af3';
import type { EvidenceAction } from './types/analysis';

type MobileTab = 'structure' | 'pae' | 'models' | 'insights';

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
  const [result, setResult] = useState<AF3Result>(demoResult);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(demoResult.predictions[0].id);
  const [compareId, setCompareId] = useState<string>();
  const [visibleChains, setVisibleChains] = useState(() => new Set(demoResult.chains.map((chain) => chain.id)));
  const [colorMode, setColorMode] = useState<ColorMode>('chains');
  const [surface, setSurface] = useState(false);
  const [surfaceOnly, setSurfaceOnly] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<string>();
  const [selection, setSelection] = useState<Selection>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [mobileTab, setMobileTab] = useState<MobileTab>('structure');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string>();
  const [pendingResult, setPendingResult] = useState<AF3Result>();
  const [pendingView, setPendingView] = useState<FoldLensViewState>();

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
  const ligandFocus = useMemo(() => ligandFocusFromChains(result.chains), [result.chains]);
  const interfaceChains = analysisFacts.primaryInterface
    ? [analysisFacts.primaryInterface.chainA, analysisFacts.primaryInterface.chainB] as [string, string]
    : undefined;
  const domainSource = domains.every((domain) => domain.source === 'pae') ? 'pae'
    : domains.some((domain) => domain.source === 'pae') ? 'mixed' : 'annotation';

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

  const confirmImport = () => {
    if (!pendingResult) return;
    const defaultId = pendingResult.predictions[0].id;
    const selected = pendingResult.predictions.some((item) => item.id === pendingView?.selectedId) ? pendingView!.selectedId : defaultId;
    const chainIds = new Set(pendingResult.chains.map((chain) => chain.id));
    const visible = pendingView?.visibleChains.filter((id) => chainIds.has(id));
    setResult(pendingResult);
    setSelectedId(selected);
    setCompareId(pendingResult.predictions.some((item) => item.id === pendingView?.compareId && item.id !== selected) ? pendingView?.compareId : undefined);
    setVisibleChains(new Set(visible?.length ? visible : pendingResult.chains.map((chain) => chain.id)));
    setColorMode(pendingView?.colorMode ?? 'chains');
    setSelection(pendingView?.selection ?? null);
    setSurface(pendingView?.surface ?? false);
    setSurfaceOnly(pendingView?.surfaceOnly ?? false);
    setFocusMode(pendingView?.focusMode ?? 'all');
    setSelectedDomainId(pendingView?.selectedDomainId);
    setPendingResult(undefined);
    setPendingView(undefined);
    setDialogOpen(false);
    setWorkspaceOpen(true);
    setToast(`${pendingResult.predictions.length} prediction${pendingResult.predictions.length === 1 ? '' : 's'} opened locally`);
    window.setTimeout(() => setToast(undefined), 3200);
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
      setSurface(false);
      setSurfaceOnly(false);
      setFocusMode('all');
      setSelectedDomainId(undefined);
      setSelection(null);
      setWorkspaceOpen(true);
    } catch {
      setToast('The sample structure could not be loaded. Open a local AF3 result to continue.');
      window.setTimeout(() => setToast(undefined), 3200);
    } finally {
      setDemoBusy(false);
    }
  };

  const toggleChain = (id: string) => {
    setVisibleChains((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectColorMode = (mode: ColorMode) => {
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
    const mobile = window.matchMedia('(max-width: 820px)').matches;
    const html = buildHtmlReport({
      result, prediction, facts: analysisFacts, selectionLabel,
      structureImage: canvasImage(mobile ? '.mobile-viewer .molecule-host canvas' : '.viewer-pane .molecule-host canvas'),
      paeImage: canvasImage(mobile ? '.pae-panel.compact canvas' : '.desktop-workspace .pae-panel canvas'),
    });
    downloadHtmlReport(result.jobName, html);
    setToast('Confidence report exported');
    window.setTimeout(() => setToast(undefined), 3200);
  };

  const saveSession = () => {
    downloadSession(createSession(result, { selectedId: prediction.id, compareId: comparePrediction?.id, visibleChains: [...visibleChains], colorMode, surface, surfaceOnly, focusMode, selectedDomainId, selection }));
    setToast('Resumable FoldLens session saved');
    window.setTimeout(() => setToast(undefined), 3200);
  };

  const selectPrediction = (id: string) => {
    setSelectedId(id);
    if (compareId === id) setCompareId(undefined);
    setSelection(null);
    setFocusMode('all');
    setSelectedDomainId(undefined);
  };

  const runEvidenceAction = (action: EvidenceAction) => {
    let nextSelection: Selection = null;
    if (action.type === 'show_interface' && action.chainIds.length >= 2) {
      nextSelection = interfaceSelection(prediction, action.chainIds[0], action.chainIds[1]);
      setFocusMode('interface');
      setSurface(false);
      setSurfaceOnly(false);
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

  const tabs: { id: MobileTab; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'pae', label: 'PAE' },
    { id: 'models', label: 'Models' },
    { id: 'insights', label: 'Insights' },
  ];

  return (
    <div
      className="app"
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={(event) => { event.preventDefault(); setDragging(false); void openFiles(Array.from(event.dataTransfer.files)); }}
    >
      {!workspaceOpen ? <WelcomeScreen demoBusy={demoBusy} onFiles={(files) => void openFiles(files)} onDemo={() => void openDemo()} /> : <>
      <AppHeader jobName={result.jobName} isDemo={result.isDemo} onOpen={() => { setError(undefined); setPendingResult(undefined); setPendingView(undefined); setDialogOpen(true); }} onExportReport={exportReport} onSaveSession={saveSession} />

      <main className="desktop-workspace">
        <div className="workspace-main">
          <PredictionRail predictions={result.predictions} selectedId={prediction.id} compareId={comparePrediction?.id} onSelect={selectPrediction} onCompare={setCompareId} onOpen={() => setDialogOpen(true)} />
          <section className="viewer-pane">
            <ViewerToolbar
              colorMode={colorMode}
              surface={surface}
              surfaceOnly={surfaceOnly}
              colorModeSuppressed={focusMode === 'domains'}
              onColorMode={selectColorMode}
              onSurface={toggleSurface}
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
            {result.isDemo && <button className="demo-ribbon" type="button" onClick={() => setDialogOpen(true)}><strong>Sample data</strong><span>Confidence values are illustrative</span><b>Open your result</b></button>}
            {comparePrediction && <ComparisonSummary primary={prediction} comparison={comparePrediction} primarySelection={analysisFacts.selection} comparisonSelection={comparisonFacts?.selection} onClose={() => setCompareId(undefined)} />}
            <MoleculeViewer
              cif={prediction.cif}
              confidence={prediction.confidence}
              compareCif={comparePrediction?.cif}
              compareLabel={comparePrediction?.label}
              chains={result.chains}
              visibleChains={visibleChains}
              colorMode={colorMode}
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
          <WorkspaceInspector prediction={prediction} facts={analysisFacts} chains={result.chains} visibleChains={visibleChains} onToggleChain={toggleChain} notices={result.notices} focusMode={focusMode} onAction={runEvidenceAction} />
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
          comparison={comparePrediction ? { label: comparePrediction.label, pae: comparePrediction.confidence?.pae, selectionStats: comparisonFacts?.selection } : undefined}
        />
      </main>

      <main className="mobile-workspace">
        <section className="mobile-viewer">
          <div className="mobile-viewer-actions">
            <button className="icon-button" type="button" onClick={() => document.querySelector('.mobile-viewer')?.requestFullscreen?.()} aria-label="Expand structure"><Icon name="expand" /></button>
            <button className="icon-button" type="button" onClick={() => setResetSignal((value) => value + 1)} aria-label="Reset view"><Icon name="reset" /></button>
            <button className={`icon-button ${focusMode !== 'domains' && colorMode === 'chains' ? 'active' : ''}`} type="button" aria-pressed={focusMode !== 'domains' && colorMode === 'chains'} onClick={() => selectColorMode(colorMode === 'chains' ? 'confidence' : 'chains')} aria-label="Toggle chain and confidence coloring"><Icon name="palette" /></button>
          </div>
          <MoleculeViewer
            cif={prediction.cif}
            confidence={prediction.confidence}
            compareCif={comparePrediction?.cif}
            compareLabel={comparePrediction?.label}
            chains={result.chains}
            visibleChains={visibleChains}
            colorMode={colorMode}
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
          {result.isDemo && <button className="demo-ribbon" type="button" onClick={() => setDialogOpen(true)}><strong>Sample data</strong><span>Illustrative confidence</span><b>Open</b></button>}
          {comparePrediction && <ComparisonSummary primary={prediction} comparison={comparePrediction} primarySelection={analysisFacts.selection} comparisonSelection={comparisonFacts?.selection} onClose={() => setCompareId(undefined)} />}
        </section>
        <ScoreStrip summary={prediction.summary} compact />
        <nav className="mobile-tabs" aria-label="Result sections">
          {tabs.map((tab) => <button type="button" className={mobileTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setMobileTab(tab.id)}>{tab.label}</button>)}
        </nav>
        <div className="mobile-tab-content">
          {mobileTab === 'structure' && <Inspector summary={prediction.summary} chains={result.chains} visibleChains={visibleChains} onToggleChain={toggleChain} notices={result.notices} />}
          {mobileTab === 'pae' && <PaeHeatmap pae={prediction.confidence?.pae} chainIds={prediction.confidence?.tokenChainIds} tokenResidues={prediction.confidence?.tokenResidues} selection={selection} selectionStats={analysisFacts.selection} onSelection={setSelection} selectionLabel={selectionLabel} primaryLabel={prediction.label} comparison={comparePrediction ? { label: comparePrediction.label, pae: comparePrediction.confidence?.pae, selectionStats: comparisonFacts?.selection } : undefined} compact />}
          {mobileTab === 'models' && <PredictionRail predictions={result.predictions} selectedId={prediction.id} compareId={comparePrediction?.id} onSelect={selectPrediction} onCompare={setCompareId} onOpen={() => setDialogOpen(true)} />}
          {mobileTab === 'insights' && <WorkspaceInspector prediction={prediction} facts={analysisFacts} chains={result.chains} visibleChains={visibleChains} onToggleChain={toggleChain} notices={result.notices} focusMode={focusMode} onAction={runEvidenceAction} />}
        </div>
        <button className="mobile-open" type="button" onClick={() => setDialogOpen(true)}><Icon name="file" />Open another result</button>
      </main>
      </>}

      {dragging && <div className="drop-overlay"><Icon name="folder" size={42} /><strong>Drop AlphaFold 3 output</strong><span>ZIP, folder contents, CIF, or confidence JSON</span></div>}
      {toast && <div className="toast" role="status" aria-live="polite"><Icon name="check" />{toast}</div>}
      <OpenResultDialog open={dialogOpen} busy={busy} error={error} preview={pendingResult} onClose={() => { setDialogOpen(false); setPendingResult(undefined); setPendingView(undefined); }} onFiles={(files) => void openFiles(files)} onConfirm={confirmImport} onBack={() => { setPendingResult(undefined); setPendingView(undefined); setError(undefined); }} />
    </div>
  );
}
