import { describe, expect, it } from 'vitest';
import { capPath, capSize, dashArray, insetBox, lineGeometry, shapePath, strokeOf } from '../src/print/shapes';

const numbers = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
const vertices = (d: string) => d.split('L').length;

describe('shapePath', () => {
  it.each(['triangle', 'diamond', 'star', 'burst', 'arrow', 'bubble'] as const)('%s queda dentro de la caja', (kind) => {
    const d = shapePath(kind, 200, 120);
    expect(d.startsWith('M')).toBe(true);
    for (const n of numbers(d)) {
      expect(n).toBeGreaterThanOrEqual(-0.01);
      expect(n).toBeLessThanOrEqual(200.01);
    }
  });

  it('la estrella tiene 10 vértices y el estallido 24', () => {
    expect(vertices(shapePath('star', 100, 100))).toBe(10);
    expect(vertices(shapePath('burst', 100, 100))).toBe(24);
  });

  it('la estrella y el estallido ocupan toda la caja', () => {
    for (const kind of ['star', 'burst'] as const) {
      const ns = numbers(shapePath(kind, 100, 60));
      const xs = ns.filter((_, i) => i % 2 === 0);
      const ys = ns.filter((_, i) => i % 2 === 1);
      expect(Math.min(...xs)).toBeCloseTo(0, 1);
      expect(Math.max(...xs)).toBeCloseTo(100, 1);
      expect(Math.min(...ys)).toBeCloseTo(0, 1);
      expect(Math.max(...ys)).toBeCloseTo(60, 1);
    }
  });

  it('la flecha apunta a la derecha: su punta está en el borde derecho, a media altura', () => {
    expect(shapePath('arrow', 100, 50)).toContain('100,25');
  });

  it('el triángulo y el rombo son simétricos', () => {
    expect(shapePath('triangle', 100, 80)).toBe('M50,0 L100,80 L0,80 Z');
    expect(shapePath('diamond', 100, 80)).toBe('M50,0 L100,40 L50,80 L0,40 Z');
  });

  it('un tipo que no es SVG no tiene contorno', () => {
    expect(shapePath('rect', 100, 50)).toBe('');
    expect(shapePath('line', 100, 50)).toBe('');
  });
});

describe('trazo', () => {
  it('el grosor mínimo es 1', () => {
    expect(strokeOf(0)).toBe(1);
    expect(strokeOf(0.2)).toBe(1);
    expect(strokeOf(5)).toBe(5);
  });

  it('insetBox reduce la caja y desplaza medio grosor', () => {
    expect(insetBox(100, 50, 6)).toEqual({ x: 3, y: 3, w: 94, h: 44 });
    expect(insetBox(100, 50, 0)).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(insetBox(4, 4, 12).w).toBe(0);
  });

  it('dashArray: sólido sin guiones, discontinuo 3g 2g, punteado 0 2g', () => {
    expect(dashArray(undefined, 4)).toBeUndefined();
    expect(dashArray('solid', 4)).toBeUndefined();
    expect(dashArray('dashed', 4)).toBe('12 8');
    expect(dashArray('dotted', 4)).toBe('0 8');
    expect(dashArray('dashed', 0)).toBe('3 2');
  });
});

describe('lineGeometry', () => {
  it('sin extremos la línea ocupa todo el ancho, a media altura', () => {
    expect(lineGeometry(300, 20, 3)).toEqual({ y: 10, x1: 0, x2: 300, caps: [] });
  });

  it('con extremos, estos ocupan capSize y la línea recorre el resto', () => {
    const s = capSize(3);
    const g = lineGeometry(300, 20, 3, 'arrow', 'circle');
    expect(g.x1).toBe(s);
    expect(g.x2).toBe(300 - s);
    expect(g.caps).toEqual([
      { kind: 'arrow', side: 'start', x: 0, size: s },
      { kind: 'circle', side: 'end', x: 300 - s, size: s },
    ]);
  });

  it('un solo extremo deja el otro lado libre', () => {
    const g = lineGeometry(300, 20, 3, 'none', 'square');
    expect(g.x1).toBe(0);
    expect(g.x2).toBe(300 - capSize(3));
    expect(g.caps).toHaveLength(1);
  });

  it('en una línea muy corta los extremos no se pasan de la mitad de la caja', () => {
    const g = lineGeometry(10, 4, 12, 'arrow', 'arrow');
    expect(g.caps[0]!.size).toBe(5);
    expect(g.x1).toBeLessThanOrEqual(g.x2);
  });

  it('el extremo crece con el grosor', () => {
    expect(capSize(10)).toBeGreaterThan(capSize(2));
    expect(capSize(0)).toBe(capSize(1));
  });
});

describe('capPath', () => {
  const cap = (kind: 'arrow' | 'circle' | 'square' | 'diamond', side: 'start' | 'end') => ({ kind, side, x: 100, size: 10 }) as const;

  it('la flecha apunta hacia fuera: a la derecha al final y a la izquierda al inicio', () => {
    expect(capPath(cap('arrow', 'end'), 50)).toBe('M100,45 L110,50 L100,55 Z');
    expect(capPath(cap('arrow', 'start'), 50)).toBe('M110,45 L100,50 L110,55 Z');
  });

  it('cuadrado y rombo ocupan su cuadro', () => {
    expect(capPath(cap('square', 'end'), 50)).toBe('M100,45 L110,45 L110,55 L100,55 Z');
    expect(capPath(cap('diamond', 'end'), 50)).toBe('M105,45 L110,50 L105,55 L100,50 Z');
  });

  it('el círculo es un arco de diámetro igual al tamaño', () => {
    expect(capPath(cap('circle', 'end'), 50)).toContain('a5,5');
  });
});
