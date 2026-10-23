import { describe, expect, it } from 'vitest';
import { RANGES } from '../../backend/src/catalog/template';
import { computeDrag } from '../src/pages/TemplateEditor/usePointerDrag';
import { lockedSize } from '../src/pages/TemplateEditor/lock-aspect';

const ratio = (s: { w?: number; h?: number }) => s.h! / s.w!;

describe('lockedSize', () => {
  it('con solo el ancho, deriva el alto con la relación original', () => {
    expect(lockedSize({ w: 20, h: 10 }, { w: 40 })).toEqual({ w: 40, h: 20 });
  });

  it('con solo el alto, deriva el ancho', () => {
    expect(lockedSize({ w: 20, h: 10 }, { h: 30 })).toEqual({ w: 60, h: 30 });
  });

  it('con los dos o con ninguno, el parche queda igual', () => {
    expect(lockedSize({ w: 20, h: 10 }, { w: 40, h: 5 })).toEqual({ w: 40, h: 5 });
    expect(lockedSize({ w: 20, h: 10 }, {})).toEqual({});
  });

  it('relaciones 1:1 y 3:1', () => {
    expect(lockedSize({ w: 30, h: 30 }, { w: 12 })).toEqual({ w: 12, h: 12 });
    expect(lockedSize({ w: 90, h: 30 }, { w: 45 })).toEqual({ w: 45, h: 15 });
  });

  it('recorta por arriba sin perder la relación', () => {
    const r = lockedSize({ w: 50, h: 25 }, { w: 900 });
    expect(r.w).toBeLessThanOrEqual(RANGES.w[1]);
    expect(r.h).toBeLessThanOrEqual(RANGES.h[1]);
    expect(ratio(r)).toBeCloseTo(0.5, 2);
  });

  it('recorta por abajo sin perder la relación', () => {
    const r = lockedSize({ w: 50, h: 25 }, { w: 0.1 });
    expect(r.w).toBeGreaterThanOrEqual(RANGES.w[0]);
    expect(r.h).toBeGreaterThanOrEqual(RANGES.h[0]);
    expect(ratio(r)).toBeCloseTo(0.5, 0);
  });

  it('un elemento muy alargado no baja del alto mínimo', () => {
    const r = lockedSize({ w: 84, h: 0.3 }, { w: 3 });
    expect(r.h).toBeGreaterThanOrEqual(RANGES.h[0]);
  });
});

describe('computeDrag con proporción bloqueada', () => {
  const origin = { x: 10, y: 10, w: 40, h: 20 };

  it('sin bloqueo redimensiona cada eje por separado, como siempre', () => {
    expect(computeDrag('resize', origin, 10, 0).patch).toEqual({ w: 50, h: 20 });
  });

  it('con bloqueo, el ancho manda y el alto lo sigue', () => {
    const p = computeDrag('resize', origin, 10, 0, true).patch;
    expect(p).toEqual({ w: 50, h: 25 });
  });

  it('con bloqueo se conserva la relación aunque el puntero se mueva en vertical', () => {
    const p = computeDrag('resize', origin, 0, 30, true).patch;
    expect(ratio(p)).toBeCloseTo(0.5, 2);
  });

  it('con bloqueo, mover no cambia', () => {
    expect(computeDrag('move', origin, 5, 5, true).patch).toEqual(computeDrag('move', origin, 5, 5).patch);
  });
});
