import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Selection, TokenResidue } from '../types/af3';
import type { SelectionFact } from '../types/analysis';
import { Icon } from './Icon';

type PaeComparison = {
  label: string;
  pae?: number[][];
  chainIds?: string[];
  tokenResidues?: TokenResidue[];
  selectionStats?: SelectionFact | null;
};

type Props = {
  pae?: number[][];
  chainIds?: string[];
  tokenResidues?: TokenResidue[];
  selection: Selection;
  selectionStats?: SelectionFact | null;
  onSelection: (selection: Selection) => void;
  selectionLabel?: string;
  primaryLabel?: string;
  comparison?: PaeComparison;
  compact?: boolean;
};

type HeatmapMode = 'primary' | 'comparison' | 'difference';

const CIVIDIS_STOPS = [
  [0, 32, 76], [40, 60, 96], [80, 87, 111], [122, 116, 117], [168, 148, 108], [215, 183, 81], [255, 233, 69],
];

function paeColor(value: number, maxValue: number) {
  const t = Math.max(0, Math.min(1, value / maxValue));
  const scaled = t * (CIVIDIS_STOPS.length - 1);
  const index = Math.min(CIVIDIS_STOPS.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  return CIVIDIS_STOPS[index].map((component, channel) => Math.round(component + (CIVIDIS_STOPS[index + 1][channel] - component) * mix));
}

function boundaries(chainIds?: string[]) {
  if (!chainIds?.length) return [];
  const result: { index: number; id: string }[] = [{ index: 0, id: chainIds[0] }];
  for (let index = 1; index < chainIds.length; index += 1) {
    if (chainIds[index] !== chainIds[index - 1]) result.push({ index, id: chainIds[index] });
  }
  return result;
}

function matrixDifference(primary?: number[][], comparison?: number[][]) {
  if (!primary?.length || !comparison?.length || primary.length !== comparison.length) return undefined;
  if (primary.some((row, index) => row.length !== comparison[index]?.length)) return undefined;
  return primary.map((row, y) => row.map((value, x) => Math.abs(value - comparison[y][x])));
}

const metric = (value: number | null | undefined) => value === null || value === undefined ? '—' : `${value.toFixed(1)} Å`;

export function PaeHeatmap({
  pae,
  chainIds,
  tokenResidues,
  selection,
  selectionStats,
  onSelection,
  selectionLabel,
  primaryLabel = 'Current model',
  comparison,
  compact = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<HeatmapMode>('primary');
  const instructionsId = useId();
  const differencePae = useMemo(() => matrixDifference(pae, comparison?.pae), [comparison?.pae, pae]);
  const activeMode = comparison && (mode !== 'difference' || differencePae) ? mode : 'primary';
  const activePae = activeMode === 'comparison' ? comparison?.pae : activeMode === 'difference' ? differencePae : pae;
  const activeLabel = activeMode === 'comparison' ? comparison?.label ?? 'Comparison model' : activeMode === 'difference' ? '|ΔPAE|' : primaryLabel;
  const activeChainIds = activeMode === 'comparison' ? comparison?.chainIds : chainIds;
  const activeTokenResidues = activeMode === 'comparison' ? comparison?.tokenResidues : tokenResidues;
  const selectionCompatible = activeMode !== 'comparison' || Boolean(differencePae);
  const activeSelection = selectionCompatible ? selection : null;
  const chainBoundaries = useMemo(() => boundaries(activeChainIds), [activeChainIds]);
  const chainSegments = useMemo(() => (chainBoundaries.length ? chainBoundaries : [{ index: 0, id: 'Tokens' }]).map((chain, index, all) => ({ ...chain, end: (all[index + 1]?.index ?? (activePae?.length ?? 1)) - 1 })), [activePae?.length, chainBoundaries]);
  const chainPairs = useMemo(() => chainSegments.flatMap((first, firstIndex) => chainSegments.slice(firstIndex + 1).map((second) => [first, second] as const)), [chainSegments]);
  const maxValue = activeMode === 'difference' ? 16 : 32;
  const matchedPair = activeSelection && chainPairs.findIndex(([x, y]) => activeSelection.xStart === x.index && activeSelection.xEnd === x.end && activeSelection.yStart === y.index && activeSelection.yEnd === y.end);
  const isCustomSelection = Boolean(activeSelection) && matchedPair === -1;
  const pairValue = typeof matchedPair === 'number' && matchedPair >= 0 ? String(matchedPair) : isCustomSelection ? 'custom' : '';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePae?.length) return;
    const draw = () => {
      const context = canvas.getContext('2d');
      if (!context) return;
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(box.width * dpr));
      canvas.height = Math.max(1, Math.floor(box.height * dpr));
      const width = canvas.width;
      const height = canvas.height;
      const image = context.createImageData(width, height);
      const n = activePae.length;
      for (let y = 0; y < height; y += 1) {
        const sourceY = Math.min(n - 1, Math.floor((y / height) * n));
        for (let x = 0; x < width; x += 1) {
          const sourceX = Math.min(n - 1, Math.floor((x / width) * n));
          const [r, g, b] = paeColor(activePae[sourceX]?.[sourceY] ?? maxValue, maxValue);
          const offset = (y * width + x) * 4;
          image.data[offset] = r;
          image.data[offset + 1] = g;
          image.data[offset + 2] = b;
          image.data[offset + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      context.strokeStyle = 'rgba(238, 248, 255, .72)';
      context.lineWidth = Math.max(1, dpr);
      for (const boundary of chainBoundaries.slice(1)) {
        const position = (boundary.index / n) * width;
        context.beginPath(); context.moveTo(position, 0); context.lineTo(position, height); context.stroke();
        const y = (boundary.index / n) * height;
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      if (activeSelection) {
        const x = (activeSelection.xStart / n) * width;
        const y = (activeSelection.yStart / n) * height;
        const selectedWidth = ((activeSelection.xEnd - activeSelection.xStart + 1) / n) * width;
        const selectedHeight = ((activeSelection.yEnd - activeSelection.yStart + 1) / n) * height;
        context.fillStyle = 'rgba(255, 255, 255, .12)';
        context.fillRect(x, y, selectedWidth, selectedHeight);
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2 * dpr;
        context.strokeRect(x, y, selectedWidth, selectedHeight);
        context.strokeStyle = '#42bdf5';
        context.lineWidth = Math.max(1, dpr);
        context.strokeRect(x + 2 * dpr, y + 2 * dpr, Math.max(0, selectedWidth - 4 * dpr), Math.max(0, selectedHeight - 4 * dpr));
      }
      if (hover) {
        const x = ((hover.x + 0.5) / n) * width;
        const y = ((hover.y + 0.5) / n) * height;
        context.strokeStyle = 'rgba(255,255,255,.9)';
        context.lineWidth = Math.max(1, dpr);
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
    };
    draw();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(draw);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [activePae, activeSelection, chainBoundaries, hover, maxValue]);

  const pointerToken = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activePae?.length || !selectionCompatible) return;
    const box = event.currentTarget.getBoundingClientRect();
    const n = activePae.length;
    return {
      x: Math.max(0, Math.min(n - 1, Math.floor(((event.clientX - box.left) / box.width) * n))),
      y: Math.max(0, Math.min(n - 1, Math.floor(((event.clientY - box.top) / box.height) * n))),
    };
  };

  const updateDrag = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    onSelection({
      xStart: Math.min(start.x, end.x), xEnd: Math.max(start.x, end.x),
      yStart: Math.min(start.y, end.y), yEnd: Math.max(start.y, end.y),
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointerToken(event);
    if (!point) return;
    dragStartRef.current = point;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateDrag(point, point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;
    const point = pointerToken(event);
    if (point) setHover(point);
    if (start && point) updateDrag(start, point);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;
    const point = pointerToken(event);
    dragStartRef.current = null;
    if (!start || !point || !activePae?.length) return;
    const moved = Math.abs(start.x - point.x) + Math.abs(start.y - point.y);
    if (moved < 3) {
      const radius = Math.max(2, Math.floor(activePae.length * 0.04));
      onSelection({
        xStart: Math.max(0, point.x - radius), xEnd: Math.min(activePae.length - 1, point.x + radius),
        yStart: Math.max(0, point.y - radius), yEnd: Math.min(activePae.length - 1, point.y + radius),
      });
    } else updateDrag(start, point);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!activePae?.length || !selectionCompatible) return;
    if (event.key === 'Escape') { onSelection(null); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const point = hover ?? { x: 0, y: 0 };
      const radius = Math.max(2, Math.floor(activePae.length * 0.04));
      onSelection({ xStart: Math.max(0, point.x - radius), xEnd: Math.min(activePae.length - 1, point.x + radius), yStart: Math.max(0, point.y - radius), yEnd: Math.min(activePae.length - 1, point.y + radius) });
      return;
    }
    const deltas: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    setHover((current) => ({ x: Math.max(0, Math.min(activePae.length - 1, (current?.x ?? 0) + delta[0])), y: Math.max(0, Math.min(activePae.length - 1, (current?.y ?? 0) + delta[1])) }));
  };

  const residueLabel = (index: number) => {
    const token = activeTokenResidues?.[index];
    return token ? `${token.chainId} ${token.residueNumber ?? token.residueId}` : `token ${index + 1}`;
  };
  const hoverValue = hover && activePae?.[hover.x]?.[hover.y];
  const comparisonSelection = comparison?.selectionStats;
  const selectionDelta = selectionStats?.medianPae !== null && selectionStats?.medianPae !== undefined && comparisonSelection?.medianPae !== null && comparisonSelection?.medianPae !== undefined
    ? comparisonSelection.medianPae - selectionStats.medianPae : null;

  return (
    <section className={`pae-panel ${compact ? 'compact' : ''}`}>
      <div className="pae-heading">
        <div><h2>Predicted aligned error</h2><Icon name="info" size={16} /></div>
        <p>Vertical = scored residue · horizontal = alignment reference. PAE is directional.</p>
        {!compact && <p className="pae-link-note">Amber marks PAE-selected residues. Interface contacts separately use ≤5 Å geometry.</p>}
        {activePae?.length && <div className="pae-quick-actions">
          <label className="pae-pair-picker">
            <span>{isCustomSelection ? 'Linked range' : 'Chain pair'}</span>
            <select aria-label="Chain pair" value={pairValue} disabled={!selectionCompatible} onChange={(event) => {
              if (!event.target.value) {
                onSelection(null);
                return;
              }
              const pair = chainPairs[Number(event.target.value)];
              if (pair) onSelection({ xStart: pair[0].index, xEnd: pair[0].end, yStart: pair[1].index, yEnd: pair[1].end });
            }}>
              <option value="">Choose pair…</option>
              {isCustomSelection && <option value="custom" disabled>Custom · {selectionLabel ?? 'linked residue range'}</option>}
              {chainPairs.map(([x, y], index) => <option value={index} key={`${x.id}-${y.id}-${index}`}>{x.id} aligned → {y.id} scored</option>)}
            </select>
          </label>
          {activeSelection && <button type="button" onClick={() => onSelection(null)}>Clear selection</button>}
        </div>}
        {selectionStats && <div className="pae-selection-summary" role="status" aria-live="polite">
          <span>Reciprocal median</span><strong>{metric(selectionStats.medianPae)}</strong>
          <small>Forward {metric(selectionStats.forwardMeanPae)} · reverse {metric(selectionStats.reverseMeanPae)} · {Math.round((selectionStats.lowPaeFraction ?? 0) * 100)}% ≤5 Å</small>
        </div>}
      </div>
      {activePae?.length ? (
        <div className="heatmap-layout">
          <div className="heatmap-context">
            {!compact && <div className="heatmap-instruction"><Icon name="expand" /><span><strong>{selection ? 'PAE range linked' : 'Select a PAE range'}</strong><small>Click, drag, or use arrow keys</small></span></div>}
            {comparison?.pae && <div className="pae-compare-panel">
              <div className="pae-view-switcher" role="group" aria-label="PAE model view">
                <button type="button" aria-pressed={activeMode === 'primary'} onClick={() => setMode('primary')}>{primaryLabel}</button>
                <button type="button" aria-pressed={activeMode === 'comparison'} onClick={() => setMode('comparison')}>{comparison.label}</button>
                <button type="button" aria-pressed={activeMode === 'difference'} disabled={!differencePae} onClick={() => setMode('difference')}>|ΔPAE|</button>
              </div>
              {selectionStats && comparisonSelection && <div className="pae-model-delta">
                <span>{primaryLabel} {metric(selectionStats.medianPae)}</span>
                <span>{comparison.label} {metric(comparisonSelection.medianPae)}</span>
                <strong>Δ {selectionDelta === null ? '—' : `${selectionDelta >= 0 ? '+' : ''}${selectionDelta.toFixed(1)} Å`}</strong>
              </div>}
              {!differencePae && <small className="pae-compare-warning">PAE dimensions differ; difference and cross-model selection are unavailable.</small>}
            </div>}
          </div>
          <div className="heatmap-frame">
            <div className="heatmap-active-label">{activeLabel}</div>
            <div className="chain-boundary-labels">
              {chainSegments.map((chain) => <span key={`${chain.id}-${chain.index}`} style={{ width: `${((chain.end - chain.index + 1) / activePae.length) * 100}%` }}>{chain.id}</span>)}
            </div>
            <div className="heatmap-y-labels" aria-hidden="true">{chainSegments.map((chain) => <span key={`${chain.id}-${chain.index}`} style={{ height: `${((chain.end - chain.index + 1) / activePae.length) * 100}%` }}>{chain.id}</span>)}</div>
            <canvas ref={canvasRef} tabIndex={0} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={() => { if (!dragStartRef.current) setHover(null); }} onKeyDown={handleKeyDown} aria-label={`Interactive predicted aligned error heatmap · ${activeLabel}`} aria-describedby={instructionsId} />
            <span className="sr-only" id={instructionsId}>Use arrow keys to inspect cells, Enter to select, and Escape to clear. The vertical axis is the scored residue and the horizontal axis is the alignment reference. PAE is directional.</span>
            {hover && <span className="heatmap-hover-value" role="status">Scored {residueLabel(hover.y)} · aligned on {residueLabel(hover.x)} · {Number.isFinite(hoverValue) ? `${hoverValue!.toFixed(1)} Å` : 'no value'}</span>}
            {activeSelection && selectionLabel && <span className="heatmap-selection-label">{selectionLabel}</span>}
            <div className="heatmap-axis"><span>1</span><strong>Alignment reference</strong><span>{activePae.length}</span></div>
            <span className="heatmap-y-axis" aria-hidden="true">Scored residue</span>
          </div>
          <div className="pae-legend"><span>{activeMode === 'difference' ? '|ΔPAE|' : 'PAE'} (Å)</span><i /><div><small>0</small><small>{maxValue / 2}</small><small>{maxValue}+</small></div></div>
        </div>
      ) : (
        <div className="pae-empty"><Icon name="layers" size={29} /><strong>No PAE matrix in this selection</strong><span>Open the matching confidence JSON with the structure to add linked error analysis.</span></div>
      )}
    </section>
  );
}
