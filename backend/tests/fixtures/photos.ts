/**
 * Fotos sintéticas para las pruebas de la feature 005 (PDF liviano). Se crean con `sharp` y ruido pseudoaleatorio con
 * semilla fija, así que son reproducibles; las que llevan ruido pesan mucho como PNG, igual que las del catálogo real.
 * Cada función devuelve los bytes de la foto y memoriza el resultado. Todas pesan menos de 5 MB (tope de las subidas
 * del usuario) y menos de 10 MB (tope de la descarga de `ImageCache`).
 */
import sharp from 'sharp';

/** Medidas de cada foto, para que las pruebas calculen lo esperado sin volver a leerlas. */
export const PHOTO_SIZES = {
  heavyPng: { w: 900, h: 1200 },
  heavyJpeg: { w: 1600, h: 1200 },
  transparentPng: { w: 800, h: 1000 },
  opaqueAlphaPng: { w: 800, h: 1000 },
  tinyPng: { w: 40, h: 40 },
  belowTargetPng: { w: 300, h: 300 },
  lightJpeg: { w: 360, h: 474 },
  /** Medidas almacenadas; con la orientación EXIF 6 se muestra de 800 × 1200. */
  exifJpeg: { w: 1200, h: 800 },
  staticGif: { w: 600, h: 600 },
} as const;

/** Generador pseudoaleatorio determinista (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Píxeles crudos: un degradado con ruido de amplitud `amp` (mayor `amp`, más pesa la foto al comprimirla). */
function pattern(w: number, h: number, channels: 3 | 4, seed: number, amp: number): Buffer {
  const rand = rng(seed);
  const out = Buffer.alloc(w * h * channels);
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const base = [(x / w) * 255, (y / h) * 255, ((x + y) / (w + h)) * 255];
      for (let c = 0; c < 3; c++) {
        out[i++] = Math.max(0, Math.min(255, Math.round(base[c]! + (rand() - 0.5) * 2 * amp)));
      }
      if (channels === 4) out[i++] = 255;
    }
  }
  return out;
}

const memo = new Map<string, Promise<Buffer>>();
const once = (key: string, make: () => Promise<Buffer>): Promise<Buffer> => {
  let p = memo.get(key);
  if (!p) memo.set(key, (p = make()));
  return p;
};

const raw = (w: number, h: number, channels: 3 | 4) => ({ raw: { width: w, height: h, channels } });

/** PNG opaco grande (900 × 1200): pesa varios MB como archivo. */
export const heavyPng = () =>
  once('heavyPng', () => {
    const { w, h } = PHOTO_SIZES.heavyPng;
    return sharp(pattern(w, h, 3, 1, 64), raw(w, h, 3)).png({ compressionLevel: 3 }).toBuffer();
  });

/** JPEG opaco grande (1600 × 1200). */
export const heavyJpeg = () =>
  once('heavyJpeg', () => {
    const { w, h } = PHOTO_SIZES.heavyJpeg;
    return sharp(pattern(w, h, 3, 2, 40), raw(w, h, 3)).jpeg({ quality: 95 }).toBuffer();
  });

/** PNG con transparencia real: un círculo opaco y el resto de alfa 0 (el píxel (0,0) es transparente). */
export const transparentPng = () =>
  once('transparentPng', async () => {
    const { w, h } = PHOTO_SIZES.transparentPng;
    const px = pattern(w, h, 4, 3, 48);
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.41;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
        px[(y * w + x) * 4 + 3] = inside ? 255 : 0;
      }
    }
    return sharp(px, raw(w, h, 4)).png({ compressionLevel: 3 }).toBuffer();
  });

/** PNG con canal alfa en el que **todos** los píxeles son opacos: no tiene transparencia real. */
export const opaqueAlphaPng = () =>
  once('opaqueAlphaPng', () => {
    const { w, h } = PHOTO_SIZES.opaqueAlphaPng;
    return sharp(pattern(w, h, 4, 4, 48), raw(w, h, 4)).png({ compressionLevel: 3 }).toBuffer();
  });

/** PNG diminuto y liso (40 × 40): como PNG pesa menos que cualquier JPEG, así que no hay nada que optimizar. */
export const tinyPng = () =>
  once('tinyPng', () => {
    const { w, h } = PHOTO_SIZES.tinyPng;
    return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 40, b: 60 } } })
      .png()
      .toBuffer();
  });

/**
 * PNG de 300 × 300, menor que el recuadro de la tarjeta en ambos ejes pero pesado (PNG sin comprimir): se puede
 * recomprimir a JPEG sin agrandarlo.
 */
export const belowTargetPng = () =>
  once('belowTargetPng', () => {
    const { w, h } = PHOTO_SIZES.belowTargetPng;
    return sharp(pattern(w, h, 3, 9, 10), raw(w, h, 3)).png({ compressionLevel: 0 }).toBuffer();
  });

/** JPEG ya liviano al tamaño de la tarjeta (360 × 474, calidad 40): recomprimirlo la haría más pesada. */
export const lightJpeg = () =>
  once('lightJpeg', () => {
    const { w, h } = PHOTO_SIZES.lightJpeg;
    return sharp(pattern(w, h, 3, 5, 6), raw(w, h, 3)).jpeg({ quality: 40 }).toBuffer();
  });

/** JPEG de 1200 × 800 con orientación EXIF 6: al aplicarla se ve de 800 × 1200 (más alto que ancho). */
export const exifJpeg = () =>
  once('exifJpeg', () => {
    const { w, h } = PHOTO_SIZES.exifJpeg;
    return sharp(pattern(w, h, 3, 6, 30), raw(w, h, 3)).jpeg({ quality: 85 }).withMetadata({ orientation: 6 }).toBuffer();
  });

/** Empieza como un JPEG (`FF D8 FF`, así que `sniffImage` la acepta) pero sigue con basura: no se puede decodificar. */
export const brokenJpeg = () =>
  once('brokenJpeg', async () => {
    const rand = rng(7);
    const junk = Buffer.alloc(4096);
    for (let i = 0; i < junk.length; i++) junk[i] = Math.floor(rand() * 256);
    return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), junk]);
  });

/** GIF de un solo cuadro (600 × 600). */
export const staticGif = () =>
  once('staticGif', () => {
    const { w, h } = PHOTO_SIZES.staticGif;
    return sharp(pattern(w, h, 3, 8, 20), raw(w, h, 3)).gif().toBuffer();
  });
