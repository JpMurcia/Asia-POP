/**
 * Geometría de las tres filas del bloque de productos. Módulo PURO (sin Node): lo usa `ProductsBlock` en el
 * editor, las miniaturas y el PDF, y se prueba sin DOM.
 *
 * Todas las medidas son px lógicos dentro de la caja del bloque (`W` × `H`, con origen en su esquina).
 */

import type { ProductsLayout } from './template';

export const PRODUCTS_LAYOUTS = ['alternado', 'tarjetas', 'lista'] as const satisfies readonly ProductsLayout[];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Altura mínima cuando la caja puede crecer con su contenido hasta `h` (la burbuja de `alternado`). */
  minH?: number;
}

export interface RowLayout {
  photo: Rect;
  bubble: Rect;
  /** Etiqueta de precio: `w` es el ancho mínimo; el texto puede ensancharla alrededor de su centro. */
  price: Rect;
  /** Alineación del texto de la burbuja. */
  align: 'center' | 'left';
  /** Línea separadora sobre la fila (solo `lista`, desde la segunda fila). */
  separatorY?: number;
}

const ROWS = 3;

/**
 * `alternado`: la geometría del PDF de la feature 002 (Cat.pdf). Las filas miden el 27 % de la hoja de alto cada
 * 29,1 % y el bloque de Neón Noche abarca 85,2 %, de modo que todo se expresa como fracción del bloque: la foto
 * del 29 % de ancho, la burbuja del 40 % y la etiqueta de precio al 82 % de la fila.
 */
function alternado(W: number, H: number): RowLayout[] {
  const pitch = (H * 29.1) / 85.2;
  const rowH = (H * 27) / 85.2;
  return Array.from({ length: ROWS }, (_, i) => {
    const top = i * pitch;
    const left = i % 2 === 0;
    const priceW = 0.12 * W; // ancho mínimo: la etiqueta se ajusta a su texto, como en 002
    const priceCenter = (left ? 0.56 : 0.325) * W;
    return {
      photo: { x: (left ? 0.147 : 0.505) * W, y: top, w: 0.29 * W, h: rowH },
      bubble: { x: (left ? 0.4 : 0.125) * W, y: top + 0.19 * rowH, w: 0.4 * W, h: 0.61 * rowH, minH: 0.5 * rowH },
      price: { x: priceCenter - priceW / 2, y: top + 0.82 * rowH, w: priceW, h: 0.15 * rowH },
      align: 'center' as const,
    };
  });
}

/** `tarjetas`: tres columnas con la foto arriba y, debajo, la burbuja y el precio. */
function tarjetas(W: number, H: number): RowLayout[] {
  const gutter = 0.04 * W;
  const cw = (W - 2 * gutter) / 3;
  const ch = Math.min(cw * 1.15, H * 0.5);
  const bh = H * 0.3;
  const gap = Math.min(14, H * 0.025);
  const ph = Math.min(34, H * 0.07);
  const pw = Math.min(120, cw * 0.9);
  return Array.from({ length: ROWS }, (_, i) => {
    const x = i * (cw + gutter);
    return {
      photo: { x, y: 0, w: cw, h: ch },
      bubble: { x, y: ch + gap, w: cw, h: bh },
      price: { x: x + (cw - pw) / 2, y: ch + gap + bh + gap, w: pw, h: ph },
      align: 'center' as const,
    };
  });
}

/** `lista`: tres filas con la foto a la izquierda, el texto en el centro y el precio a la derecha. */
function lista(W: number, H: number): RowLayout[] {
  const rh = H / ROWS;
  const s = Math.min(rh * 0.66, W * 0.3);
  const pad = 0.04 * W;
  const priceW = Math.min(130, W * 0.25);
  const ph = Math.min(30, rh * 0.3);
  return Array.from({ length: ROWS }, (_, i) => {
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
}

/** Tres filas (los productos de una página son 3 como máximo) para la distribución indicada. */
export function layoutRows(layout: ProductsLayout, W: number, H: number): RowLayout[] {
  if (layout === 'tarjetas') return tarjetas(W, H);
  if (layout === 'lista') return lista(W, H);
  return alternado(W, H);
}
