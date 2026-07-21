import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AF3Confidence, ChainInfo, DomainRegion, FocusMode, ResidueRange } from '../types/af3';
import type { LigandFocus } from '../lib/focusMode';
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
  if (!ligandFocus?.chainIds.length && !ligandFocus?.residueNames.length) return null;
  const identifiers = [
    ...ligandFocus.chainIds.map((chain) => ({ chain })),
    ...ligandFocus.residueNames.map((resn) => ({ resn })),
  ];
  const target = { model: 0, hetflag: true, not: { resn: WATER_RESIDUES }, or: identifiers };
  const residues = { model: 0, hetflag: false, byres: true, within: { distance: 5, sel: target } };
  return { target, residues, zoom: { or: [target, residues] } };
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

export function MoleculeViewer({ cif, confidence, compareCif, compareLabel, chains, visibleChains, colorMode, surface, surfaceOnly = false, onSurfaceOnly, focusMode = 'all', interfaceChains, interfaceScore, ligandFocus, domains = EMPTY_DOMAINS, selectedDomainId, onSelectDomain, highlightedChain, highlightedResidues = [], highlightedLabel, resetSignal }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const threeDmolRef = useRef<any>(null);
  const surfaceRunRef = useRef(0);
  const [loading, setLoading] = useState(true);
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
  const interfaceChainA = interfaceChains?.[0];
  const interfaceChainB = interfaceChains?.[1];
  const interfaceFocus = useMemo(
    () => interfaceSelections(interfaceChainA && interfaceChainB ? [interfaceChainA, interfaceChainB] : undefined),
    [interfaceChainA, interfaceChainB],
  );
  const pocketFocus = useMemo(() => pocketSelections(ligandFocus), [ligandFocus]);

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

  const applyStyle = useCallback(() => {
    void viewerReady;
    const viewer = viewerRef.current;
    if (!viewer) return;
    const surfaceRun = ++surfaceRunRef.current;
    const surfaceTasks: Promise<unknown>[] = [];
    const hideCartoon = surface && surfaceOnly;
    const focusedInterfaceChains = new Set([interfaceChainA, interfaceChainB].filter((chain): chain is string => Boolean(chain)));
    viewer.removeAllSurfaces();
    setSurfaceStatus(surface ? 'building' : 'idle');
    viewer.setStyle({}, {});
    chains.filter((chain) => chain.kind !== 'ligand').forEach((chain, index) => {
      if (!visibleChains.has(chain.id)) return;
      const chainColor = highlightedChain === chain.id ? '#f7f4d1' : chain.color;
      const focusOpacity = focusMode === 'all' ? 1 : focusMode === 'interface' && focusedInterfaceChains.has(chain.id) ? 0.52 : focusMode === 'domains' ? 0.08 : 0.15;
      const cartoon = colorMode === 'confidence'
        ? { opacity: focusOpacity, colorfunc: (atom: { b?: number; chain?: string; resi?: number | string }) => confidenceColor(confidenceMaps.byResidue.get(`${atom.chain}:${atom.resi}`) ?? confidenceMaps.byChain.get(atom.chain ?? '') ?? atom.b ?? 82) }
        : { opacity: focusOpacity, color: chainColor };
      if (!hideCartoon) viewer.setStyle({ model: 0, chain: chain.id, hetflag: false }, { cartoon });
      if (surface && index < 3) {
        surfaceTasks.push(Promise.resolve(viewer.addSurface(
          threeDmolRef.current.SurfaceType.VDW,
          { opacity: 0.46, color: chainColor },
          { model: 0, chain: chain.id, hetflag: false },
        )));
      }
    });
    viewer.setStyle({ model: 0, hetflag: true }, {});
    const ligandVisible = chains.some((chain) => chain.kind === 'ligand' && visibleChains.has(chain.id));
    if (ligandVisible && pocketFocus) {
      viewer.setStyle(pocketFocus.target, { stick: { radius: 0.2, colorscheme: 'Jmol' }, sphere: { scale: 0.22, colorscheme: 'Jmol' } });
    }
    if (focusMode === 'interface' && interfaceFocus && !hideCartoon) {
      viewer.setStyle(interfaceFocus.residues, {
        cartoon: { opacity: 0.95, colorfunc: (atom: { chain?: string; resi?: number | string }) => confidenceColor(confidenceMaps.byResidue.get(`${atom.chain}:${atom.resi}`) ?? confidenceMaps.byChain.get(atom.chain ?? '') ?? 82) },
        stick: { radius: 0.17, colorfunc: (atom: { chain?: string; resi?: number | string }) => confidenceColor(confidenceMaps.byResidue.get(`${atom.chain}:${atom.resi}`) ?? confidenceMaps.byChain.get(atom.chain ?? '') ?? 82) },
      });
      setFocusDetails(summarizeFocus(viewer.selectedAtoms(interfaceFocus.residues)));
    } else if (focusMode === 'pocket' && pocketFocus && !hideCartoon) {
      viewer.setStyle(pocketFocus.residues, {
        cartoon: { opacity: 0.95, colorfunc: (atom: { chain?: string; resi?: number | string }) => confidenceColor(confidenceMaps.byResidue.get(`${atom.chain}:${atom.resi}`) ?? confidenceMaps.byChain.get(atom.chain ?? '') ?? 82) },
        stick: { radius: 0.17, colorfunc: (atom: { chain?: string; resi?: number | string }) => confidenceColor(confidenceMaps.byResidue.get(`${atom.chain}:${atom.resi}`) ?? confidenceMaps.byChain.get(atom.chain ?? '') ?? 82) },
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
      viewer.setStyle({ model: 1, hetflag: false }, { cartoon: { color: '#f0b455', opacity: 0.52 } });
      viewer.setStyle({ model: 1, hetflag: true }, { stick: { color: '#f0b455', radius: 0.12, opacity: 0.5 } });
    }
    viewer.render();
    if (surfaceTasks.length > 0) {
      void Promise.all(surfaceTasks).then(() => {
        if (surfaceRun !== surfaceRunRef.current || viewer !== viewerRef.current) return;
        viewer.render();
        setSurfaceStatus('ready');
      }).catch(() => {
        if (surfaceRun !== surfaceRunRef.current || viewer !== viewerRef.current) return;
        setSurfaceStatus('error');
      });
    } else if (surface) {
      setSurfaceStatus('error');
    }
  }, [chains, colorMode, compareCif, confidenceMaps, domains, focusMode, highlightedChain, highlightedResidues, interfaceChainA, interfaceChainB, interfaceFocus, pocketFocus, selectedDomainId, summarizeFocus, surface, surfaceOnly, viewerReady, visibleChains]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    setLoading(true);
    host.innerHTML = '';
    if (!cif) return () => { cancelled = true; };
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
      } finally {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
    return () => {
      cancelled = true;
      surfaceRunRef.current += 1;
      viewerRef.current = null;
      threeDmolRef.current = null;
      host.innerHTML = '';
    };
  }, [cif, compareCif]);

  useEffect(() => { applyStyle(); }, [applyStyle]);

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

  return (
    <div className="molecule-host-wrap">
      <div className="molecule-host" ref={hostRef} aria-label="Interactive three-dimensional molecular structure" />
      {loading && <div className="viewer-loading"><span />Rendering structure…</div>}
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
        <span><i />{focusMode === 'interface' ? `Interface ${interfaceChains?.join('–') ?? ''}` : `Ligand pocket · ${ligandFocus?.label ?? 'ligand'}`}</span>
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
      {((colorMode === 'confidence' && focusMode === 'all') || focusMode === 'interface' || focusMode === 'pocket') && !(surface && surfaceOnly) && <div className="plddt-legend" aria-label="pLDDT confidence color legend. Confidence is not experimental validation.">
        <strong>pLDDT confidence</strong>
        <span><i className="very-high" /><b>Very high</b><small>90+</small></span>
        <span><i className="confident" /><b>Confident</b><small>70–89</small></span>
        <span><i className="low" /><b>Low</b><small>50–69</small></span>
        <span><i className="very-low" /><b>Very low</b><small>&lt;50</small></span>
      </div>}
      {compareCif && <div className="viewer-compare-legend"><i />Overlay: {compareLabel ?? 'comparison model'}</div>}
      <div className="viewer-hint">Drag to rotate · Scroll to zoom</div>
    </div>
  );
}
