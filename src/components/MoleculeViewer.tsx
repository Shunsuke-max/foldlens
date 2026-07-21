import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AF3Confidence, ChainInfo, DomainRegion, FocusMode, ResidueRange } from '../types/af3';
import { ligandFocusFromChains, type LigandFocus } from '../lib/focusMode';
import { DomainLegend } from './DomainLegend';
import type { ColorMode } from './ViewerToolbar';

type Props = {
  cif: string;
  confidence?: AF3Confidence;
  compareCif?: string;
  compareLabel?: string;
  chains: ChainInfo[];
  visibleChains: Set<string>;
  colorMode: ColorMode;
  brightness?: number;
  surface: boolean;
  surfaceOnly?: boolean;
  onSurfaceOnly?: (surfaceOnly: boolean) => void;
  focusMode?: FocusMode;
  interfaceChains?: [string, string];
  interfaceScore?: number | null;
  ligandFocus?: LigandFocus;
  domains?: DomainRegion[];
  selectedDomainId?: string;
  onSelectDomain?: (domainId?: string) => void;
  highlightedChain?: string;
  highlightedResidues?: ResidueRange[];
  highlightedLabel?: string;
  resetSignal: number;
};

type FocusDetails = {
  residueCount: number;
  meanPlddt: number | null;
};

const WATER_RESIDUES = ['HOH', 'WAT', 'DOD'];
const EMPTY_DOMAINS: DomainRegion[] = [];
const SURFACE_OVERLAY_OPACITY = 0.46;
const SURFACE_ONLY_OPACITY = 0.78;

function interfaceSelections(interfaceChains?: [string, string]) {
  if (!interfaceChains) return null;
  const [chainA, chainB] = interfaceChains;
  const chainAContacts = { model: 0, chain: chainA, hetflag: false, byres: true, within: { distance: 5, sel: { model: 0, chain: chainB, hetflag: false } } };
  const chainBContacts = { model: 0, chain: chainB, hetflag: false, byres: true, within: { distance: 5, sel: { model: 0, chain: chainA, hetflag: false } } };
  return {
    residues: { or: [chainAContacts, chainBContacts] },
    fallback: { model: 0, chain: [chainA, chainB], hetflag: false },
  };
}

function pocketSelections(ligandFocus?: LigandFocus) {
  if (!ligandFocus?.structureChainIds.length && !ligandFocus?.residueNames.length) return null;
  const identifiers = [
    ...ligandFocus.structureChainIds.map((chain) => ({ chain })),
    ...ligandFocus.residueNames.map((resn) => ({ resn })),
  ];
  const target = { model: 0, hetflag: true, not: { resn: WATER_RESIDUES }, or: identifiers };
  const residues = { model: 0, hetflag: false, byres: true, within: { distance: 5, sel: target } };
  return { target, residues, zoom: { or: [target, residues] } };
}

type LigandAtom = {
  x?: number;
  y?: number;
  z?: number;
  chain?: string;
  resi?: number | string;
  resn?: string;
};

function addLigandLabels(viewer: any, atoms: LigandAtom[]) {
  const groups = new Map<string, LigandAtom[]>();
  atoms.forEach((atom) => {
    if (!atom.resn || WATER_RESIDUES.includes(atom.resn.toUpperCase())) return;
    const key = `${atom.resn}:${atom.chain ?? ''}:${atom.resi ?? ''}`;
    groups.set(key, [...(groups.get(key) ?? []), atom]);
  });
  [...groups.values()].slice(0, 12).forEach((group) => {
    const positioned = group.filter((atom) => Number.isFinite(atom.x) && Number.isFinite(atom.y) && Number.isFinite(atom.z));
    if (!positioned.length) return;
    const anchor = positioned[0];
    const position = positioned.reduce<{ x: number; y: number; z: number }>((center, atom) => ({
      x: center.x + Number(atom.x) / positioned.length,
      y: center.y + Number(atom.y) / positioned.length,
      z: center.z + Number(atom.z) / positioned.length,
    }), { x: 0, y: 0, z: 0 });
    const location = anchor.chain || anchor.resi !== undefined ? ` · ${anchor.chain ?? ''}${anchor.resi !== undefined ? `:${anchor.resi}` : ''}` : '';
    viewer.addLabel(`${anchor.resn}${location}`, {
      position,
      font: 'sans-serif',
      fontSize: 11,
      fontColor: '#fff2d6',
      backgroundColor: '#111c23',
      backgroundOpacity: 0.88,
      borderColor: '#f0b455',
      borderOpacity: 0.78,
      borderThickness: 1,
      padding: 3,
      inFront: true,
    }, undefined, true);
  });
}

function domainSelection(domain: DomainRegion) {
  return { model: 0, chain: domain.chainId, hetflag: false, resi: `${domain.start}-${domain.end}` };
}

const confidenceColor = (value: number) => {
  if (value >= 90) return '#367de8';
  if (value >= 70) return '#42bdf5';
  if (value >= 50) return '#f0d64d';
  return '#f27d69';
};

export function MoleculeViewer({ cif, confidence, compareCif, compareLabel, chains, visibleChains, colorMode, brightness = 100, surface, surfaceOnly = false, onSurfaceOnly, focusMode = 'all', interfaceChains, interfaceScore, ligandFocus, domains = EMPTY_DOMAINS, selectedDomainId, onSelectDomain, highlightedChain, highlightedResidues = [], highlightedLabel, resetSignal }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();
  const viewerRef = useRef<any>(null);
  const threeDmolRef = useRef<any>(null);
  const renderRunRef = useRef(0);
  const [renderStatus, setRenderStatus] = useState<'model' | 'rendering' | 'surface' | null>('model');
  const [surfaceStatus, setSurfaceStatus] = useState<'idle' | 'building' | 'ready' | 'error'>('idle');
  const [viewerReady, setViewerReady] = useState(0);
  const [focusDetails, setFocusDetails] = useState<FocusDetails | null>(null);
  const zoomFactor = () => (hostRef.current?.clientWidth ?? 900) < 600 ? 2.5 : 1.85;
  const confidenceMaps = useMemo(() => {
    const residues = confidence?.tokenResidues;
    const values = confidence?.tokenPlddts;
    const byResidue = new Map<string, number>();
    const byChainValues = new Map<string, number[]>();
    if (residues && values && residues.length === values.length) {
      residues.forEach((residue, index) => {
        const value = values[index];
        if (!Number.isFinite(value)) return;
        byResidue.set(`${residue.chainId}:${residue.residueNumber ?? residue.residueId}`, value);
        const chainValues = byChainValues.get(residue.chainId) ?? [];
        chainValues.push(value);
        byChainValues.set(residue.chainId, chainValues);
      });
    }
    return {
      byResidue,
      byChain: new Map([...byChainValues].map(([chain, chainValues]) => [chain, chainValues.reduce((sum, value) => sum + value, 0) / chainValues.length])),
    };
  }, [confidence?.tokenPlddts, confidence?.tokenResidues]);
  const hasPlddt = confidenceMaps.byResidue.size > 0 || confidenceMaps.byChain.size > 0;
  const confidenceAtomColor = useCallback((atom: { chain?: string; resi?: number | string }) => {
    const value = confidenceMaps.byResidue.get(`${atom.chain}:${atom.resi}`) ?? confidenceMaps.byChain.get(atom.chain ?? '');
    return value === undefined ? '#8da0ad' : confidenceColor(value);
  }, [confidenceMaps]);
  const interfaceChainA = interfaceChains?.[0];
  const interfaceChainB = interfaceChains?.[1];
  const interfaceFocus = useMemo(
    () => interfaceSelections(interfaceChainA && interfaceChainB ? [interfaceChainA, interfaceChainB] : undefined),
    [interfaceChainA, interfaceChainB],
  );
  const visibleLigandFocus = useMemo(
    () => ligandFocusFromChains(chains.filter((chain) => visibleChains.has(chain.id))),
    [chains, visibleChains],
  );
  const pocketFocus = useMemo(() => pocketSelections(visibleLigandFocus), [visibleLigandFocus]);

  const summarizeFocus = useCallback((atoms: Array<{ chain?: string; resi?: number | string }>) => {
    const residues = new Map<string, { chain: string; residue: number | string }>();
    atoms.forEach((atom) => {
      if (atom.chain === undefined || atom.resi === undefined) return;
      residues.set(`${atom.chain}:${atom.resi}`, { chain: atom.chain, residue: atom.resi });
    });
    const values = [...residues.values()].map(({ chain, residue }) => (
      confidenceMaps.byResidue.get(`${chain}:${residue}`) ?? confidenceMaps.byChain.get(chain)
    )).filter((value): value is number => value !== undefined && Number.isFinite(value));
    return {
      residueCount: residues.size,
      meanPlddt: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    };
  }, [confidenceMaps]);

  const applyStyle = useCallback((renderRun: number) => {
    void viewerReady;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const finishRendering = () => {
      if (renderRun === renderRunRef.current && viewer === viewerRef.current) setRenderStatus(null);
    };
    const surfaceTasks: Promise<unknown>[] = [];
    const hideCartoon = surface && surfaceOnly;
    const focusedInterfaceChains = new Set([interfaceChainA, interfaceChainB].filter((chain): chain is string => Boolean(chain)));
    try {
    viewer.removeAllSurfaces();
    viewer.removeAllLabels();
    setSurfaceStatus(surface ? 'building' : 'idle');
    viewer.setStyle({}, {});
    chains.filter((chain) => chain.kind !== 'ligand' && visibleChains.has(chain.id)).forEach((chain, index) => {
      const chainColor = highlightedChain === chain.id ? '#f7f4d1' : chain.color;
      const focusOpacity = focusMode === 'all' ? 1 : focusMode === 'interface' && focusedInterfaceChains.has(chain.id) ? 0.52 : focusMode === 'domains' ? 0.08 : 0.15;
      const cartoon = colorMode === 'confidence'
        ? { opacity: focusOpacity, colorfunc: confidenceAtomColor }
        : { opacity: focusOpacity, color: chainColor };
      if (!hideCartoon) viewer.setStyle({ model: 0, chain: chain.id, hetflag: false }, { cartoon });
      if (surface && index < 3) {
        surfaceTasks.push(Promise.resolve(viewer.addSurface(
          threeDmolRef.current.SurfaceType.VDW,
          { opacity: surfaceOnly ? SURFACE_ONLY_OPACITY : SURFACE_OVERLAY_OPACITY, color: chainColor },
          { model: 0, chain: chain.id, hetflag: false },
        )));
      }
    });
    viewer.setStyle({ model: 0, hetflag: true }, {});
    if (pocketFocus) {
      viewer.setStyle(pocketFocus.target, { stick: { radius: 0.2, colorscheme: 'Jmol' }, sphere: { scale: 0.22, colorscheme: 'Jmol' } });
      addLigandLabels(viewer, viewer.selectedAtoms(pocketFocus.target));
    }
    if (focusMode === 'interface' && interfaceFocus && !hideCartoon) {
      viewer.setStyle(interfaceFocus.residues, {
        cartoon: { opacity: 0.95, colorfunc: confidenceAtomColor },
        stick: { radius: 0.17, colorfunc: confidenceAtomColor },
      });
      setFocusDetails(summarizeFocus(viewer.selectedAtoms(interfaceFocus.residues)));
    } else if (focusMode === 'pocket' && pocketFocus && !hideCartoon) {
      viewer.setStyle(pocketFocus.residues, {
        cartoon: { opacity: 0.95, colorfunc: confidenceAtomColor },
        stick: { radius: 0.17, colorfunc: confidenceAtomColor },
      });
      viewer.setStyle(pocketFocus.target, { stick: { radius: 0.24, colorscheme: 'Jmol' }, sphere: { scale: 0.28, colorscheme: 'Jmol' } });
      setFocusDetails(summarizeFocus(viewer.selectedAtoms(pocketFocus.residues)));
    } else if (focusMode === 'domains' && domains.length && !hideCartoon) {
      domains.filter((domain) => visibleChains.has(domain.chainId)).forEach((domain) => {
        const selected = !selectedDomainId || selectedDomainId === domain.id;
        viewer.setStyle(domainSelection(domain), { cartoon: { color: domain.color, opacity: selected ? 0.96 : 0.1 } });
      });
      setFocusDetails(null);
    } else {
      setFocusDetails(null);
    }
    if (!hideCartoon) {
      highlightedResidues.forEach((range) => {
        const residues = Array.from({ length: Math.min(1000, range.end - range.start + 1) }, (_, index) => range.start + index);
        const style = range.end - range.start > 24
          ? { cartoon: { color: '#f6c647' } }
          : { cartoon: { color: '#f6c647' }, stick: { color: '#ffd66b', radius: 0.16 } };
        viewer.setStyle({ model: 0, chain: range.chainId, resi: residues }, style);
      });
    }
    if (compareCif && !hideCartoon) {
      chains.filter((chain) => visibleChains.has(chain.id)).forEach((chain) => {
        if (chain.kind === 'ligand') viewer.setStyle({ model: 1, chain: chain.id, hetflag: true }, { stick: { color: '#f0b455', radius: 0.12, opacity: 0.5 } });
        else viewer.setStyle({ model: 1, chain: chain.id, hetflag: false }, { cartoon: { color: '#f0b455', opacity: 0.52 } });
      });
    }
    viewer.render();
    if (surfaceTasks.length > 0) {
      void Promise.all(surfaceTasks).then(() => {
        if (renderRun !== renderRunRef.current || viewer !== viewerRef.current) return;
        viewer.render();
        setSurfaceStatus('ready');
        finishRendering();
      }).catch(() => {
        if (renderRun !== renderRunRef.current || viewer !== viewerRef.current) return;
        setSurfaceStatus('error');
        finishRendering();
      });
    } else if (surface) {
      setSurfaceStatus('error');
      finishRendering();
    } else {
      finishRendering();
    }
    } catch {
      if (surface) setSurfaceStatus('error');
      finishRendering();
    }
  }, [chains, colorMode, compareCif, confidenceAtomColor, domains, focusMode, highlightedChain, highlightedResidues, interfaceChainA, interfaceChainB, interfaceFocus, pocketFocus, selectedDomainId, summarizeFocus, surface, surfaceOnly, viewerReady, visibleChains]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    renderRunRef.current += 1;
    setRenderStatus('model');
    host.innerHTML = '';
    if (!cif) {
      setRenderStatus(null);
      return () => { cancelled = true; };
    }
    void import('3dmol').then((ThreeDmol) => {
      if (cancelled) return;
      threeDmolRef.current = ThreeDmol;
      const viewer = (ThreeDmol as any).createViewer(host, { backgroundColor: '#07131d', antialias: true });
      viewerRef.current = viewer;
      try {
        viewer.addModel(cif, 'cif');
        if (compareCif) viewer.addModel(compareCif, 'cif');
        viewer.zoomTo();
        viewer.zoom(zoomFactor(), 0);
        viewer.setProjection('orthographic');
        viewer.setBackgroundColor('#07131d', 1);
        setViewerReady((value) => value + 1);
      } catch {
        setRenderStatus(null);
      }
    }).catch(() => {
      if (!cancelled) setRenderStatus(null);
    });
    return () => {
      cancelled = true;
      renderRunRef.current += 1;
      viewerRef.current = null;
      threeDmolRef.current = null;
      host.innerHTML = '';
    };
  }, [cif, compareCif]);

  useEffect(() => {
    if (!viewerRef.current) return;
    const renderRun = ++renderRunRef.current;
    setRenderStatus(surface ? 'surface' : 'rendering');
    if (surface) setSurfaceStatus('building');
    let renderFrame: number | undefined;
    // Allow the loading state to paint before 3Dmol starts synchronous WebGL work.
    const paintFrame = window.requestAnimationFrame(() => {
      renderFrame = window.requestAnimationFrame(() => applyStyle(renderRun));
    });
    return () => {
      window.cancelAnimationFrame(paintFrame);
      if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
    };
  }, [applyStyle, surface]);

  const zoomToFocus = useCallback(() => {
    void viewerReady;
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (focusMode === 'interface' && interfaceFocus) {
      const contactAtoms = viewer.selectedAtoms(interfaceFocus.residues);
      viewer.zoomTo(contactAtoms.length ? interfaceFocus.residues : interfaceFocus.fallback);
      viewer.zoom(1.45, 0);
    } else if (focusMode === 'pocket' && pocketFocus) {
      viewer.zoomTo(pocketFocus.zoom);
      viewer.zoom(1.55, 0);
    } else if (focusMode === 'domains' && domains.length) {
      const selected = domains.find((domain) => domain.id === selectedDomainId);
      viewer.zoomTo(selected ? domainSelection(selected) : { or: domains.map(domainSelection) });
      viewer.zoom(selected ? 1.6 : 1.25, 0);
    } else {
      viewer.zoomTo();
      viewer.zoom(zoomFactor(), 0);
    }
    viewer.render();
  }, [domains, focusMode, interfaceFocus, pocketFocus, selectedDomainId, viewerReady]);

  useEffect(() => { zoomToFocus(); }, [zoomToFocus]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    zoomToFocus();
  }, [resetSignal, zoomToFocus]);

  useEffect(() => {
    const onResize = () => viewerRef.current?.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleViewerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const rotations: Record<string, [number, string]> = {
      ArrowLeft: [-8, 'y'], ArrowRight: [8, 'y'], ArrowUp: [-8, 'x'], ArrowDown: [8, 'x'],
    };
    const rotation = rotations[event.key];
    if (rotation) viewer.rotate(rotation[0], rotation[1]);
    else if (event.key === '+' || event.key === '=') viewer.zoom(1.12);
    else if (event.key === '-' || event.key === '_') viewer.zoom(0.88);
    else if (event.key === 'Home') zoomToFocus();
    else return;
    event.preventDefault();
    viewer.render();
  };

  const renderMessage = renderStatus === 'model'
    ? ['Loading structure…', 'Preparing the 3D viewer']
    : renderStatus === 'surface'
      ? ['Building molecular surface…', 'Large structures may take a moment']
      : ['Rendering structure…', 'Applying the current view settings'];

  return (
    <div className="molecule-host-wrap" aria-busy={renderStatus !== null}>
      <div
        className="molecule-host"
        ref={hostRef}
        tabIndex={0}
        aria-label="Interactive three-dimensional molecular structure"
        aria-describedby={instructionsId}
        onKeyDown={handleViewerKeyDown}
        style={{ '--structure-brightness': `${Math.min(140, Math.max(60, brightness))}%` } as CSSProperties}
      />
      <span className="sr-only" id={instructionsId}>Use arrow keys to rotate, plus and minus to zoom, and Home to reset the structure view.</span>
      {renderStatus && <div className={`viewer-loading ${renderStatus === 'model' ? 'initial' : 'overlay'}`} role="status" aria-live="polite">
        <span />
        <strong>{renderMessage[0]}</strong>
        <small>{renderMessage[1]}</small>
      </div>}
      {surface && <div className={`surface-status ${surfaceStatus}`}>
        <span className="surface-state" role="status" aria-live="polite">
          <i />
          {surfaceStatus === 'building' && 'Building surface…'}
          {surfaceStatus === 'ready' && 'Surface ready'}
          {surfaceStatus === 'error' && 'Surface unavailable'}
        </span>
        {surfaceStatus !== 'error' && onSurfaceOnly && <div className="surface-mode-switch" role="group" aria-label="Surface display mode">
          <button type="button" aria-pressed={!surfaceOnly} onClick={() => onSurfaceOnly(false)}>Overlay</button>
          <button type="button" aria-pressed={surfaceOnly} onClick={() => onSurfaceOnly(true)}>Surface only</button>
        </div>}
      </div>}
      {(focusMode === 'interface' || focusMode === 'pocket') && <div className="focus-readout" role="status" aria-live="polite">
        <span><i />{focusMode === 'interface' ? `Interface ${interfaceChains?.join('–') ?? ''}` : `Ligand pocket · ${visibleLigandFocus.label ?? ligandFocus?.label ?? 'ligand'}`}</span>
        <strong>{focusDetails?.residueCount ?? 0} contact residues</strong>
        <small>
          ≤5 Å geometry
          {focusMode === 'interface' && interfaceScore !== null && interfaceScore !== undefined ? ` · ipTM ${interfaceScore.toFixed(2)}` : ''}
          {focusDetails?.meanPlddt !== null && focusDetails?.meanPlddt !== undefined ? ` · mean pLDDT ${Math.round(focusDetails.meanPlddt)}` : ' · pLDDT unavailable'}
        </small>
      </div>}
      {highlightedResidues.length > 0 && <div className={`pae-structure-readout ${focusMode === 'interface' || focusMode === 'pocket' ? 'with-focus' : ''}`} role="status" aria-live="polite">
        <span><i />PAE-selected residues</span>
        <strong>{highlightedLabel ?? `${highlightedResidues.length} ranges`}</strong>
        <small>Amber highlight · separate from ≤5 Å contact geometry</small>
      </div>}
      {focusMode === 'domains' && domains.length > 0 && onSelectDomain && <DomainLegend domains={domains} selectedDomainId={selectedDomainId} onSelect={onSelectDomain} />}
      {hasPlddt && ((colorMode === 'confidence' && focusMode === 'all') || focusMode === 'interface' || focusMode === 'pocket') && !(surface && surfaceOnly) && <div className="plddt-legend" aria-label="pLDDT confidence color legend. Confidence is not experimental validation.">
        <strong>pLDDT confidence</strong>
        <span><i className="very-high" /><b>Very high</b><small>90+</small></span>
        <span><i className="confident" /><b>Confident</b><small>70–89</small></span>
        <span><i className="low" /><b>Low</b><small>50–69</small></span>
        <span><i className="very-low" /><b>Very low</b><small>&lt;50</small></span>
      </div>}
      {compareCif && <div className="viewer-compare-legend"><i />Overlay: {compareLabel ?? 'comparison model'}</div>}
      <div className="viewer-hint">Drag or arrow keys to rotate · Scroll or +/− to zoom</div>
    </div>
  );
}
