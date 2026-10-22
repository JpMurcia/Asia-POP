/**
 * Geometría de las tres filas del bloque de productos. Módulo PURO (sin Node): lo usa `ProductsBlock` en el
 * editor, las miniaturas y el PDF, y se prueba sin DOM.
 *
 * Todas las medidas son px lógicos dentro de la caja del bloque (`W` × `H`, con origen en su esquina).
 *
 * Feature 007: la foto puede escalarse (`photoW`, `photoH`, en % de su tamaño original en la distribución
 * elegida) y el nombre puede ir en un rótulo propio (`nameStyle: 'separado'`). Con las opciones de origen
 * (100 %, 100 % y `burbuja`) el resultado es exactamente el de siempre. Una escala que no cabe se recorta al
 * máximo que sí cabe (`photoScaleLimits`), de modo que las filas nunca se salen de la caja ni se encima nada.
 */

import { RANGES, type NameStyle, type ProductsLayout } from './template';

/** Las tres distribuciones generales, que comparten las mismas garantías (nombre separado, escala de la foto). `base` es la medida de la plantilla «Base AsianPop» y se prueba aparte. */
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
  /** Rótulo del nombre: solo con `nameStyle: 'separado'` (con `burbuja` el nombre va dentro de la burbuja). */
  name?: Rect;
  /** Alineación del texto de la burbuja. */
  align: 'center' | 'left';
  /** Línea separadora sobre la fila (solo `lista`, desde la segunda fila). */
  separatorY?: number;
}

/** Opciones del bloque que cambian la geometría. Sin ellas (o con sus valores de origen) todo queda como siempre. */
export interface RowOptions {
  /** % del ancho original de la foto (50 a 150). Por defecto 100. */
  photoW?: number;
  /** % del alto original de la foto (50 a 150). Por defecto 100. */
  photoH?: number;
  /** `separado` pide un rectángulo `name` por fila. Por defecto `burbuja`. */
  nameStyle?: NameStyle;
  /** Cuántos productos tiene la página (feature 010). Con `base` y 1 o 2, las filas se centran en la caja. */
  count?: number;
}

const ROWS = 3;
const [SCALE_MIN, SCALE_MAX] = RANGES.photoScale;
/** Tolerancia al comparar medidas (px lógicos). */
const EPS = 0.01;

/** Escalas ya resueltas (1 = tamaño original) y si hay rótulo de nombre. */
interface Geo {
  sw: number;
  sh: number;
  named: boolean;
  count?: number;
}

/** Sube o baja una caja de alto `h` para que no se salga de `[0, H]`. */
function fitY(y: number, h: number, H: number): number {
  if (y < 0) return 0;
  return y + h > H + 1e-6 ? H - h : y;
}

/** Lo mismo en horizontal. */
function fitX(x: number, w: number, W: number): number {
  if (x < 0) return 0;
  return x + w > W + 1e-6 ? W - w : x;
}

/**
 * `alternado`: la geometría del PDF de la feature 002 (Cat.pdf). Las filas miden el 27 % de la hoja de alto cada
 * 29,1 % y el bloque de Neón Noche abarca 85,2 %, de modo que todo se expresa como fracción del bloque: la foto
 * del 29 % de ancho, la burbuja del 40 % y la etiqueta de precio al 82 % de la fila.
 *
 * La foto crece y se achica hacia afuera: su borde interior (el que se mete bajo la burbuja) no se mueve, así que
 * la burbuja, el precio y el rótulo se quedan donde estaban. En vertical se centra en la franja de su fila sin
 * salirse de la caja. El rótulo del nombre ocupa el hueco libre sobre la burbuja (la burbuja empieza al 19 % de la
 * fila) y cede lo que la burbuja se mete bajo la foto.
 */
function alternado(W: number, H: number, { sw, sh, named }: Geo): RowLayout[] {
  const pitch = (H * 29.1) / 85.2;
  const rowH = (H * 27) / 85.2;
  const photoW = 0.29 * W * sw;
  const photoH = rowH * sh;
  return Array.from({ length: ROWS }, (_, i) => {
    const top = i * pitch;
    const left = i % 2 === 0;
    const priceW = 0.12 * W; // ancho mínimo: la etiqueta se ajusta a su texto, como en 002
    const priceCenter = (left ? 0.56 : 0.325) * W;
    const bubble = { x: (left ? 0.4 : 0.125) * W, y: top + 0.19 * rowH, w: 0.4 * W, h: 0.61 * rowH, minH: 0.5 * rowH };
    const row: RowLayout = {
      photo: {
        x: left ? 0.147 * W + (0.29 * W - photoW) : 0.505 * W,
        y: fitY(top + (rowH - photoH) / 2, photoH, H),
        w: photoW,
        h: photoH,
      },
      bubble,
      price: { x: priceCenter - priceW / 2, y: top + 0.82 * rowH, w: priceW, h: 0.15 * rowH },
      align: 'center' as const,
    };
    if (named) {
      // De la orilla de la foto (con un respiro del 1 % del ancho) hasta cerca del borde exterior de la burbuja: el
      // 3 % de ancho que se deja libre evita el logo de la esquina superior de Neón Noche
      const x = left ? bubble.x + 0.047 * W : bubble.x + 0.03 * W;
      const right = left ? bubble.x + bubble.w - 0.03 * W : 0.495 * W;
      row.name = { x, y: top + 0.01 * rowH, w: right - x, h: 0.17 * rowH };
    }
    return row;
  });
}

/**
 * `tarjetas`: tres columnas con la foto arriba y, debajo, el rótulo del nombre (si lo hay), la burbuja y el precio.
 * La foto se centra en su columna; las de los extremos crecen hacia adentro para no salirse de la caja, y su texto
 * las sigue. El texto baja o sube con la altura de la foto.
 */
function tarjetas(W: number, H: number, { sw, sh, named }: Geo): RowLayout[] {
  const gutter = 0.04 * W;
  const cw = (W - 2 * gutter) / 3;
  const ch = Math.min(cw * 1.15, H * 0.5);
  const bh = H * 0.3;
  const gap = Math.min(14, H * 0.025);
  const ph = Math.min(34, H * 0.07);
  const pw = Math.min(120, cw * 0.9);
  const photoW = cw * sw;
  const photoH = ch * sh;
  const nameH = named ? 0.065 * H : 0;
  const nameGap = named ? gap / 2 : 0;
  return Array.from({ length: ROWS }, (_, i) => {
    const x = i * (cw + gutter);
    const centered = x + (cw - photoW) / 2;
    const photoX = fitX(centered, photoW, W);
    const shift = photoX - centered; // distinto de 0 solo en las columnas de los extremos con la foto más ancha
    const bubbleY = photoH + gap + nameH + nameGap;
    const row: RowLayout = {
      photo: { x: photoX, y: 0, w: photoW, h: photoH },
      bubble: { x: x + shift, y: bubbleY, w: cw, h: bh },
      price: { x: x + (cw - pw) / 2 + shift, y: bubbleY + bh + gap, w: pw, h: ph },
      align: 'center' as const,
    };
    if (named) row.name = { x: x + shift, y: photoH + gap, w: cw, h: nameH };
    return row;
  });
}

/**
 * `lista`: tres filas con la foto a la izquierda, el texto en el centro y el precio a la derecha. La foto se
 * centra en su fila; la burbuja se ensancha o se estrecha con el espacio que deja. Con rótulo, este ocupa la parte
 * alta de la columna de texto y la burbuja queda debajo, más baja.
 */
function lista(W: number, H: number, { sw, sh, named }: Geo): RowLayout[] {
  const rh = H / ROWS;
  const s = Math.min(rh * 0.66, W * 0.3);
  const pad = 0.04 * W;
  const priceW = Math.min(130, W * 0.25);
  const ph = Math.min(30, rh * 0.3);
  const photoW = s * sw;
  const photoH = s * sh;
  const nameH = named ? 0.28 * s : 0;
  const nameGap = named ? 0.04 * s : 0;
  return Array.from({ length: ROWS }, (_, i) => {
    const y = i * rh;
    const top = y + (rh - s) / 2;
    const textX = photoW + pad;
    const textW = W - photoW - pad - priceW - 0.02 * W;
    const row: RowLayout = {
      photo: { x: 0, y: y + (rh - photoH) / 2, w: photoW, h: photoH },
      bubble: { x: textX, y: top + nameH + nameGap, w: textW, h: s - nameH - nameGap },
      price: { x: W - priceW, y: y + rh / 2 - ph / 2, w: priceW, h: ph },
      align: 'left' as const,
      ...(i > 0 ? { separatorY: y } : {}),
    };
    if (named) row.name = { x: textX, y: top, w: textW, h: nameH };
    return row;
  });
}

/**
 * `base` (feature 010): la página de productos de la plantilla «Base AsianPop», medida en la base de Canva (hoja A4 de
 * 21 × 29,7 cm). Las medidas son fracciones de la hoja y se pasan a fracciones de la caja del bloque suponiendo la caja
 * de fábrica (ancho completo, desde el 10 % hasta el 96,4 % de la hoja): si la caja cambia, las filas se escalan con
 * ella, como en las demás distribuciones.
 *
 * Tres filas en zigzag (foto a la izquierda, a la derecha, a la izquierda): la foto-tarjeta mide 6,10 × 8,03 cm, la
 * burbuja beige (10,58 × 5,13 cm) va detrás de la foto y la etiqueta de precio cuelga justo bajo la burbuja. Medido:
 * las tres filas de la página 3 de la base (Posición → Organizar de cada capa, T038). La separación entre filas no es
 * pareja (8,51 y 8,81 cm), por eso cada fila lleva su propia posición.
 */
const BASE_BOX = { y: 0.1, h: 0.864 } as const;
const BASE_PHOTO = { w: 6.1 / 21, h: 8.03 / 29.7, rowY: [3.05 / 29.7, 11.56 / 29.7, 20.37 / 29.7], leftX: 3.14 / 21, rightX: 10.63 / 21 } as const;
const BASE_BUBBLE = { w: 10.58 / 21, h: 5.13 / 29.7, dy: [1.61 / 29.7, 1.61 / 29.7, 1.55 / 29.7], leftX: 6.55 / 21, rightX: 2.64 / 21 } as const;
const BASE_PRICE = { w: 3.45 / 21, h: 1.08 / 29.7, leftCx: (10.9 + 3.45 / 2) / 21, rightCx: (5.36 + 3.45 / 2) / 21 } as const;

function base(W: number, H: number, { sw, sh, count }: Geo): RowLayout[] {
  /** Fracción de la hoja a fracción de la caja (vertical). */
  const fy = (page: number): number => ((page - BASE_BOX.y) / BASE_BOX.h) * H;
  const fh = (page: number): number => (page / BASE_BOX.h) * H;
  const photoW = BASE_PHOTO.w * W * sw;
  const photoH = fh(BASE_PHOTO.h) * sh;
  const rows = Array.from({ length: ROWS }, (_, i): RowLayout => {
    const left = i % 2 === 0;
    const top = fy(BASE_PHOTO.rowY[i]!);
    // La foto crece y se achica desde su centro, sin salirse de la caja
    const cx = (left ? BASE_PHOTO.leftX : BASE_PHOTO.rightX) * W + (BASE_PHOTO.w * W) / 2;
    const cy = top + fh(BASE_PHOTO.h) / 2;
    const bubble: Rect = {
      x: (left ? BASE_BUBBLE.leftX : BASE_BUBBLE.rightX) * W,
      y: top + fh(BASE_BUBBLE.dy[i]!),
      w: BASE_BUBBLE.w * W,
      h: fh(BASE_BUBBLE.h),
    };
    const priceW = BASE_PRICE.w * W;
    return {
      photo: { x: fitX(cx - photoW / 2, photoW, W), y: fitY(cy - photoH / 2, photoH, H), w: photoW, h: photoH },
      bubble,
      price: {
        x: (left ? BASE_PRICE.leftCx : BASE_PRICE.rightCx) * W - priceW / 2,
        y: bubble.y + bubble.h,
        w: priceW,
        h: fh(BASE_PRICE.h),
      },
      align: 'center',
    };
  });
  if (count === undefined || count >= ROWS || count < 1) return rows;
  // Con 1 o 2 productos las filas se centran en la caja: sin huecos abajo (FR-015)
  const used = rows.slice(0, count).flatMap((r) => [r.photo, r.bubble, r.price]);
  const top = Math.min(...used.map((r) => r.y));
  const bottom = Math.max(...used.map((r) => r.y + r.h));
  const shift = (H - (bottom - top)) / 2 - top;
  for (const r of rows) {
    r.photo.y += shift;
    r.bubble.y += shift;
    r.price.y += shift;
  }
  return rows;
}

function build(layout: ProductsLayout, W: number, H: number, geo: Geo): RowLayout[] {
  if (layout === 'base') return base(W, H, geo);
  if (layout === 'tarjetas') return tarjetas(W, H, geo);
  if (layout === 'lista') return lista(W, H, geo);
  return alternado(W, H, geo);
}

// ---------------------------------------------------------------------------------------------------------------
// Límites de la foto
// ---------------------------------------------------------------------------------------------------------------

const partsOf = (row: RowLayout): Rect[] => (row.name ? [row.photo, row.bubble, row.price, row.name] : [row.photo, row.bubble, row.price]);

const isInside = (r: Rect, W: number, H: number): boolean =>
  r.x >= -EPS && r.y >= -EPS && r.x + r.w <= W + EPS && r.y + r.h <= H + EPS;

/** `true` si las dos cajas se encuentran a menos de `margin` una de otra (con `margin` 0, si se encimen). */
function touches(a: Rect, b: Rect, margin = 0): boolean {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > EPS - margin && oy > EPS - margin;
}

/**
 * `true` si las tres filas caben: todo dentro de la caja, el precio y el rótulo sin pisar la foto ni la burbuja de
 * su fila, y nada de una fila a menos del 0,5 % del alto de la caja de otra. La burbuja de `alternado` sí puede
 * meterse bajo el borde de su foto (como en Cat.pdf).
 */
function fits(rows: RowLayout[], layout: ProductsLayout, W: number, H: number): boolean {
  for (const row of rows) {
    if (!partsOf(row).every((r) => isInside(r, W, H))) return false;
    if (touches(row.price, row.photo) || touches(row.price, row.bubble)) return false;
    if (row.name && [row.photo, row.bubble, row.price].some((r) => touches(row.name!, r))) return false;
    // La burbuja de `lista` no baja del 30 % del ancho: más angosta no se lee
    if (layout === 'lista' && row.bubble.w < 0.3 * W) return false;
  }
  const sep = 0.005 * H;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      for (const a of partsOf(rows[i]!)) {
        for (const b of partsOf(rows[j]!)) if (touches(a, b, sep)) return false;
      }
    }
  }
  return true;
}

interface Limits {
  w: number;
  h: number;
}

const limitCache = new Map<string, Limits>();

/**
 * Mayor escala entera (en %) de cada eje con la que las tres filas siguen cabiendo. Cada eje se busca con el otro
 * en su tamaño original (la geometría es separable: el ancho de la foto no cambia lo que cabe en alto y al revés).
 * Sin rótulo, el tamaño original siempre cabe (es la geometría de siempre); con rótulo, el máximo puede ser menor
 * que 100 en una zona muy ajustada.
 */
function limitsFor(layout: ProductsLayout, W: number, H: number, named: boolean): Limits {
  const key = `${layout}|${W}|${H}|${named}`;
  const hit = limitCache.get(key);
  if (hit) return hit;
  const search = (axis: 'w' | 'h'): number => {
    for (let v: number = SCALE_MAX; v >= SCALE_MIN; v--) {
      const geo: Geo = { sw: axis === 'w' ? v / 100 : 1, sh: axis === 'h' ? v / 100 : 1, named };
      if (fits(build(layout, W, H, geo), layout, W, H)) return v;
      if (v === 100 && !named) return 100;
    }
    return SCALE_MIN;
  };
  const limits = { w: search('w'), h: search('h') };
  if (limitCache.size > 500) limitCache.clear();
  limitCache.set(key, limits);
  return limits;
}

/**
 * Los límites `[mínimo, máximo]`, en %, de `photoW` y `photoH` para una caja `W` × `H`. El mínimo es siempre 50; el
 * máximo depende de la distribución, de la zona y de si el nombre va en su propio rótulo (`opts.nameStyle`). Las
 * escalas que traiga `opts` no cambian el resultado.
 */
export function photoScaleLimits(
  layout: ProductsLayout,
  W: number,
  H: number,
  opts: RowOptions = {},
): { w: [number, number]; h: [number, number] } {
  const max = limitsFor(layout, W, H, opts.nameStyle === 'separado');
  return { w: [SCALE_MIN, max.w], h: [SCALE_MIN, max.h] };
}

/** Una escala en % a fracción, dentro de su rango; un valor ausente o no numérico vale 100. */
function toScale(percent: number | undefined): number {
  if (percent === undefined || !Number.isFinite(percent)) return 1;
  return Math.min(Math.max(percent, SCALE_MIN), SCALE_MAX) / 100;
}

/** Tres filas (los productos de una página son 3 como máximo) para la distribución indicada. */
export function layoutRows(layout: ProductsLayout, W: number, H: number, opts: RowOptions = {}): RowLayout[] {
  const named = opts.nameStyle === 'separado';
  let sw = toScale(opts.photoW);
  let sh = toScale(opts.photoH);
  // Sin rótulo y sin agrandar, todo cabe por construcción: no hace falta buscar los límites
  if (named || sw > 1 || sh > 1) {
    const max = limitsFor(layout, W, H, named);
    sw = Math.min(sw, max.w / 100);
    sh = Math.min(sh, max.h / 100);
  }
  return build(layout, W, H, { sw, sh, named, count: opts.count });
}
