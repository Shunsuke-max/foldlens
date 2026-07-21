import { useEffect, useRef } from 'react';
import type { AF3Result } from '../types/af3';
import { Icon } from './Icon';

type Props = {
  open: boolean;
  busy: boolean;
  error?: string;
  preview?: AF3Result;
  onClose: () => void;
  onFiles: (files: File[]) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export function OpenResultDialog({ open, busy, error, preview, onClose, onFiles, onConfirm, onBack }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus());
    return () => { window.cancelAnimationFrame(frame); previousFocus.current?.focus(); };
  }, [open]);
  if (!open) return null;

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onFiles(files);
    event.target.value = '';
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])') ?? [])].filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const kindCounts = preview?.chains.reduce<Record<string, number>>((counts, chain) => ({ ...counts, [chain.kind]: (counts[chain.kind] ?? 0) + 1 }), {}) ?? {};
  const confidenceCount = preview?.predictions.filter((prediction) => prediction.confidence?.pae).length ?? 0;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}>
      <section className="open-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="open-title" onKeyDown={handleKeyDown}>
        <div className="dialog-title">
          <div><Icon name="folder" size={24} /><span><h2 id="open-title">Open AlphaFold 3 result</h2><p>Files stay on this device.</p></span></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close"><Icon name="close" /></button>
        </div>
        {preview ? <div className="import-manifest">
          <div className="manifest-summary"><span>Ready to open</span><strong>{preview.jobName}</strong><small>{preview.sourceName}</small></div>
          <dl>
            <div><dt>Predictions</dt><dd>{preview.predictions.length}</dd></div>
            <div><dt>With PAE</dt><dd>{confidenceCount}</dd></div>
            <div><dt>Entities</dt><dd>{preview.chains.length}</dd></div>
          </dl>
          <div className="manifest-entities" aria-label="Detected entity types">
            {Object.entries(kindCounts).map(([kind, count]) => <span key={kind}>{count} {kind}</span>)}
          </div>
          {preview.notices.length > 0 && <ul className="manifest-notices">{preview.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>}
          <div className="manifest-actions">
            <button className="button secondary" type="button" onClick={onBack}>Choose different files</button>
            <button className="button primary" type="button" onClick={onConfirm}>Open {preview.predictions.length} prediction{preview.predictions.length === 1 ? '' : 's'}</button>
          </div>
        </div> : <div className="open-options">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
            <Icon name="file" size={28} /><span><strong>Open ZIP or files</strong><small>AF3 ZIP, mmCIF/CIF, and confidence JSON</small></span>
          </button>
          <button type="button" onClick={() => folderInput.current?.click()} disabled={busy}>
            <Icon name="folder" size={28} /><span><strong>Open output folder</strong><small>Select a local AlphaFold 3 result directory</small></span>
          </button>
        </div>}
        <input ref={fileInput} hidden type="file" multiple accept=".zip,.cif,.mmcif,.json,.csv,.zst" onChange={pick} />
        <input
          ref={folderInput}
          hidden
          type="file"
          multiple
          onChange={pick}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        {busy && <div className="dialog-status" role="status" aria-live="polite"><span />Reading result locally…</div>}
        {error && <div className="dialog-error" role="alert">{error}</div>}
        <p className="dialog-legal">Visualization and confidence interpretation only. AlphaFold Server output terms continue to apply.</p>
      </section>
    </div>
  );
}
