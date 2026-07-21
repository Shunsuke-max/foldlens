import { describe, expect, it } from 'vitest';
import { clampStructureBrightness } from './brightness';

describe('structure brightness', () => {
  it('keeps brightness within the visible 60–200% range', () => {
    expect(clampStructureBrightness(20)).toBe(60);
    expect(clampStructureBrightness(140)).toBe(140);
    expect(clampStructureBrightness(240)).toBe(200);
    expect(clampStructureBrightness(Number.NaN)).toBe(100);
  });
});
