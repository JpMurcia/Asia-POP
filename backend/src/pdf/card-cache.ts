/**
 * Caché en disco de las foto-tarjetas (feature 010) y el servicio que las pide. Una tarjeta se identifica por su foto
 * (archivo, tamaño y fecha), el modo de fondo, el tamaño, el color de relleno y la versión del algoritmo: mientras no
 * cambie nada de eso se reutiliza y no se vuelve a componer (FR-024). La carpeta es temporal: se vacía al arrancar,
 * como la de las copias reducidas del PDF.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PhotoBackdrop } from '../catalog/photo-backdrop';
import type { CatalogPayload } from '../catalog/types';
import { collectPhotoUrls, withPhotoVariants, type PhotoVariants } from './photo-variants';
import { CARD_ALGO_VERSION, composeCard, type FallbackReason } from './photo-card';

/** Nombre de una tarjeta servida: 40 hexadecimales y `.jpg`. Cualquier otro nombre se rechaza. */
export const CARD_FILE_RE = /^[0-9a-f]{40}\.jpg$/;

/** Fotos locales de las que sale una tarjeta: las de Alegra descargadas y las que subió la persona. */
const LOCAL_PHOTO = /^\/media\/(cache|uploads)\/([A-Za-z0-9._-]+)$/;
const CONCURRENCY = 4;

export interface CardParams {
  /** Píxeles de la tarjeta. */
  w: number;
  h: number;
  /** Color de relleno `#RRGGBB`. */
  fill: string;
  backdrop: PhotoBackdrop;
}

export interface CardResult {
  /** `/media/cards/<sha1>.jpg` */
  url: string;
  /** El modo que realmente se aplicó. */
  used: PhotoBackdrop;
  /** `true` si se pidió `sin-fondo` y se usó `marco`. */
  fellBack: boolean;
  reason: FallbackReason | null;
}

/** Una tarjeta para cada foto del payload y los productos cuya foto cayó al modo seguro. */
export interface PayloadCards {
  /** Dirección original de la foto → dirección de su tarjeta. */
  cards: PhotoVariants;
  /** Nombres de los productos cuya tarjeta quedó en `marco` aunque se pidió `sin-fondo`. */
  fallbacks: string[];
}

export class CardMaker {
  /** Resultados ya compuestos en esta ejecución (la carpeta se vacía al arrancar, así que coinciden con el disco). */
  private done = new Map<string, CardResult>();
  /** Composiciones en curso: dos peticiones de la misma tarjeta esperan a la misma. */
  private pending = new Map<string, Promise<CardResult | null>>();

  constructor(
    private dir: string,
    private sources: { cacheDir: string; uploadsDir: string },
  ) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  /** El archivo de una tarjeta servida, solo con nombres seguros y si existe. */
  fileFor(name: string): string | null {
    if (!CARD_FILE_RE.test(name)) return null;
    const file = path.join(this.dir, name);
    return fs.existsSync(file) ? file : null;
  }

  /** El archivo original de una dirección local de foto, o `null` si no es una foto local. */
  private sourceFile(url: string): string | null {
    const m = LOCAL_PHOTO.exec(url);
    if (!m || m[2] === '.' || m[2] === '..') return null;
    return path.join(m[1] === 'cache' ? this.sources.cacheDir : this.sources.uploadsDir, m[2]!);
  }

  /**
   * La tarjeta de una foto local. `null` si la foto no es local o no se puede leer: quien llama conserva la foto
   * original. Un fallo al quitar el fondo no es un fallo: se devuelve el marco con `fellBack`.
   */
  async make(photoUrl: string, params: CardParams): Promise<CardResult | null> {
    const file = this.sourceFile(photoUrl);
    if (!file) return null;
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(file);
    } catch {
      return null;
    }
    const key = crypto
      .createHash('sha1')
      .update(`${CARD_ALGO_VERSION}|${photoUrl}|${stat.size}|${stat.mtimeMs}|${params.backdrop}|${params.w}x${params.h}|${params.fill}`)
      .digest('hex');
    const hit = this.done.get(key);
    if (hit) return hit;
    const running = this.pending.get(key);
    if (running) return running;
    const job = this.compose(key, file, params).finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }

  private async compose(key: string, file: string, params: CardParams): Promise<CardResult | null> {
    try {
      const out = await composeCard({ source: await fs.promises.readFile(file), ...params });
      const name = `${key}.jpg`;
      const target = path.join(this.dir, name);
      const temp = `${target}.${process.pid}.tmp`;
      await fs.promises.writeFile(temp, out.jpeg);
      await fs.promises.rename(temp, target);
      const result: CardResult = { url: `/media/cards/${name}`, used: out.used, fellBack: out.fellBack, reason: out.reason };
      this.done.set(key, result);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Las tarjetas de todas las fotos locales del payload (con 4 composiciones a la vez). Una foto sin tarjeta (no se
   * pudo leer) simplemente no aparece: el PDF usa la foto original.
   */
  async forPayload(payload: CatalogPayload, params: CardParams): Promise<PayloadCards> {
    const urls = collectPhotoUrls(payload);
    const cards: PhotoVariants = new Map();
    const fellBack = new Set<string>();
    let next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++]!;
        const card = await this.make(url, params);
        if (!card) continue;
        cards.set(url, card.url);
        if (card.fellBack) fellBack.add(url);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
    const fallbacks: string[] = [];
    if (fellBack.size > 0) {
      for (const section of payload.sections) {
        for (const page of section.pages) {
          for (const item of page) if (fellBack.has(item.imageUrl)) fallbacks.push(item.name);
        }
      }
    }
    return { cards, fallbacks };
  }
}

/** El payload con la foto de cada producto reemplazada por su tarjeta. No muta el original. */
export const withCards = (payload: CatalogPayload, cards: PhotoVariants): CatalogPayload => withPhotoVariants(payload, cards);
