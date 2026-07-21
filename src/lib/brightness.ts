export const MIN_STRUCTURE_BRIGHTNESS = 60;
export const DEFAULT_STRUCTURE_BRIGHTNESS = 100;
export const MAX_STRUCTURE_BRIGHTNESS = 200;

export function clampStructureBrightness(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_STRUCTURE_BRIGHTNESS;
  return Math.min(MAX_STRUCTURE_BRIGHTNESS, Math.max(MIN_STRUCTURE_BRIGHTNESS, value));
}
