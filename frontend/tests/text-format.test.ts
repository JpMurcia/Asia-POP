import { describe, expect, it } from 'vitest';
import { arcPath, decorationLine, listLines } from '../src/print/text-format';

describe('listLines', () => {
  it('viñetas: una por línea no vacía', () => {
    expect(listLines('Uno\nDos', 'bullet')).toEqual([
      { marker: '•', text: 'Uno' },
      { marker: '•', text: 'Dos' },
    ]);
  });
  it('numerada: cuenta solo las líneas no vacías, desde 1', () => {
    const lines = listLines('Uno\n\nDos\n  \nTres', 'number');
    expect(lines.map((l) => l.marker)).toEqual(['1.', null, '2.', null, '3.']);
  });
  it('un texto vacío da una línea sin marcador', () => {
    expect(listLines('', 'bullet')).toEqual([{ marker: null, text: '' }]);
  });
});

describe('decorationLine', () => {
  it('sin subrayado ni tachado no hay decoración (marcado de siempre)', () => {
    expect(decorationLine({})).toBeUndefined();
    expect(decorationLine({ strike: false, underline: false })).toBeUndefined();
  });
  it('solo tachado: igual que antes', () => {
    expect(decorationLine({ strike: true })).toBe('line-through');
  });
  it('subrayado, y los dos combinados', () => {
    expect(decorationLine({ underline: true })).toBe('underline');
    expect(decorationLine({ underline: true, strike: true })).toBe('underline line-through');
  });
});

describe('arcPath', () => {
  it('curvatura 0 es una línea recta por el medio', () => {
    expect(arcPath(200, 40, 0)).toBe('M 0 20 L 200 20');
  });
  it('positiva: arco hacia arriba (extremos más abajo que el medio, sweep 1)', () => {
    const d = arcPath(200, 40, 50);
    expect(d).toMatch(/^M 0 (\d+(\.\d+)?) A /);
    const endY = Number(/^M 0 ([\d.]+)/.exec(d)![1]);
    expect(endY).toBeGreaterThan(20);
    expect(d).toMatch(/0 0 1 200 /);
  });
  it('negativa: arco hacia abajo (extremos más arriba, sweep 0)', () => {
    const d = arcPath(200, 40, -50);
    const endY = Number(/^M 0 (-?[\d.]+)/.exec(d)![1]);
    expect(endY).toBeLessThan(20);
    expect(d).toMatch(/0 0 0 200 /);
  });
  it('la curvatura se limita a ±100', () => {
    expect(arcPath(200, 40, 500)).toBe(arcPath(200, 40, 100));
    expect(arcPath(200, 40, -500)).toBe(arcPath(200, 40, -100));
  });
});
