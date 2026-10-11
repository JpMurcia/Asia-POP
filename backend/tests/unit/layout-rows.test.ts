import { describe, expect, it } from 'vitest';
import { PRODUCTS_LAYOUTS, layoutRows, photoScaleLimits, type Rect, type RowLayout } from '../../src/catalog/template-layout';
import { PAGE_H, PAGE_W, type ProductsLayout } from '../../src/catalog/template';

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

// ---------------------------------------------------------------------------------------------------------------
// Feature 007: tamaño de la foto (photoW, photoH) y límites
// ---------------------------------------------------------------------------------------------------------------

/** La geometría de 006, copiada tal cual: con las opciones de origen `layoutRows` debe devolver exactamente esto. */
const legacyRows = (layout: ProductsLayout, W: number, H: number): Omit<RowLayout, 'name'>[] => {
  if (layout === 'alternado') {
    const pitch = (H * 29.1) / 85.2;
    const rowH = (H * 27) / 85.2;
    return Array.from({ length: 3 }, (_, i) => {
      const top = i * pitch;
      const left = i % 2 === 0;
      const priceW = 0.12 * W;
      const priceCenter = (left ? 0.56 : 0.325) * W;
      return {
        photo: { x: (left ? 0.147 : 0.505) * W, y: top, w: 0.29 * W, h: rowH },
        bubble: { x: (left ? 0.4 : 0.125) * W, y: top + 0.19 * rowH, w: 0.4 * W, h: 0.61 * rowH, minH: 0.5 * rowH },
        price: { x: priceCenter - priceW / 2, y: top + 0.82 * rowH, w: priceW, h: 0.15 * rowH },
        align: 'center' as const,
      };
    });
  }
  if (layout === 'tarjetas') {
    const gutter = 0.04 * W;
    const cw = (W - 2 * gutter) / 3;
    const ch = Math.min(cw * 1.15, H * 0.5);
    const bh = H * 0.3;
    const gap = Math.min(14, H * 0.025);
    const ph = Math.min(34, H * 0.07);
    const pw = Math.min(120, cw * 0.9);
    return Array.from({ length: 3 }, (_, i) => {
      const x = i * (cw + gutter);
      return {
        photo: { x, y: 0, w: cw, h: ch },
        bubble: { x, y: ch + gap, w: cw, h: bh },
        price: { x: x + (cw - pw) / 2, y: ch + gap + bh + gap, w: pw, h: ph },
        align: 'center' as const,
      };
    });
  }
  const rh = H / 3;
  const s = Math.min(rh * 0.66, W * 0.3);
  const pad = 0.04 * W;
  const priceW = Math.min(130, W * 0.25);
  const ph = Math.min(30, rh * 0.3);
  return Array.from({ length: 3 }, (_, i) => {
    const y = i * rh;
    const top = y + (rh - s) / 2;
    return {
      photo: { x: 0, y: top, w: s, h: s },
      bubble: { x: s + pad, y: top, w: W - s - pad - priceW - 0.02 * W, h: s },
      price: { x: W - priceW, y: y + rh / 2 - ph / 2, w: priceW, h: ph },
      align: 'left' as const,
      ...(i > 0 ? { separatorY: y } : {}),
    };
  });
};

const ZONES = [box(100, 85.2), box(92, 80), box(88, 80), box(60, 50), box(40, 30)];
const SCALES = [50, 75, 100, 125, 150];

describe.each(PRODUCTS_LAYOUTS)('layoutRows · %s · tamaño de la foto', (layout) => {
  it('sin opciones y con las de origen la geometría es idéntica a la de siempre (SC-004)', () => {
    for (const { W, H } of ZONES) {
      const legacy = legacyRows(layout, W, H);
      for (const got of [layoutRows(layout, W, H), layoutRows(layout, W, H, {}), layoutRows(layout, W, H, { photoW: 100, photoH: 100 })]) {
        expect(got).toHaveLength(3);
        got.forEach((row, i) => {
          for (const part of ['photo', 'bubble', 'price'] as const) {
            for (const k of ['x', 'y', 'w', 'h'] as const) {
              expect(row[part][k], `${layout} ${W}x${H} fila ${i} ${part}.${k}`).toBeCloseTo(legacy[i]![part][k], 9);
            }
          }
          expect(row.align).toBe(legacy[i]!.align);
          expect(row.separatorY).toEqual(legacy[i]!.separatorY);
          expect(row.name).toBeUndefined();
        });
      }
      expect(layoutRows(layout, W, H, { photoW: 100, photoH: 100 })).toEqual(layoutRows(layout, W, H));
    }
  });

  it('con photoW la foto mide ese porcentaje del ancho original y con photoH, del alto', () => {
    const { W, H } = box(92, 80);
    const base = layoutRows(layout, W, H);
    const narrow = layoutRows(layout, W, H, { photoW: 80 });
    const short = layoutRows(layout, W, H, { photoH: 70 });
    for (let i = 0; i < 3; i++) {
      expect(narrow[i]!.photo.w).toBeCloseTo(base[i]!.photo.w * 0.8, 6);
      expect(narrow[i]!.photo.h).toBeCloseTo(base[i]!.photo.h, 6);
      expect(short[i]!.photo.h).toBeCloseTo(base[i]!.photo.h * 0.7, 6);
      expect(short[i]!.photo.w).toBeCloseTo(base[i]!.photo.w, 6);
    }
  });

  it('con una escala menor, cada foto queda centrada en su franja de la fila', () => {
    const { W, H } = box(92, 80);
    const base = layoutRows(layout, W, H);
    for (const photoH of [50, 70, 90]) {
      const rows = layoutRows(layout, W, H, { photoH });
      rows.forEach((row, i) => {
        const strip = base[i]!.photo;
        const centerBase = strip.y + strip.h / 2;
        // en `tarjetas` la foto parte del borde superior y el texto sube; en las otras dos se centra en su franja
        if (layout !== 'tarjetas') expect(row.photo.y + row.photo.h / 2, `${layout} ${photoH} fila ${i}`).toBeCloseTo(centerBase, 6);
        else expect(row.photo.y).toBeCloseTo(0, 6);
      });
    }
  });

  it('la columna de texto (burbuja y precio) conserva su tamaño al achicar la foto', () => {
    const { W, H } = box(92, 80);
    const base = layoutRows(layout, W, H);
    const rows = layoutRows(layout, W, H, { photoW: 60, photoH: 60 });
    rows.forEach((row, i) => {
      expect(row.bubble.h, `${layout} burbuja ${i}`).toBeCloseTo(base[i]!.bubble.h, 6);
      expect(row.price.w).toBeCloseTo(base[i]!.price.w, 6);
      expect(row.price.h).toBeCloseTo(base[i]!.price.h, 6);
      // en `lista` la burbuja se ensancha con el espacio que deja la foto; en las otras conserva el ancho
      if (layout === 'lista') expect(row.bubble.w).toBeGreaterThanOrEqual(base[i]!.bubble.w);
      else expect(row.bubble.w).toBeCloseTo(base[i]!.bubble.w, 6);
    });
  });

  it('invariantes con cualquier escala de 50 a 150 en cualquier zona permitida: nada se sale ni se encima', () => {
    for (const { W, H } of ZONES) {
      for (const photoW of SCALES) {
        for (const photoH of SCALES) {
          const rows = layoutRows(layout, W, H, { photoW, photoH });
          const at = `${layout} ${Math.round(W)}x${Math.round(H)} photoW=${photoW} photoH=${photoH}`;
          expect(rows, at).toHaveLength(3);
          rows.forEach((row, i) => {
            for (const part of ['photo', 'bubble', 'price'] as const) {
              const r = row[part];
              expect(inside(r, W, H), `${at}: ${part} ${i} dentro de la caja`).toBe(true);
              for (const n of [r.x, r.y, r.w, r.h]) expect(Number.isFinite(n)).toBe(true);
              expect(r.w).toBeGreaterThan(0);
              expect(r.h).toBeGreaterThan(0);
            }
            expect(overlap(row.price, row.photo), `${at}: precio/foto ${i}`).toBeNull();
            expect(overlap(row.price, row.bubble), `${at}: precio/burbuja ${i}`).toBeNull();
          });
          for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
              for (const a of ['photo', 'bubble', 'price'] as const) {
                for (const b of ['photo', 'bubble', 'price'] as const) {
                  expect(overlap(rows[i]![a], rows[j]![b]), `${at}: ${a}${i}/${b}${j}`).toBeNull();
                }
              }
            }
          }
          // la burbuja queda del lado de adentro de su foto y nunca se sale por el borde
          if (layout === 'alternado') {
            expect(rows.map((r) => r.bubble.x > r.photo.x), at).toEqual([true, false, true]);
          } else if (layout === 'lista') {
            for (const r of rows) expect(r.bubble.x, at).toBeGreaterThanOrEqual(r.photo.x + r.photo.w);
          }
        }
      }
    }
  });
});

describe('photoScaleLimits', () => {
  it.each(PRODUCTS_LAYOUTS)('%s: el mínimo siempre es 50 y el máximo está entre 50 y 150', (layout) => {
    for (const { W, H } of ZONES) {
      const lim = photoScaleLimits(layout, W, H);
      expect(lim.w[0]).toBe(50);
      expect(lim.h[0]).toBe(50);
      for (const max of [lim.w[1], lim.h[1]]) {
        expect(max).toBeGreaterThanOrEqual(50);
        expect(max).toBeLessThanOrEqual(150);
        expect(Number.isInteger(max)).toBe(true);
      }
    }
  });

  it('alternado con la zona de Neón Noche: el ancho llega a 150 y el alto solo un poco más que 100 (las tres filas ya llenan la zona)', () => {
    const { W, H } = box(100, 85.2);
    const lim = photoScaleLimits('alternado', W, H);
    expect(lim.w[1]).toBe(150);
    expect(lim.h[1]).toBeGreaterThanOrEqual(100);
    expect(lim.h[1]).toBeLessThanOrEqual(130);
  });

  it('tarjetas: las tres columnas llenan el ancho de la zona, así que la foto solo puede crecer un poco', () => {
    const { W, H } = box(92, 76);
    const lim = photoScaleLimits('tarjetas', W, H);
    expect(lim.w[1]).toBeGreaterThanOrEqual(100);
    expect(lim.w[1]).toBeLessThan(120);
    expect(lim.h[1]).toBeGreaterThan(100);
  });

  it('el alto máximo crece con la zona cuando el tamaño de la foto depende de ella (tarjetas, zona baja)', () => {
    const low = photoScaleLimits('tarjetas', box(92, 40).W, box(92, 40).H);
    const tall = photoScaleLimits('tarjetas', box(92, 76).W, box(92, 76).H);
    expect(tall.h[1]).toBeGreaterThanOrEqual(low.h[1]);
  });

  it.each(PRODUCTS_LAYOUTS)('%s: una escala por encima del máximo se dibuja como el máximo', (layout) => {
    for (const { W, H } of ZONES) {
      const lim = photoScaleLimits(layout, W, H);
      expect(layoutRows(layout, W, H, { photoW: 150, photoH: 150 })).toEqual(
        layoutRows(layout, W, H, { photoW: lim.w[1], photoH: lim.h[1] }),
      );
      expect(layoutRows(layout, W, H, { photoW: 5, photoH: 5 })).toEqual(layoutRows(layout, W, H, { photoW: 50, photoH: 50 }));
    }
  });

  it.each(PRODUCTS_LAYOUTS)('%s: con el máximo la foto crece (no queda del mismo tamaño) cuando el máximo es mayor que 100', (layout) => {
    const { W, H } = box(92, 80);
    const lim = photoScaleLimits(layout, W, H);
    const base = layoutRows(layout, W, H);
    if (lim.w[1] > 100) expect(layoutRows(layout, W, H, { photoW: lim.w[1] })[0]!.photo.w).toBeGreaterThan(base[0]!.photo.w);
    if (lim.h[1] > 100) expect(layoutRows(layout, W, H, { photoH: lim.h[1] })[0]!.photo.h).toBeGreaterThan(base[0]!.photo.h);
  });

  it('es determinista y no depende de las escalas pedidas', () => {
    const { W, H } = box(92, 80);
    expect(photoScaleLimits('lista', W, H, { photoW: 60, photoH: 140 })).toEqual(photoScaleLimits('lista', W, H));
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Feature 007: rectángulo del nombre (nameStyle: 'separado')
// ---------------------------------------------------------------------------------------------------------------

/** Alto mínimo legible del rótulo del nombre, en px lógicos (a 6 px de letra caben dos líneas). */
const MIN_NAME_H = 12;

describe.each(PRODUCTS_LAYOUTS)('layoutRows · %s · nombre separado', (layout) => {
  it('con nameStyle burbuja (o sin indicarlo) ninguna fila trae name y la geometría es la de siempre', () => {
    for (const { W, H } of ZONES) {
      for (const opts of [{}, { nameStyle: 'burbuja' as const }]) {
        const rows = layoutRows(layout, W, H, opts);
        for (const row of rows) expect(row.name).toBeUndefined();
        expect(rows).toEqual(layoutRows(layout, W, H));
      }
    }
  });

  it('con separado cada fila trae name, dentro de la caja, con alto legible y sin pisar nada, con cualquier escala', () => {
    for (const { W, H } of ZONES) {
      for (const photoW of SCALES) {
        for (const photoH of SCALES) {
          const rows = layoutRows(layout, W, H, { photoW, photoH, nameStyle: 'separado' });
          const at = `${layout} ${Math.round(W)}x${Math.round(H)} photoW=${photoW} photoH=${photoH}`;
          rows.forEach((row, i) => {
            const name = row.name;
            expect(name, `${at}: fila ${i} trae name`).toBeDefined();
            for (const part of ['photo', 'bubble', 'price', 'name'] as const) {
              const r = row[part]!;
              expect(inside(r, W, H), `${at}: ${part} ${i} dentro de la caja`).toBe(true);
              expect(r.w, `${at}: ${part} ${i} ancho`).toBeGreaterThan(0);
              expect(r.h, `${at}: ${part} ${i} alto`).toBeGreaterThan(0);
            }
            expect(name!.h, `${at}: alto del rótulo ${i}`).toBeGreaterThanOrEqual(MIN_NAME_H);
            for (const other of ['photo', 'bubble', 'price'] as const) {
              expect(overlap(name!, row[other]), `${at}: nombre/${other} ${i}`).toBeNull();
            }
            expect(overlap(row.price, row.photo), `${at}: precio/foto ${i}`).toBeNull();
            expect(overlap(row.price, row.bubble), `${at}: precio/burbuja ${i}`).toBeNull();
          });
          // entre filas nada se toca, tampoco el rótulo
          for (let i = 0; i < 3; i++) {
            for (let j = i + 1; j < 3; j++) {
              for (const a of ['photo', 'bubble', 'price', 'name'] as const) {
                for (const b of ['photo', 'bubble', 'price', 'name'] as const) {
                  expect(overlap(rows[i]![a]!, rows[j]![b]!), `${at}: ${a}${i}/${b}${j}`).toBeNull();
                }
              }
            }
          }
        }
      }
    }
  });

  it('las escalas pedidas por encima del máximo con nombre separado se dibujan como el máximo', () => {
    for (const { W, H } of ZONES) {
      const lim = photoScaleLimits(layout, W, H, { nameStyle: 'separado' });
      expect(lim.w[0]).toBe(50);
      expect(lim.h[0]).toBe(50);
      expect(lim.w[1]).toBeLessThanOrEqual(150);
      expect(lim.h[1]).toBeLessThanOrEqual(150);
      expect(layoutRows(layout, W, H, { photoW: 150, photoH: 150, nameStyle: 'separado' })).toEqual(
        layoutRows(layout, W, H, { photoW: lim.w[1], photoH: lim.h[1], nameStyle: 'separado' }),
      );
    }
  });

  it('el rótulo no recorta lo que ya cabía: con nombre separado el máximo no pasa del que hay sin él', () => {
    for (const { W, H } of ZONES) {
      const plain = photoScaleLimits(layout, W, H);
      const named = photoScaleLimits(layout, W, H, { nameStyle: 'separado' });
      expect(named.w[1]).toBeLessThanOrEqual(plain.w[1]);
      expect(named.h[1]).toBeLessThanOrEqual(plain.h[1]);
    }
  });
});

describe('layoutRows · nombre separado · dónde queda', () => {
  it('alternado: foto, burbuja y precio son los mismos con y sin nombre separado (SC-004)', () => {
    for (const { W, H } of ZONES) {
      const plain = layoutRows('alternado', W, H);
      const named = layoutRows('alternado', W, H, { nameStyle: 'separado' });
      named.forEach((row, i) => {
        expect(row.photo).toEqual(plain[i]!.photo);
        expect(row.bubble).toEqual(plain[i]!.bubble);
        expect(row.price).toEqual(plain[i]!.price);
        expect(row.align).toBe(plain[i]!.align);
      });
    }
  });

  it('alternado: el rótulo ocupa el hueco libre sobre la burbuja, dentro de su ancho y sin pisar la foto', () => {
    const { W, H } = box(100, 85.2);
    const rows = layoutRows('alternado', W, H, { nameStyle: 'separado' });
    rows.forEach((row, i) => {
      const name = row.name!;
      expect(name.x, `fila ${i}`).toBeGreaterThanOrEqual(row.bubble.x - 0.01);
      expect(name.x + name.w, `fila ${i}`).toBeLessThanOrEqual(row.bubble.x + row.bubble.w + 0.01);
      expect(name.y + name.h, `fila ${i}`).toBeLessThanOrEqual(row.bubble.y + 0.01);
      expect(name.y, `fila ${i}`).toBeGreaterThanOrEqual(row.photo.y - 0.01);
      // el ancho es casi el de la burbuja: cede lo que la burbuja se mete bajo la foto y un respiro del lado exterior
      expect(name.w).toBeGreaterThan(0.75 * row.bubble.w);
    });
  });

  it('tarjetas: el rótulo queda entre la foto y la burbuja, con el ancho de la columna', () => {
    const { W, H } = box(92, 76);
    const plain = layoutRows('tarjetas', W, H);
    const rows = layoutRows('tarjetas', W, H, { nameStyle: 'separado' });
    rows.forEach((row, i) => {
      const name = row.name!;
      expect(name.y, `fila ${i}`).toBeGreaterThanOrEqual(row.photo.y + row.photo.h - 0.01);
      expect(row.bubble.y, `fila ${i}`).toBeGreaterThanOrEqual(name.y + name.h - 0.01);
      expect(name.w).toBeCloseTo(row.bubble.w, 6);
      expect(name.x).toBeCloseTo(row.bubble.x, 6);
      // con la zona de siempre la foto no se achica para dejarle sitio
      expect(row.photo.h).toBeCloseTo(plain[i]!.photo.h, 6);
    });
  });

  it('lista: el rótulo queda en la parte alta de la columna de texto y la burbuja debajo, más baja', () => {
    const { W, H } = box(88, 80);
    const plain = layoutRows('lista', W, H);
    const rows = layoutRows('lista', W, H, { nameStyle: 'separado' });
    rows.forEach((row, i) => {
      const name = row.name!;
      expect(name.x).toBeCloseTo(row.bubble.x, 6);
      expect(name.w).toBeCloseTo(row.bubble.w, 6);
      expect(name.y).toBeCloseTo(plain[i]!.bubble.y, 6);
      expect(row.bubble.y).toBeGreaterThanOrEqual(name.y + name.h - 0.01);
      expect(row.bubble.h).toBeLessThan(plain[i]!.bubble.h);
      // la columna de texto sigue ocupando lo mismo en total
      expect(row.bubble.y + row.bubble.h).toBeCloseTo(plain[i]!.bubble.y + plain[i]!.bubble.h, 6);
      expect(row.photo).toEqual(plain[i]!.photo);
    });
  });
});
