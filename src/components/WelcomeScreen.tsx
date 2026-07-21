import { useRef } from 'react';
import { BrandMark, Icon } from './Icon';

type Props = {
  demoBusy: boolean;
  onFiles: (files: File[]) => void;
  onDemo: () => void;
};

export function WelcomeScreen({ demoBusy, onFiles, onDemo }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onFiles(files);
    event.target.value = '';
  };

  return (
    <div className="welcome-screen">
      <header className="welcome-header">
        <div className="welcome-brand"><BrandMark /><strong>FoldLens</strong></div>
        <span><Icon name="lock" size={15} />Local-first AF3 workspace</span>
      </header>

      <main className="welcome-main">
        <section className="welcome-intro">
          <span className="welcome-eyebrow">ALPHAFOLD 3 RESULTS WORKSPACE</span>
          <h1>Start with your prediction files.</h1>
          <p>Open an AlphaFold 3 output folder or ZIP to explore the structure, confidence, and PAE together.</p>
          <ul>
            <li><i /><span><strong>Structure</strong><small>Interactive 3D with chain and surface views</small></span></li>
            <li><i /><span><strong>Confidence</strong><small>pLDDT, ipTM, pTM, and clash labels</small></span></li>
            <li><i /><span><strong>Evidence</strong><small>PAE-linked selections and grounded explanations</small></span></li>
          </ul>
        </section>

        <section className="welcome-open-card" aria-labelledby="welcome-open-title">
          <div className="welcome-open-icon"><Icon name="folder" size={28} /></div>
          <span className="welcome-step">STEP 1</span>
          <h2 id="welcome-open-title">Open an AlphaFold 3 result</h2>
          <p>Select the downloaded output directory, or open its ZIP and result files.</p>
          <div className="welcome-open-actions">
            <button className="button primary" type="button" onClick={() => folderInput.current?.click()}>
              <Icon name="folder" />Open output folder
            </button>
            <button className="button secondary" type="button" onClick={() => fileInput.current?.click()}>
              <Icon name="file" />Open ZIP or files
            </button>
          </div>
          <div className="welcome-drop-note"><Icon name="upload" size={17} />You can also drop files anywhere on this screen.</div>
          <div className="welcome-divider"><span>or</span></div>
          <button className="welcome-demo" type="button" onClick={onDemo} disabled={demoBusy}>
            <Icon name="molecule" size={18} />{demoBusy ? 'Loading sample…' : 'Explore sample result'}
          </button>
          <p className="welcome-privacy"><Icon name="lock" size={13} />Structure files are parsed locally in your browser.</p>
          <input ref={fileInput} hidden type="file" multiple accept=".zip,.cif,.mmcif,.json,.csv,.zst" aria-label="Select AlphaFold 3 ZIP or files" onChange={pick} />
          <input
            ref={folderInput}
            hidden
            type="file"
            multiple
            aria-label="Select AlphaFold 3 output folder"
            onChange={pick}
            {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        </section>
      </main>

      <footer className="welcome-footer">Visualization and confidence interpretation only · Confidence is not experimental validation</footer>
    </div>
  );
}
