import { Icon } from './Icon';

export type ColorMode = 'confidence' | 'chains';

type Props = {
  colorMode: ColorMode;
  surface: boolean;
  surfaceOnly?: boolean;
  colorModeSuppressed?: boolean;
  onColorMode: (mode: ColorMode) => void;
  onSurface: () => void;
  onReset: () => void;
  onExpand: () => void;
};

export function ViewerToolbar({ colorMode, surface, surfaceOnly = false, colorModeSuppressed = false, onColorMode, onSurface, onReset, onExpand }: Props) {
  const colorModeSelected = !(surface && surfaceOnly) && !colorModeSuppressed;
  return (
    <div className="viewer-toolbar" role="group" aria-label="Structure viewer controls">
      <button type="button" aria-pressed={colorModeSelected && colorMode === 'confidence'} className={colorModeSelected && colorMode === 'confidence' ? 'active' : ''} onClick={() => onColorMode('confidence')}><Icon name="palette" />Confidence</button>
      <button type="button" aria-pressed={colorModeSelected && colorMode === 'chains'} className={colorModeSelected && colorMode === 'chains' ? 'active' : ''} onClick={() => onColorMode('chains')}><Icon name="link" />Chains</button>
      <button type="button" aria-pressed={surface} className={surface ? 'active' : ''} onClick={onSurface}><Icon name="surface" />Surface</button>
      <button type="button" onClick={onReset}><Icon name="reset" />Reset view</button>
      <button type="button" className="toolbar-expand" onClick={onExpand} aria-label="Expand viewer"><Icon name="expand" /></button>
    </div>
  );
}
