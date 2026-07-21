import type { ColorMode } from '../components/ViewerToolbar';

export function colorModeAfterClick(current: ColorMode, requested: ColorMode, surface: boolean, surfaceOnly: boolean) {
  if (surface && !surfaceOnly && current === requested) {
    return { colorMode: current, surfaceOnly: true };
  }
  return { colorMode: requested, surfaceOnly: false };
}
