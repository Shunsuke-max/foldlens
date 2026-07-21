import { useEffect, useRef, useState } from 'react';
import { BrandMark, Icon } from './Icon';

type Props = {
  jobName: string;
  isDemo?: boolean;
  onOpen: () => void;
  onExportReport: () => void;
  onSaveSession: () => void;
};

export function AppHeader({ jobName, isDemo, onOpen, onExportReport, onSaveSession }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event instanceof MouseEvent && menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menuOpen]);

  const run = (action: () => void) => { menuButtonRef.current?.focus(); setMenuOpen(false); action(); };
  return (
    <header className="app-header">
      <div className="brand"><BrandMark /><strong>FoldLens</strong></div>
      <div className="job-heading">
        <strong>{jobName}</strong>
        <span className={isDemo ? 'demo-status' : ''}><i />{isDemo ? 'Sample data · confidence values are illustrative' : 'Private · processed on this device'}</span>
      </div>
      <div className="header-actions" ref={menuRef}>
        <button className="button secondary" type="button" onClick={onOpen}><Icon name="folder" />Open result</button>
        <button className="button secondary export-button" type="button" onClick={onExportReport}><Icon name="upload" />Export report</button>
        <button ref={menuButtonRef} className="icon-button more-button" aria-label="More options" aria-expanded={menuOpen} aria-haspopup="menu" type="button" onClick={() => setMenuOpen((value) => !value)}><Icon name="more" /></button>
        {menuOpen && <div className="header-menu" role="menu">
          <button role="menuitem" type="button" onClick={() => run(onOpen)}><Icon name="folder" />Open result</button>
          <button role="menuitem" type="button" onClick={() => run(onExportReport)}><Icon name="upload" />Export HTML report</button>
          <button role="menuitem" type="button" onClick={() => run(onSaveSession)}><Icon name="file" />Save resumable session</button>
        </div>}
      </div>
    </header>
  );
}
