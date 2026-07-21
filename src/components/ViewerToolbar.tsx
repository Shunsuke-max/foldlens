import { Icon } from './Icon';

export type ColorMode = 'confidence' | 'chains';

type Props = {
  colorMode: ColorMode;
  surface: boolean;
  surfaceOnly?: boolean;
  colorModeSuppressed?: boolean;
  confidenceAvailable?: boolean;
  brightness: number;
  onColorMode: (mode: ColorMode) => void;
  onSurface: () => void;
  onBrightness: (brightness: number) => void;
  onReset: () => void;
  onExpand: () => void;
};

type BrightnessControlProps = {
  brightness: number;
  onBrightness: (brightness: number) => void;
};

export function BrightnessControl({ brightness, onBrightness }: BrightnessControlProps) {
  return (
    <details className="viewer-brightness">
      <summary aria-label={`Adjust structure brightness, currently ${brightness}%`} title="Structure brightness">
        <Icon name="brightness" />
        <span>{brightness}%</span>
      </summary>
      <div className="viewer-brightness-popover">
        <label>
          <span>Structure brightness</span>
          <output>{brightness}%</output>
          <input
            type="range"
            min="60"
            max="140"
            step="5"
            value={brightness}
            aria-label="Structure brightness"
            aria-valuetext={`${brightness}%`}
            onChange={(event) => onBrightness(Number(event.currentTarget.value))}
          />
        </label>
        <button type="button" aria-label="Reset brightness" disabled={brightness === 100} onClick={() => onBrightness(100)}>Reset to 100%</button>
      </div>
    </details>
  );
}

export function ViewerToolbar({ colorMode, surface, surfaceOnly = false, colorModeSuppressed = false, confidenceAvailable = true, brightness, onColorMode, onSurface, onBrightness, onReset, onExpand }: Props) {
  const colorModeSelected = !(surface && surfaceOnly) && !colorModeSuppressed;
  return (
    <div className="viewer-toolbar" role="group" aria-label="Structure viewer controls">
      <button type="button" aria-pressed={colorModeSelected && colorMode === 'confidence'} className={colorModeSelected && colorMode === 'confidence' ? 'active' : ''} disabled={!confidenceAvailable} title={confidenceAvailable ? 'Color by pLDDT confidence' : 'No AlphaFold pLDDT values were loaded'} onClick={() => onColorMode('confidence')}><Icon name="palette" />Confidence</button>
      <button type="button" aria-pressed={colorModeSelected && colorMode === 'chains'} className={colorModeSelected && colorMode === 'chains' ? 'active' : ''} onClick={() => onColorMode('chains')}><Icon name="link" />Chains</button>
      <button type="button" aria-pressed={surface} className={surface ? 'active' : ''} onClick={onSurface}><Icon name="surface" />Surface</button>
      <BrightnessControl brightness={brightness} onBrightness={onBrightness} />
      <button type="button" className="viewer-reset" onClick={onReset}><Icon name="reset" /><span className="reset-label">Reset view</span></button>
      <button type="button" className="toolbar-expand" onClick={onExpand} aria-label="Expand viewer"><Icon name="expand" /></button>
    </div>
  );
}
