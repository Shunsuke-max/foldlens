import type { AF3Result, FoldLensSession, FoldLensViewState, Prediction } from '../types/af3';
import type { AnalysisFacts } from '../types/analysis';

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

function isSession(value: unknown): value is FoldLensSession {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const session = value as Partial<FoldLensSession>;
  const result = session.result as Partial<AF3Result> | undefined;
  const view = session.view as Partial<FoldLensViewState> | undefined;
  return session.format === 'foldlens-session'
    && session.version === 1
    && Boolean(result && typeof result.jobName === 'string' && Array.isArray(result.predictions) && result.predictions.length > 0 && Array.isArray(result.chains))
    && Boolean(view && typeof view.selectedId === 'string' && Array.isArray(view.visibleChains));
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
