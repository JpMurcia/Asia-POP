/**
 * Reduce las fotos del catálogo antes de que Chrome las dibuje (feature 005). Es el ÚNICO archivo que usa `sharp`.
 *
 * Chrome incrusta en el PDF el mapa de píxeles de lo que la página le muestra, así que una foto de 1.500 px en un
 * recuadro de 360 px paga los píxeles que sobran (research §0). Cada foto se reduce hasta cubrir su recuadro a 150 ppp
 * (nunca se agranda) y pasa a JPEG; con transparencia real se conserva como PNG para que se vea idéntica. Las copias
 * viven en una carpeta temporal por generación; los originales (caché de Alegra y subidas) solo se leen.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { PhotoTarget } from './photo-target';
import type { PhotoVariants } from './photo-variants';

/** Calidad y submuestreo medidos en research §5: con 4:2:0 los bordes saturados de los empaques perdían demasiado. */
const JPEG_QUALITY = 88;
const CONCURRENCY = 4;

/** Nombres de archivo sin separadores; `.` y `..` quedan fuera aparte. */
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const isSafeName = (name: string): boolean => SAFE_NAME.test(name) && name !== '.' && name !== '..';

/** Fotos que se reducen: las de Alegra descargadas (`/media/cache`) y las que subió la persona (`/media/uploads`). */
const LOCAL_PHOTO = /^\/media\/(cache|uploads)\/([^/]+)$/;

export interface OptimizedPhoto {
  buffer: Buffer;
  ext: 'jpg' | 'png';
}

/**
 * La copia reducida de una foto, o `null` si hay que usar el original: porque no se pudo leer (FR-008) o porque la
 * copia no pesaría menos (FR-007, p. ej. una foto diminuta o un JPEG ya liviano). Nunca lanza.
 */
export async function optimizePhoto(source: Buffer, target: PhotoTarget): Promise<OptimizedPhoto | null> {
  try {
    const meta = await sharp(source).metadata();
    // Un canal alfa totalmente opaco no es transparencia: solo la real obliga a conservar el PNG (FR-006)
    const transparent = meta.hasAlpha === true && !(await sharp(source).stats()).isOpaque;
    // `rotate()` aplica la orientación EXIF; `outside` cubre el recuadro sin recortar y `withoutEnlargement` no agranda
    const resized = sharp(source)
      .rotate()
      .resize({ width: target.w, height: target.h, fit: 'outside', withoutEnlargement: true });
    const result: OptimizedPhoto = transparent
      ? { buffer: await resized.png({ compressionLevel: 9 }).toBuffer(), ext: 'png' }
      : {
          buffer: await resized
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4' })
            .toBuffer(),
          ext: 'jpg',
        };
    return result.buffer.length < source.length ? result : null;
  } catch {
    return null;
  }
}

/**
 * Prepara las copias reducidas de una generación en `<rootDir>/<trabajo>/` y las sirve con `fileFor`. Al crearse borra
 * lo que hubiera en `rootDir` (restos de un cierre brusco).
 */
export class PhotoOptimizer {
  constructor(
    private rootDir: string,
    private sources: { cacheDir: string; uploadsDir: string },
  ) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }

  /** El archivo original de una dirección local de foto, o `null` si no es una foto local de nombre seguro. */
  private sourceFile(url: string): string | null {
    const m = LOCAL_PHOTO.exec(url);
    if (!m || !isSafeName(m[2]!)) return null;
    return path.join(m[1] === 'cache' ? this.sources.cacheDir : this.sources.uploadsDir, m[2]!);
  }

  /**
   * Reduce las fotos de `urls` y devuelve solo las que se redujeron (dirección original → dirección de la copia).
   * Una foto cuyo archivo falta, que no se puede leer o que no pesaría menos se omite sin lanzar: el PDF usa el
   * original. Sin `target` (la plantilla no tiene bloque de productos) no hace nada.
   */
  async run(
    runId: string,
    urls: string[],
    target: PhotoTarget | null,
    onProgress?: (done: number, total: number) => void,
  ): Promise<PhotoVariants> {
    const variants: PhotoVariants = new Map();
    if (!target || !isSafeName(runId)) return variants;
    const jobs = urls.flatMap((url) => {
      const file = this.sourceFile(url);
      return file ? [{ url, file }] : [];
    });
    const dir = path.join(this.rootDir, runId);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const { url, file } = jobs[next++]!;
        try {
          const optimized = await optimizePhoto(await fs.promises.readFile(file), target);
          if (optimized) {
            const name = `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 16)}.${optimized.ext}`;
            await fs.promises.mkdir(dir, { recursive: true });
            await fs.promises.writeFile(path.join(dir, name), optimized.buffer);
            variants.set(url, `/media/pdf/${runId}/${name}`);
          }
        } catch {
          /* se usa el original */
        }
        onProgress?.(++done, jobs.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
    return variants;
  }

  /** Borra las copias de un trabajo; no falla si no existen. */
  cleanup(runId: string): void {
    if (isSafeName(runId)) fs.rmSync(path.join(this.rootDir, runId), { recursive: true, force: true });
  }

  /** La ruta de una copia (para servirla), solo con nombres seguros y si existe. */
  fileFor(runId: string, name: string): string | null {
    if (!isSafeName(runId) || !isSafeName(name)) return null;
    const file = path.join(this.rootDir, runId, name);
    return fs.existsSync(file) ? file : null;
  }
}
