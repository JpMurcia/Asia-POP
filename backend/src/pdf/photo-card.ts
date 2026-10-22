/**
 * Foto-tarjeta (feature 010): la imagen vertical de fondo oscuro que se genera para cada producto a partir de su foto.
 * Usa `sharp` y código propio, sin servicios externos (los datos de la tienda no salen de la máquina). Es determinista:
 * las mismas entradas dan los mismos bytes (FR-004). El nombre del producto NO se dibuja aquí: va como texto vectorial
 * encima, dentro de la franja superior reservada, para que el PDF sea nítido, buscable y liviano.
 *
 * Dos modos de fondo (FR-008):
 * - `marco`: la foto completa, sin deformar, dentro de un marco claro de esquinas redondeadas sobre un fondo oscuro
 *   desenfocado hecho con la propia foto. Siempre da un resultado correcto.
 * - `sin-fondo`: el producto recortado flota sobre el fondo oscuro. Solo se acepta si la separación es confiable; ante
 *   la duda se usa `marco` (FR-008a, SC-010).
 */
import sharp from 'sharp';
import type { PhotoBackdrop } from '../catalog/photo-backdrop';

export type { PhotoBackdrop };

/** Por qué una foto pedida en `sin-fondo` se dejó en `marco`. */
export type FallbackReason =
  | 'border_not_uniform'
  | 'subject_too_small'
  | 'subject_too_large'
  | 'subject_cut'
  | 'multiple_subjects'
  | 'error';

/** Súbela cuando cambie cualquier regla de la composición: invalida las tarjetas guardadas en disco. */
export const CARD_ALGO_VERSION = 1;

/** Tamaño de la tarjeta de la base (6,10 × 8,03 cm) a 150 ppp, para cuando la plantilla no fija otro. */
export const DEFAULT_CARD_SIZE = { w: 360, h: 474 } as const;

export interface CardSpec {
  /** Bytes de la foto original. */
  source: Buffer;
  /** Píxeles de la tarjeta (el recuadro de la foto a 150 ppp). */
  w: number;
  h: number;
  /** Color de fondo de la tarjeta, `#RRGGBB`. */
  fill: string;
  backdrop: PhotoBackdrop;
}

export interface CardOutput {
  jpeg: Buffer;
  /** El modo que realmente se aplicó. */
  used: PhotoBackdrop;
  fellBack: boolean;
  reason: FallbackReason | null;
}

const JPEG_QUALITY = 88;
/** Franja superior libre, para el nombre (fracción del alto). */
export const NAME_STRIP = 0.18;
const FRAME_COLOR = '#F4EFE6';
const FRAME_W = 0.03;
const FRAME_RADIUS = 0.05;
const PAD = 0.04;
const BLUR_SIGMA = 0.12;
const DARKEN = 0.82;

/** Umbrales de confianza de `sin-fondo` (research R2). */
const BORDER_UNIFORM_MIN = 0.8;
const SUBJECT_MIN = 0.06;
const SUBJECT_MAX = 0.88;
const BORDER_TOUCH_MAX = 0.05;
const LARGEST_COMPONENT_MIN = 0.85;
/** Distancia de color (euclidiana en RGB) a la que un píxel todavía es «fondo». */
const BG_DISTANCE = 34;
const WORK_SIDE = 640;

class Unreliable extends Error {
  constructor(public reason: FallbackReason) {
    super(reason);
  }
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

/** Las dimensiones de la zona bajo la franja del nombre en la que va la foto. */
function zoneOf(w: number, h: number) {
  const pad = Math.round(PAD * w);
  const top = Math.round(NAME_STRIP * h);
  return { x: pad, y: top, w: w - 2 * pad, h: h - top - pad };
}

const roundedMask = (w: number, h: number, r: number): Buffer =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );

/** Orienta por EXIF y aplana la transparencia sobre blanco; devuelve PNG sin canal alfa. */
async function flattened(source: Buffer): Promise<Buffer> {
  return sharp(source).rotate().flatten({ background: '#ffffff' }).png().toBuffer();
}

async function composeFrame(spec: CardSpec): Promise<Buffer> {
  const { w, h } = spec;
  const fill = hexToRgb(spec.fill);
  const photo = await flattened(spec.source);
  // Fondo: la propia foto a todo el lienzo, desenfocada y oscurecida hacia el color de la tarjeta
  const blurred = await sharp(photo)
    .resize(w, h, { fit: 'cover' })
    .blur(Math.max(0.3, BLUR_SIGMA * w))
    .toBuffer();
  const shade = await sharp({
    create: { width: w, height: h, channels: 4, background: { ...fill, alpha: DARKEN } },
  })
    .png()
    .toBuffer();
  const zone = zoneOf(w, h);
  const border = Math.max(2, Math.round(FRAME_W * w));
  // Foto completa dentro de la zona, sin deformar y sin agrandar (una foto diminuta se muestra a su tamaño)
  const fitted = await sharp(photo)
    .resize({ width: zone.w - 2 * border, height: zone.h - 2 * border, fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const fw = fitted.info.width + 2 * border;
  const fh = fitted.info.height + 2 * border;
  const framed = await sharp({ create: { width: fw, height: fh, channels: 3, background: FRAME_COLOR } })
    .composite([{ input: fitted.data, left: border, top: border }])
    .png()
    .toBuffer();
  const radius = Math.round(FRAME_RADIUS * w);
  const rounded = await sharp(framed)
    .ensureAlpha()
    .composite([{ input: roundedMask(fw, fh, radius), blend: 'dest-in' }])
    .png()
    .toBuffer();
  return sharp(blurred)
    .composite([
      { input: shade, left: 0, top: 0 },
      {
        input: rounded,
        left: zone.x + Math.round((zone.w - fw) / 2),
        top: zone.y + Math.round((zone.h - fh) / 2),
      },
    ])
    .flatten({ background: spec.fill })
    .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

// ---------------------------------------------------------------------------------------------------------------
// Quitar el fondo
// ---------------------------------------------------------------------------------------------------------------

interface Subject {
  /** Máscara 0/255 a la resolución de trabajo. */
  mask: Uint8Array;
  w: number;
  h: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Componentes conexos (8 vecinos) de una máscara; devuelve el tamaño de cada uno y la etiqueta de cada píxel. */
function components(mask: Uint8Array, w: number, h: number): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(w * h);
  const sizes: number[] = [0];
  const stack = new Int32Array(w * h);
  let next = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    next++;
    let count = 0;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    while (sp > 0) {
      const p = stack[--sp]!;
      count++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && !labels[q]) {
            labels[q] = next;
            stack[sp++] = q;
          }
        }
      }
    }
    sizes.push(count);
  }
  return { labels, sizes };
}

/**
 * Separa el producto del fondo: el fondo es lo que se alcanza desde el borde por píxeles parecidos al color del borde.
 * Lanza `Unreliable` con el motivo si no hay confianza suficiente (research R2).
 */
function findSubject(rgb: Buffer, w: number, h: number): Subject {
  const at = (x: number, y: number) => (y * w + x) * 3;
  const borderPixels: number[] = [];
  const ring = Math.max(1, Math.round(Math.min(w, h) * 0.01));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < ring || y < ring || x >= w - ring || y >= h - ring) borderPixels.push(y * w + x);
    }
  }
  // Color del fondo: la mediana por canal del borde
  const median = (channel: number): number => {
    const values = borderPixels.map((p) => rgb[p * 3 + channel]!).sort((a, b) => a - b);
    return values[values.length >> 1]!;
  };
  const bg = [median(0), median(1), median(2)] as const;
  const near = (p: number, limit: number): boolean => {
    const dr = rgb[p * 3]! - bg[0];
    const dg = rgb[p * 3 + 1]! - bg[1];
    const db = rgb[p * 3 + 2]! - bg[2];
    return dr * dr + dg * dg + db * db <= limit * limit;
  };
  const uniform = borderPixels.filter((p) => near(p, BG_DISTANCE)).length / borderPixels.length;
  if (uniform < BORDER_UNIFORM_MIN) throw new Unreliable('border_not_uniform');

  // Relleno por inundación del fondo desde los píxeles del borde que se parecen al fondo (4 vecinos)
  const isBackground = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  for (const p of borderPixels) {
    if (near(p, BG_DISTANCE) && !isBackground[p]) {
      isBackground[p] = 1;
      stack[sp++] = p;
    }
  }
  while (sp > 0) {
    const p = stack[--sp]!;
    const x = p % w;
    const y = (p - x) / w;
    const push = (q: number) => {
      if (!isBackground[q] && near(q, BG_DISTANCE)) {
        isBackground[q] = 1;
        stack[sp++] = q;
      }
    };
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  void at;
  const mask = new Uint8Array(w * h);
  let subjectPixels = 0;
  for (let p = 0; p < mask.length; p++) {
    if (!isBackground[p]) {
      mask[p] = 255;
      subjectPixels++;
    }
  }
  const share = subjectPixels / mask.length;
  if (share < SUBJECT_MIN) throw new Unreliable('subject_too_small');
  if (share > SUBJECT_MAX) throw new Unreliable('subject_too_large');

  const touching = borderPixels.filter((p) => mask[p]).length / borderPixels.length;
  if (touching > BORDER_TOUCH_MAX) throw new Unreliable('subject_cut');

  const { labels, sizes } = components(mask, w, h);
  let largest = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i]! > sizes[largest]!) largest = i;
  if (sizes[largest]! / subjectPixels < LARGEST_COMPONENT_MIN) throw new Unreliable('multiple_subjects');
  // Se descartan las motas diminutas (ruido de compresión); el resto del producto se conserva completo
  const speck = Math.max(4, Math.round(mask.length * 0.0005));
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    if (sizes[labels[p]!]! < speck) {
      mask[p] = 0;
      continue;
    }
    const x = p % w;
    const y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { mask, w, h, bbox: { x0, y0, x1, y1 } };
}

async function composeCutout(spec: CardSpec): Promise<Buffer> {
  const { w, h } = spec;
  const opaque = await flattened(spec.source);
  const meta = await sharp(opaque).metadata();
  const ow = meta.width!;
  const oh = meta.height!;
  const scale = Math.min(1, WORK_SIDE / Math.max(ow, oh));
  const ww = Math.max(1, Math.round(ow * scale));
  const wh = Math.max(1, Math.round(oh * scale));
  const work = await sharp(opaque).resize(ww, wh, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const subject = findSubject(work, ww, wh);

  // Máscara a la resolución original, suavizada para que el borde no quede dentado
  const maskFull = await sharp(Buffer.from(subject.mask), { raw: { width: ww, height: wh, channels: 1 } })
    .resize(ow, oh, { kernel: 'cubic' })
    .blur(1)
    .linear(2.5, -1.0 * 255)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const margin = 0.01;
  const left = Math.max(0, Math.floor((subject.bbox.x0 / ww - margin) * ow));
  const top = Math.max(0, Math.floor((subject.bbox.y0 / wh - margin) * oh));
  const right = Math.min(ow, Math.ceil(((subject.bbox.x1 + 1) / ww + margin) * ow));
  const bottom = Math.min(oh, Math.ceil(((subject.bbox.y1 + 1) / wh + margin) * oh));
  const cropW = right - left;
  const cropH = bottom - top;
  // En dos pasos: `extract` de sharp se aplica antes que `joinChannel`, y la máscara y la foto dejarían de coincidir
  const rgba = await sharp(opaque)
    .joinChannel(maskFull, { raw: { width: ow, height: oh, channels: 1 } })
    .png()
    .toBuffer();
  const product = await sharp(rgba).extract({ left, top, width: cropW, height: cropH }).png().toBuffer();

  const zone = zoneOf(w, h);
  const fitted = await sharp(product)
    .resize({ width: zone.w, height: zone.h, fit: 'inside', withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  return sharp({ create: { width: w, height: h, channels: 3, background: spec.fill } })
    .composite([
      {
        input: fitted.data,
        left: zone.x + Math.round((zone.w - fitted.info.width) / 2),
        top: zone.y + Math.round((zone.h - fitted.info.height) / 2),
      },
    ])
    .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

/**
 * Compone la tarjeta de un producto. Nunca falla por culpa del modo `sin-fondo`: si no hay confianza (o algo sale
 * mal) usa `marco` y lo informa en `fellBack`/`reason`. Solo lanza si la foto no se puede leer en absoluto.
 */
export async function composeCard(spec: CardSpec): Promise<CardOutput> {
  if (spec.backdrop === 'sin-fondo') {
    try {
      return { jpeg: await composeCutout(spec), used: 'sin-fondo', fellBack: false, reason: null };
    } catch (e) {
      const reason: FallbackReason = e instanceof Unreliable ? e.reason : 'error';
      return { jpeg: await composeFrame(spec), used: 'marco', fellBack: true, reason };
    }
  }
  return { jpeg: await composeFrame(spec), used: 'marco', fellBack: false, reason: null };
}
