import { describe, expect, it } from 'vitest';
import { colorModeAfterClick, restoredVisibleChainIds } from './viewMode';

describe('colorModeAfterClick', () => {
  it('toggles the selected color layer between Overlay and Surface only', () => {
    expect(colorModeAfterClick('chains', 'chains', true, false)).toEqual({ colorMode: 'chains', surfaceOnly: true });
    expect(colorModeAfterClick('chains', 'chains', true, true)).toEqual({ colorMode: 'chains', surfaceOnly: false });
  });

  it('switches color mode without entering Surface only', () => {
    expect(colorModeAfterClick('chains', 'confidence', true, false)).toEqual({ colorMode: 'confidence', surfaceOnly: false });
    expect(colorModeAfterClick('chains', 'chains', false, false)).toEqual({ colorMode: 'chains', surfaceOnly: false });
  });

  it('preserves an intentionally empty saved chain visibility set', () => {
    expect(restoredVisibleChainIds(['A', 'B'], [])).toEqual([]);
    expect(restoredVisibleChainIds(['A', 'B'], undefined)).toEqual(['A', 'B']);
  });
});
