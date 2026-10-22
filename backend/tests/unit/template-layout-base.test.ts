import { describe, expect, it } from 'vitest';
import { PAGE_H, PAGE_W } from '../../src/catalog/template';
import { layoutRows, photoScaleLimits, type Rect } from '../../src/catalog/template-layout';

/** Feature 010: la distribución `base`, medida en la base de Canva (A4 de 21 × 29,7 cm). */
// Caja de fábrica de la plantilla Base AsianPop: ancho completo, del 11 % al 96,4 % de la hoja
const W = PAGE_W;
const H = 0.854 * PAGE_H;
const CM_X = PAGE_W / 21; // px lógicos por cm, en horizontal
const CM_Y = PAGE_H / 29.7;
/** Una caja en cm de la hoja, pasada a px de la caja del bloque. */
const sheetY = (cm: number): number => cm * CM_Y - 0.11 * PAGE_H;

const rows = (count?: number, over: Parameters<typeof layoutRows>[3] = {}) => layoutRows('base', W, H, { ...over, count });
const inside = (r: Rect) => r.x >= -0.01 && r.y >= -0.01 && r.x + r.w <= W + 0.01 && r.y + r.h <= H + 0.01;
const overlap = (a: Rect, b: Rect) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.01 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.01;

describe('layoutRows · base', () => {
  it('devuelve 3 filas en zigzag: foto a la izquierda, a la derecha y a la izquierda', () => {
    const r = rows();
    expect(r).toHaveLength(3);
    expect(r[0]!.photo.x).toBeLessThan(r[1]!.photo.x);
    expect(r[2]!.photo.x).toBeCloseTo(r[0]!.photo.x, 6);
    expect(r.every((row) => row.align === 'center')).toBe(true);
  });

  it('la foto-tarjeta mide 6,10 × 8,03 cm y la burbuja 10,58 × 5,13 cm (medido, ±2 mm)', () => {
    for (const row of rows()) {
      expect(row.photo.w / CM_X).toBeCloseTo(6.1, 1);
      expect(row.photo.h / CM_Y).toBeCloseTo(8.03, 1);
      expect(row.bubble.w / CM_X).toBeCloseTo(10.58, 1);
      expect(row.bubble.h / CM_Y).toBeCloseTo(5.13, 1);
      expect(row.price.w / CM_X).toBeCloseTo(3.45, 1);
      expect(row.price.h / CM_Y).toBeCloseTo(1.08, 1);
    }
  });

  it('la fila 3 coincide con las posiciones medidas de la página 3 (marco X 3,14 · Y 20,37; burbuja X 6,55 · Y 21,92; precio X 10,9 · Y 27,05)', () => {
    const row = rows()[2]!;
    expect(row.photo.x / CM_X).toBeCloseTo(3.14, 1);
    expect(row.photo.y).toBeCloseTo(sheetY(20.37), 0);
    expect(row.bubble.x / CM_X).toBeCloseTo(6.55, 1);
    expect(row.bubble.y).toBeCloseTo(sheetY(21.92), 0);
    expect(row.price.x / CM_X).toBeCloseTo(10.9, 1);
    expect(row.price.y).toBeCloseTo(sheetY(27.05), 0);
  });

  it('el precio cuelga justo bajo la burbuja y no pisa la foto', () => {
    for (const row of rows()) {
      expect(row.price.y).toBeCloseTo(row.bubble.y + row.bubble.h, 6);
      expect(overlap(row.price, row.photo)).toBe(false);
    }
  });

  it('la burbuja se mete bajo la foto: se solapan en horizontal', () => {
    for (const row of rows()) expect(overlap(row.bubble, row.photo)).toBe(true);
  });

  it('con 3 productos todo cabe en la caja y las filas no se pisan', () => {
    const r = rows(3);
    for (const row of r) for (const part of [row.photo, row.bubble, row.price]) expect(inside(part)).toBe(true);
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        for (const a of [r[i]!.photo, r[i]!.bubble, r[i]!.price]) {
          for (const b of [r[j]!.photo, r[j]!.bubble, r[j]!.price]) expect(overlap(a, b)).toBe(false);
        }
      }
    }
  });

  it.each([0, 3, 4, 7])('con %s productos (la última página de 3 en 3) no mueve las filas', (count) => {
    expect(rows(count)).toEqual(rows(3));
  });

  it.each([1, 2])('con %s producto(s) las filas se centran verticalmente en la caja, sin huecos (FR-015)', (count) => {
    const r = rows(count).slice(0, count);
    const parts = r.flatMap((row) => [row.photo, row.bubble, row.price]);
    const top = Math.min(...parts.map((p) => p.y));
    const bottom = Math.max(...parts.map((p) => p.y + p.h));
    expect(top).toBeCloseTo(H - bottom, 4); // mismo margen arriba y abajo
    for (const p of parts) expect(inside(p)).toBe(true);
    // Sigue el zigzag: la primera foto a la izquierda, la segunda a la derecha
    if (count === 2) expect(r[0]!.photo.x).toBeLessThan(r[1]!.photo.x);
  });

  it('una foto escalada crece desde su centro sin salirse de la caja ni pisar la fila de al lado', () => {
    const limits = photoScaleLimits('base', W, H);
    expect(limits.w[1]).toBeGreaterThanOrEqual(100);
    expect(limits.h[1]).toBeGreaterThanOrEqual(100);
    const small = rows(3, { photoW: 50, photoH: 50 });
    const original = rows(3);
    for (let i = 0; i < 3; i++) {
      expect(small[i]!.photo.w).toBeCloseTo(original[i]!.photo.w / 2, 6);
      expect(small[i]!.photo.x + small[i]!.photo.w / 2).toBeCloseTo(original[i]!.photo.x + original[i]!.photo.w / 2, 6);
      expect(inside(small[i]!.photo)).toBe(true);
    }
  });

  it('se adapta a otras cajas: todo queda dentro', () => {
    for (const [w, h] of [[92, 80], [60, 50], [88, 80]] as const) {
      const bw = (w / 100) * PAGE_W;
      const bh = (h / 100) * PAGE_H;
      for (const row of layoutRows('base', bw, bh)) {
        for (const part of [row.photo, row.bubble, row.price]) {
          expect(part.x >= -0.01 && part.y >= -0.01 && part.x + part.w <= bw + 0.01 && part.y + part.h <= bh + 0.01).toBe(true);
        }
      }
    }
  });
});
