// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PaeHeatmap } from './PaeHeatmap';

const pae = Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => Math.abs(x - y) + 2));
const chainIds = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D', 'E', 'E'];

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
  }) as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 400, height: 200, left: 0, top: 0, right: 400, bottom: 200, x: 0, y: 0, toJSON: () => ({}),
  });
});

afterEach(cleanup);

describe('PaeHeatmap', () => {
  it('offers every chain pair and selects the final pair without truncation', () => {
    const onSelection = vi.fn();
    render(<PaeHeatmap pae={pae} chainIds={chainIds} selection={null} onSelection={onSelection} primaryLabel="Model 1" />);

    const picker = screen.getByLabelText('Chain pair') as HTMLSelectElement;
    expect(picker.options).toHaveLength(11);
    fireEvent.change(picker, { target: { value: '9' } });
    expect(onSelection).toHaveBeenLastCalledWith({ xStart: 6, xEnd: 7, yStart: 8, yEnd: 9 });
  });

  it('supports current, comparison, and absolute-difference PAE views', () => {
    const comparison = pae.map((row) => row.map((value) => value + 1));
    render(<PaeHeatmap pae={pae} chainIds={chainIds} selection={null} onSelection={() => undefined} primaryLabel="Model 1" comparison={{ label: 'Model 2', pae: comparison }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Model 2' }));
    expect(screen.getByLabelText('Interactive predicted aligned error heatmap · Model 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '|ΔPAE|' }));
    expect(screen.getByLabelText('Interactive predicted aligned error heatmap · |ΔPAE|')).toBeTruthy();
  });

  it('announces directional keyboard inspection and selects with Enter', () => {
    const onSelection = vi.fn();
    render(<PaeHeatmap pae={pae} chainIds={chainIds} selection={null} onSelection={onSelection} primaryLabel="Model 1" />);
    const canvas = screen.getByLabelText('Interactive predicted aligned error heatmap · Model 1');

    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    expect(screen.getByRole('status').textContent).toContain('Scored token 1 · aligned on token 2');
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(onSelection).toHaveBeenCalled();
  });
});
