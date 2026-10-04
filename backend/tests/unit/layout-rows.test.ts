import { describe, expect, it } from 'vitest';
import { PRODUCTS_LAYOUTS, layoutRows, type Rect } from '../../src/catalog/template-layout';
import { PAGE_H, PAGE_W } from '../../src/catalog/template';

/** Caja del bloque de productos en px lógicos para un bloque de `w` % × `h` % de la página. */
const box = (wPct: number, hPct: number) => ({ W: (wPct / 100) * PAGE_W, H: (hPct / 100) * PAGE_H });

const inside = (r: Rect, W: number, H: number) =>
  r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= W + 0.01 && r.y + r.h <= H + 0.01;
const overlap = (a: Rect, b: Rect) => {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > 0.01 && oy > 0.01 ? { ox, oy } : null;
};

const SIZES = [
  box(100, 85.2), // Neón Noche
  box(92, 80), // tamaño por defecto de un bloque nuevo
  box(88, 80),
  box(60, 50),
  box(50, 40),
];

describe.each(PRODUCTS_LAYOUTS)('layoutRows · %s', (layout) => {
  it('siempre devuelve 3 filas', () => {
    for (const { W, H } of SIZES) expect(layoutRows(layout, W, H)).toHaveLength(3);
  });

  it('foto, burbuja y precio de cada fila caben dentro de la caja del bloque', () => {
    for (const { W, H } of SIZES) {
      for (const [i, row] of layoutRows(layout, W, H).entries()) {
        expect(inside(row.photo, W, H), `foto ${i} en ${W}x${H}`).toBe(true);
        expect(inside(row.bubble, W, H), `burbuja ${i} en ${W}x${H}`).toBe(true);
        expect(inside(row.price, W, H), `precio ${i} en ${W}x${H}`).toBe(true);
      }
    }
  });

  it('el precio no se solapa con la foto ni con la burbuja de su fila', () => {
    for (const { W, H } of SIZES) {
      for (const [i, row] of layoutRows(layout, W, H).entries()) {
        expect(overlap(row.price, row.photo), `precio/foto ${i} en ${W}x${H}`).toBeNull();
        expect(overlap(row.price, row.bubble), `precio/burbuja ${i} en ${W}x${H}`).toBeNull();
      }
    }
  });

  it('las filas no se pisan entre sí', () => {
    for (const { W, H } of SIZES) {
      const rows = layoutRows(layout, W, H);
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          for (const part of ['photo', 'bubble', 'price'] as const) {
            for (const other of ['photo', 'bubble', 'price'] as const) {
              expect(overlap(rows[i]![part], rows[j]![other]), `${part}${i}/${other}${j} en ${W}x${H}`).toBeNull();
            }
          }
        }
      }
    }
  });

  it('es determinista', () => {
    expect(layoutRows(layout, 500, 600)).toEqual(layoutRows(layout, 500, 600));
  });

  it('las medidas son positivas y finitas', () => {
    for (const { W, H } of SIZES) {
      for (const row of layoutRows(layout, W, H)) {
        for (const r of [row.photo, row.bubble, row.price]) {
          for (const n of [r.x, r.y, r.w, r.h]) expect(Number.isFinite(n)).toBe(true);
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('layoutRows · alternado', () => {
  const { W, H } = box(100, 85.2);
  const rows = layoutRows('alternado', W, H);

  it('alterna la foto entre izquierda y derecha', () => {
    expect(rows.map((r) => r.photo.x < W / 2)).toEqual([true, false, true]);
    expect(rows.map((r) => r.bubble.x > r.photo.x)).toEqual([true, false, true]);
  });

  it('la burbuja puede pisar el borde de la foto, como en Cat.pdf (hasta el 6 % del ancho)', () => {
    for (const r of rows) {
      const o = overlap(r.photo, r.bubble);
      if (o) expect(o.ox).toBeLessThanOrEqual(0.06 * W);
    }
  });

  it('la burbuja centra su texto', () => {
    expect(rows.every((r) => r.align === 'center')).toBe(true);
  });

  it('reproduce la geometría del PDF de 002 (valores de referencia)', () => {
    // 002: fila de 27 % de alto cada 29,1 % de la hoja, primera fila al 10,4 %; el bloque de Neón Noche
    // empieza en y = 10,4 % y mide 85,2 % de alto, así que las filas quedan en 0, 29,1 y 58,2 de 85,2.
    const pct = (px: number) => (px / H) * 85.2; // altura de la hoja (%) que ocupa un valor vertical del bloque
    const wp = (px: number) => (px / W) * 100; // ancho (%) respecto del bloque = ancho de la hoja
    expect(pct(rows[0]!.photo.y)).toBeCloseTo(0, 1);
    expect(pct(rows[1]!.photo.y)).toBeCloseTo(29.1, 1);
    expect(pct(rows[2]!.photo.y)).toBeCloseTo(58.2, 1);
    expect(pct(rows[0]!.photo.h)).toBeCloseTo(27, 1);
    // fotos del 29 % de ancho: a 14,7 % del borde izquierdo (filas izquierdas) y a 20,5 % del derecho (derechas)
    expect(wp(rows[0]!.photo.w)).toBeCloseTo(29, 1);
    expect(wp(rows[0]!.photo.x)).toBeCloseTo(14.7, 1);
    expect(100 - wp(rows[1]!.photo.x + rows[1]!.photo.w)).toBeCloseTo(20.5, 1);
    // burbuja del 40 % de ancho: a 40 % (fila izquierda) y a 12,5 % (derecha); empieza al 19 % de la fila
    expect(wp(rows[0]!.bubble.w)).toBeCloseTo(40, 1);
    expect(wp(rows[0]!.bubble.x)).toBeCloseTo(40, 1);
    expect(wp(rows[1]!.bubble.x)).toBeCloseTo(12.5, 1);
    const rowH = rows[0]!.photo.h;
    expect((rows[0]!.bubble.y - rows[0]!.photo.y) / rowH).toBeCloseTo(0.19, 2);
    // altura de la burbuja: entre el 50 % y el 61 % de la fila
    expect(rows[0]!.bubble.minH! / rowH).toBeCloseTo(0.5, 2);
    expect(rows[0]!.bubble.h / rowH).toBeCloseTo(0.61, 2);
    // etiqueta de precio: arriba al 82 % de la fila y centrada en el 56 % (izquierda) / 32,5 % (derecha)
    expect((rows[0]!.price.y - rows[0]!.photo.y) / rowH).toBeCloseTo(0.82, 2);
    expect(wp(rows[0]!.price.x + rows[0]!.price.w / 2)).toBeCloseTo(56, 1);
    expect(wp(rows[1]!.price.x + rows[1]!.price.w / 2)).toBeCloseTo(32.5, 1);
  });
});

describe('layoutRows · tarjetas', () => {
  it('pone las tres filas en columnas, de izquierda a derecha, con la burbuja y el precio bajo la foto', () => {
    const { W, H } = box(92, 80);
    const rows = layoutRows('tarjetas', W, H);
    expect(rows[0]!.photo.x).toBeLessThan(rows[1]!.photo.x);
    expect(rows[1]!.photo.x).toBeLessThan(rows[2]!.photo.x);
    for (const r of rows) {
      expect(r.bubble.y).toBeGreaterThanOrEqual(r.photo.y + r.photo.h);
      expect(r.price.y).toBeGreaterThanOrEqual(r.bubble.y + r.bubble.h);
      expect(r.separatorY).toBeUndefined();
    }
  });
});

describe('layoutRows · lista', () => {
  it('apila las filas, alinea el texto a la izquierda y marca un separador entre filas', () => {
    const { W, H } = box(88, 80);
    const rows = layoutRows('lista', W, H);
    expect(rows[0]!.photo.y).toBeLessThan(rows[1]!.photo.y);
    expect(rows[1]!.photo.y).toBeLessThan(rows[2]!.photo.y);
    expect(rows.every((r) => r.align === 'left')).toBe(true);
    expect(rows[0]!.separatorY).toBeUndefined();
    expect(rows[1]!.separatorY).toBeCloseTo(H / 3, 1);
    expect(rows[2]!.separatorY).toBeCloseTo((2 * H) / 3, 1);
  });
});
