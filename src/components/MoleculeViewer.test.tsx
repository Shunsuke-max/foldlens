// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoleculeViewer } from './MoleculeViewer';

const viewer = vi.hoisted(() => ({
  addModel: vi.fn(), zoomTo: vi.fn(), zoom: vi.fn(), setProjection: vi.fn(), setBackgroundColor: vi.fn(),
  removeAllSurfaces: vi.fn(), setStyle: vi.fn(), render: vi.fn(), selectedAtoms: vi.fn(() => []),
  resize: vi.fn(), rotate: vi.fn(), addSurface: vi.fn(),
}));

vi.mock('3dmol', () => ({ createViewer: () => viewer, SurfaceType: { VDW: 1 } }));

beforeEach(() => {
  Object.values(viewer).forEach((value) => typeof value === 'function' && value.mockClear());
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callback(0); return 1; });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MoleculeViewer comparison and keyboard controls', () => {
  it('applies chain visibility to comparison coordinates and supports keyboard rotation', async () => {
    render(<MoleculeViewer
      cif="data_primary"
      compareCif="data_comparison"
      chains={[
        { id: 'A', label: 'A', kind: 'protein', color: '#fff' },
        { id: 'B', label: 'B', kind: 'protein', color: '#000' },
      ]}
      visibleChains={new Set(['A'])}
      colorMode="chains"
      surface={false}
      resetSignal={0}
    />);

    await waitFor(() => expect(viewer.setStyle).toHaveBeenCalledWith({ model: 1, chain: 'A', hetflag: false }, expect.anything()));
    expect(viewer.setStyle).not.toHaveBeenCalledWith({ model: 1, chain: 'B', hetflag: false }, expect.anything());
    const host = screen.getByLabelText('Interactive three-dimensional molecular structure');
    fireEvent.keyDown(host, { key: 'ArrowRight' });
    expect(viewer.rotate).toHaveBeenCalledWith(8, 'y');
  });

  it('builds a surface for a visible fourth chain when earlier chains are hidden', async () => {
    viewer.addSurface.mockResolvedValue(undefined);
    render(<MoleculeViewer
      cif="data_primary"
      chains={['A', 'B', 'C', 'D'].map((id) => ({ id, label: id, kind: 'protein' as const, color: '#fff' }))}
      visibleChains={new Set(['D'])}
      colorMode="chains"
      surface
      resetSignal={0}
    />);
    await waitFor(() => expect(viewer.addSurface).toHaveBeenCalledWith(1, expect.anything(), { model: 0, chain: 'D', hetflag: false }));
  });
});
