import { Icon } from './Icon';
import { MAX_STRUCTURE_BRIGHTNESS, MIN_STRUCTURE_BRIGHTNESS } from '../lib/brightness';

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
  const presets = [100, 150, MAX_STRUCTURE_BRIGHTNESS];
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
            min={MIN_STRUCTURE_BRIGHTNESS}
            max={MAX_STRUCTURE_BRIGHTNESS}
            step="5"
            value={brightness}
            aria-label="Structure brightness"
            aria-valuetext={`${brightness}%`}
            onChange={(event) => onBrightness(Number(event.currentTarget.value))}
          />
        </label>
        <div className="viewer-brightness-presets" role="group" aria-label="Structure brightness presets">
          {presets.map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`Set structure brightness to ${value}%`}
              aria-pressed={brightness === value}
              onClick={() => onBrightness(value)}
            >{value}%</button>
          ))}
        </div>
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
      <button type="button" className="viewer-reset" aria-label="Reset view" onClick={onReset}><Icon name="reset" /><span className="reset-label" aria-hidden="true">Reset view</span></button>
      <button type="button" className="toolbar-expand" onClick={onExpand} aria-label="Expand viewer"><Icon name="expand" /></button>
    </div>
  );
}
