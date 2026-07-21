import type { AF3Result, FoldLensSession, FoldLensViewState, Prediction } from '../types/af3';
import type { AnalysisFacts } from '../types/analysis';
import { MAX_STRUCTURE_BRIGHTNESS, MIN_STRUCTURE_BRIGHTNESS } from './brightness';

const safeName = (value: string) => value.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'alphafold_result';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

export function downloadText(filename: string, text: string, type: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type }));
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createSession(result: AF3Result, view: FoldLensViewState): FoldLensSession {
  return { format: 'foldlens-session', version: 1, savedAt: new Date().toISOString(), result, view };
}

export function downloadSession(session: FoldLensSession) {
  downloadText(`${safeName(session.result.jobName)}.foldlens.json`, JSON.stringify(session, null, 2), 'application/json');
}

export function createPaeSnapshot(pae?: number[][]) {
  if (!pae?.length || typeof document === 'undefined') return undefined;
  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return undefined;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = pae[Math.min(pae.length - 1, Math.floor((x / size) * pae.length))]?.[Math.min(pae.length - 1, Math.floor((y / size) * pae.length))];
      const t = Number.isFinite(value) ? Math.max(0, Math.min(1, value / 32)) : 1;
      const offset = (y * size + x) * 4;
      image.data[offset] = Math.round(18 + 237 * t);
      image.data[offset + 1] = Math.round(42 + 191 * t);
      image.data[offset + 2] = Math.round(82 - 13 * t);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finiteOptional = (value: unknown) => value === undefined || typeof value === 'number' && Number.isFinite(value);
const stringArray = (value: unknown, maximum: number) => Array.isArray(value) && value.length <= maximum && value.every((item) => typeof item === 'string');
const finiteArray = (value: unknown, maximum: number) => Array.isArray(value) && value.length <= maximum && value.every((item) => typeof item === 'number' && Number.isFinite(item));

function validMatrix(value: unknown, maximumDimension = 4096, square = true) {
  if (value === undefined) return true;
  if (!Array.isArray(value) || value.length === 0 || value.length > maximumDimension) return false;
  const width = Array.isArray(value[0]) ? value[0].length : 0;
  return width > 0 && width <= maximumDimension && (!square || width === value.length) && value.every((row) => Array.isArray(row) && row.length === width && row.every((cell) => typeof cell === 'number' && Number.isFinite(cell)));
}

function validPrediction(value: unknown) {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.label !== 'string' || typeof value.path !== 'string' || typeof value.cif !== 'string') return false;
  if (value.cif.length > 48 * 1024 * 1024 || !isRecord(value.summary)) return false;
  const summary = value.summary;
  if (!finiteOptional(summary.ptm) || !finiteOptional(summary.iptm) || !finiteOptional(summary.rankingScore) || !finiteOptional(summary.fractionDisordered)) return false;
  if (summary.hasClash !== undefined && typeof summary.hasClash !== 'boolean') return false;
  if (summary.chainIds !== undefined && !stringArray(summary.chainIds, 256)) return false;
  if (summary.chainPtm !== undefined && !finiteArray(summary.chainPtm, 256)) return false;
  if (summary.chainIptm !== undefined && !finiteArray(summary.chainIptm, 256)) return false;
  if (!validMatrix(summary.chainPairIptm, 256) || !validMatrix(summary.chainPairPaeMin, 256)) return false;
  const chainCount = Array.isArray(summary.chainIds) ? summary.chainIds.length : undefined;
  if (chainCount !== undefined) {
    if (Array.isArray(summary.chainPtm) && summary.chainPtm.length !== chainCount) return false;
    if (Array.isArray(summary.chainIptm) && summary.chainIptm.length !== chainCount) return false;
    if (Array.isArray(summary.chainPairIptm) && summary.chainPairIptm.length !== chainCount) return false;
    if (Array.isArray(summary.chainPairPaeMin) && summary.chainPairPaeMin.length !== chainCount) return false;
  }
  if (value.confidence === undefined) return true;
  if (!isRecord(value.confidence)) return false;
  const confidence = value.confidence;
  if (!validMatrix(confidence.pae) || !validMatrix(confidence.contactProbs)) return false;
  if (confidence.tokenChainIds !== undefined && !stringArray(confidence.tokenChainIds, 4096)) return false;
  if (confidence.tokenPlddts !== undefined && !finiteArray(confidence.tokenPlddts, 4096)) return false;
  if (confidence.atomPlddts !== undefined && !finiteArray(confidence.atomPlddts, 2_000_000)) return false;
  if (confidence.atomChainIds !== undefined && !stringArray(confidence.atomChainIds, 2_000_000)) return false;
  if (confidence.tokenResidues !== undefined && (!Array.isArray(confidence.tokenResidues) || confidence.tokenResidues.length > 4096 || !confidence.tokenResidues.every((item) => isRecord(item)
    && typeof item.tokenIndex === 'number' && Number.isSafeInteger(item.tokenIndex) && item.tokenIndex >= 0
    && typeof item.chainId === 'string' && typeof item.residueId === 'string'
    && (item.residueNumber === undefined || Number.isSafeInteger(item.residueNumber))
    && (item.residueName === undefined || typeof item.residueName === 'string')
    && (item.isHetero === undefined || typeof item.isHetero === 'boolean')))) return false;
  if (Array.isArray(confidence.atomPlddts) && Array.isArray(confidence.atomChainIds) && confidence.atomPlddts.length !== confidence.atomChainIds.length) return false;
  const paeSize = Array.isArray(confidence.pae) ? confidence.pae.length : undefined;
  if (paeSize && Array.isArray(confidence.tokenChainIds) && confidence.tokenChainIds.length !== paeSize) return false;
  if (paeSize && Array.isArray(confidence.tokenResidues) && confidence.tokenResidues.length !== paeSize) return false;
  if (Array.isArray(confidence.tokenPlddts) && Array.isArray(confidence.tokenResidues) && confidence.tokenPlddts.length !== confidence.tokenResidues.length) return false;
  return true;
}

export function isSession(value: unknown): value is FoldLensSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<FoldLensSession>;
  const result = session.result as Partial<AF3Result> | undefined;
  const view = session.view as Partial<FoldLensViewState> | undefined;
  if (!(session.format === 'foldlens-session'
    && session.version === 1
    && typeof session.savedAt === 'string'
    && result && typeof result.jobName === 'string' && typeof result.sourceName === 'string'
    && Array.isArray(result.predictions) && result.predictions.length > 0 && result.predictions.length <= 12 && result.predictions.every(validPrediction)
    && Array.isArray(result.chains) && result.chains.length > 0 && result.chains.length <= 256
    && result.chains.every((chain) => isRecord(chain)
      && typeof chain.id === 'string'
      && typeof chain.label === 'string'
      && typeof chain.color === 'string'
      && ['protein', 'nucleic', 'ligand', 'unknown'].includes(String(chain.kind))
      && (chain.ligandCodes === undefined || Array.isArray(chain.ligandCodes) && chain.ligandCodes.length <= 32 && chain.ligandCodes.every((code) => typeof code === 'string' && code.length <= 16))
      && (chain.sourceChainIds === undefined || Array.isArray(chain.sourceChainIds) && chain.sourceChainIds.length <= 64 && chain.sourceChainIds.every((id) => typeof id === 'string' && id.length <= 64))
      && (chain.instanceCount === undefined || Number.isSafeInteger(chain.instanceCount) && chain.instanceCount > 0 && chain.instanceCount <= 10_000))
    && Array.isArray(result.notices) && result.notices.length <= 32 && result.notices.every((notice) => typeof notice === 'string')
    && view && typeof view.selectedId === 'string' && Array.isArray(view.visibleChains)
    && view.visibleChains.every((id) => typeof id === 'string')
    && (view.colorMode === 'confidence' || view.colorMode === 'chains')
    && typeof view.surface === 'boolean'
    && (view.surfaceOnly === undefined || typeof view.surfaceOnly === 'boolean')
    && (view.focusMode === undefined || ['all', 'interface', 'pocket', 'domains'].includes(view.focusMode))
    && (view.selectedDomainId === undefined || typeof view.selectedDomainId === 'string')
    && (view.mobileTab === undefined || ['structure', 'pae', 'models', 'insights'].includes(view.mobileTab))
    && (view.inspectorTab === undefined || view.inspectorTab === 'analysis' || view.inspectorTab === 'ask'))) return false;
  if (new Set(result.predictions.map((item) => item.id)).size !== result.predictions.length || new Set(result.chains.map((chain) => chain.id)).size !== result.chains.length) return false;
  if (result.domainAnnotations !== undefined && (!Array.isArray(result.domainAnnotations) || result.domainAnnotations.length > 256 || !result.domainAnnotations.every((domain) => isRecord(domain) && typeof domain.id === 'string' && typeof domain.label === 'string' && typeof domain.chainId === 'string' && Number.isSafeInteger(domain.start) && Number.isSafeInteger(domain.end) && domain.start <= domain.end && (domain.source === 'interpro' || domain.source === 'provided')))) return false;
  if (result.biologicalContext !== undefined) {
    const context = result.biologicalContext;
    if (!isRecord(context) || typeof context.displayName !== 'string' || typeof context.sourceLabel !== 'string'
      || context.displayName.length > 160 || context.sourceLabel.length > 160
      || context.organism !== undefined && (typeof context.organism !== 'string' || context.organism.length > 160)
      || !isRecord(context.summary) || typeof context.summary.en !== 'string' || typeof context.summary.ja !== 'string'
      || context.summary.en.length > 700 || context.summary.ja.length > 700
      || context.relevance !== undefined && (!isRecord(context.relevance) || typeof context.relevance.en !== 'string' || typeof context.relevance.ja !== 'string' || context.relevance.en.length > 700 || context.relevance.ja.length > 700)) return false;
  }
  const prediction = result.predictions.find((item) => item.id === view.selectedId);
  const knownPredictions = new Set(result.predictions.map((item) => item.id));
  const knownChains = new Set(result.chains.map((chain) => chain.id));
  if (!prediction || view.compareId !== undefined && (!knownPredictions.has(view.compareId) || view.compareId === view.selectedId)) return false;
  if (!view.visibleChains.every((id) => knownChains.has(id))) return false;
  const domainIds = new Set(result.domainAnnotations?.map((domain) => domain.id) ?? []);
  if (result.domainAnnotations?.some((domain) => !knownChains.has(domain.chainId)) || view.selectedDomainId !== undefined && !domainIds.has(view.selectedDomainId)) return false;
  if (!finiteOptional(view.brightness) || view.brightness !== undefined && (view.brightness < MIN_STRUCTURE_BRIGHTNESS || view.brightness > MAX_STRUCTURE_BRIGHTNESS)) return false;
  if (view.selection !== null) {
    if (!isRecord(view.selection)) return false;
    const size = prediction.confidence?.pae?.length ?? prediction.confidence?.tokenResidues?.length ?? prediction.confidence?.tokenChainIds?.length ?? 0;
    const values = [view.selection.xStart, view.selection.xEnd, view.selection.yStart, view.selection.yEnd];
    if (!size || !values.every((item) => Number.isSafeInteger(item) && item >= 0 && item < size) || view.selection.xStart > view.selection.xEnd || view.selection.yStart > view.selection.yEnd) return false;
  }
  return true;
}

export async function parseSessionFile(files: File[]): Promise<FoldLensSession | null> {
  if (files.length !== 1 || !/\.json$/i.test(files[0].name) || files[0].size > 64 * 1024 * 1024) return null;
  try {
    const value: unknown = JSON.parse(await files[0].text());
    return isSession(value) ? value : null;
  } catch {
    return null;
  }
}

const metric = (value: number | undefined) => value === undefined ? 'Not available' : value.toFixed(2);

export function buildHtmlReport({
  result,
  prediction,
  facts,
  selectionLabel,
  structureImage,
  paeImage,
}: {
  result: AF3Result;
  prediction: Prediction;
  facts: AnalysisFacts;
  selectionLabel?: string;
  structureImage?: string;
  paeImage?: string;
}) {
  const interfaces = facts.primaryInterface
    ? `<tr><td>${escapeHtml(`${facts.primaryInterface.chainA}–${facts.primaryInterface.chainB}`)}</td><td>${escapeHtml(facts.primaryInterface.iptm?.toFixed(2) ?? '—')}</td><td>${escapeHtml(facts.primaryInterface.paeMedian?.toFixed(1) ?? '—')} Å</td><td>${escapeHtml(facts.primaryInterface.paeMin?.toFixed(1) ?? '—')} Å</td></tr>`
    : '<tr><td colspan="4">No chain-pair confidence matrix was loaded.</td></tr>';
  const lowConfidence = facts.lowConfidenceRegions.length
    ? facts.lowConfidenceRegions.map((region) => `<li><strong>${escapeHtml(`${region.chainId} ${region.start}–${region.end}`)}</strong> · mean pLDDT ${escapeHtml(region.meanPlddt.toFixed(0))}</li>`).join('')
    : '<li>No sustained low-pLDDT region was detected in the loaded confidence data.</li>';
  const notices = result.notices.length ? result.notices.map((notice) => `<li>${escapeHtml(notice)}</li>`).join('') : '<li>No import notices.</li>';
  const snapshots = [
    structureImage ? `<figure><img src="${structureImage}" alt="Current FoldLens structure view"><figcaption>Current structure view</figcaption></figure>` : '',
    paeImage ? `<figure><img src="${paeImage}" alt="Current predicted aligned error heatmap"><figcaption>Predicted aligned error</figcaption></figure>` : '',
  ].join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(result.jobName)} · FoldLens confidence report</title>
<style>body{margin:0;background:#07131d;color:#eef5f8;font:15px/1.55 Inter,system-ui,sans-serif}main{max-width:960px;margin:auto;padding:48px 24px}header{border-bottom:1px solid #29404f;padding-bottom:24px}h1{margin:0 0 8px;font-size:30px}h2{margin-top:36px;font-size:18px}.muted,figcaption{color:#9cabb8}.metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #29404f;margin-top:24px}.metrics div{padding:16px;border-right:1px solid #29404f}.metrics div:last-child{border:0}.metrics span{display:block;color:#9cabb8;font-size:12px}.metrics strong{font:700 22px ui-monospace,monospace;color:#72d8ff}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border:1px solid #29404f}figure{margin:22px 0}img{display:block;max-width:100%;border:1px solid #29404f;background:#07131d}figcaption{font-size:12px;margin-top:6px}.caveat{margin-top:42px;border-left:3px solid #a9d94a;padding:12px 16px;background:#0d1c28}@media(max-width:620px){.metrics{grid-template-columns:1fr 1fr}.metrics div:nth-child(2){border-right:0}.metrics div:nth-child(-n+2){border-bottom:1px solid #29404f}}</style></head>
<body><main><header><p class="muted">FoldLens confidence report</p><h1>${escapeHtml(result.jobName)}</h1><div class="muted">${escapeHtml(prediction.label)}${prediction.seed ? ` · seed ${escapeHtml(prediction.seed)}` : ''}${prediction.sample !== undefined ? ` · sample ${escapeHtml(prediction.sample)}` : ''}</div></header>
<section class="metrics"><div><span>Ranking score</span><strong>${metric(prediction.summary.rankingScore)}</strong></div><div><span>Global ipTM</span><strong>${metric(prediction.summary.iptm)}</strong></div><div><span>Global pTM</span><strong>${metric(prediction.summary.ptm)}</strong></div><div><span>Clashes</span><strong>${prediction.summary.hasClash === undefined ? '—' : prediction.summary.hasClash ? 'Detected' : 'None'}</strong></div></section>
${snapshots}<h2>Current focus</h2><p>${escapeHtml(selectionLabel || 'No residue range selected.')}</p>
	<h2>Highest-confidence chain pair</h2><table><thead><tr><th>Interface</th><th>Chain-pair ipTM</th><th>Reciprocal median PAE</th><th>Minimum PAE</th></tr></thead><tbody>${interfaces}</tbody></table>
<h2>Regions to treat cautiously</h2><ul>${lowConfidence}</ul><h2>Import notes</h2><ul>${notices}</ul>
<p class="caveat"><strong>Interpretation caveat.</strong> AlphaFold confidence estimates describe prediction confidence, not experimental validation or biological truth. This report is for research visualization and interpretation, not clinical use.</p>
<p class="muted">Generated locally by FoldLens on ${escapeHtml(new Date().toLocaleString())}.</p></main></body></html>`;
}

export function downloadHtmlReport(jobName: string, html: string) {
  downloadText(`${safeName(jobName)}_foldlens_report.html`, html, 'text/html');
}
