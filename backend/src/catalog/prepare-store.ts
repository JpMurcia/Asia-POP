import crypto from 'node:crypto';
import type { PhotoVariants } from '../pdf/photo-variants';
import type { BuildResult } from './catalog-builder';
import type { Template } from './template';
import type { BundleDecision, CatalogPayload, GenerationOptions } from './types';

const TTL_MS = 15 * 60 * 1000;

export interface PrepareEntry {
  createdAt: number;
  /**
   * Reconstruye el catálogo aplicando las decisiones sobre combos agotados y las opciones de generación. La plantilla
   * se lee en cada construcción (una guardada después de preparar se aplica) salvo que se indique `template`.
   */
  build: (decisions: Record<string, BundleDecision>, options: GenerationOptions, template?: Template) => BuildResult;
  /** Último payload construido (el que imprime el navegador). */
  payload: CatalogPayload;
  params: unknown;
  /** Opciones vigentes de esta preparación (secciones, ocultar agotados, banner). */
  options: GenerationOptions;
  /**
   * Copias reducidas de las fotos (dirección original → dirección de la copia). Solo existen mientras se renderiza
   * en calidad Optimizada: las usa `GET /catalog/payload/:id?quality=optimized` y se eliminan al terminar el trabajo.
   */
  variants?: PhotoVariants;
}

/** Instantáneas de "preparar" válidas durante 15 minutos. */
export class PrepareStore {
  private entries = new Map<string, PrepareEntry>();

  constructor(private now: () => number = Date.now) {}

  add(entry: Omit<PrepareEntry, 'createdAt'>): string {
    this.sweep();
    const id = crypto.randomUUID();
    this.entries.set(id, { ...entry, createdAt: this.now() });
    return id;
  }

  get(id: string): PrepareEntry | null {
    this.sweep();
    return this.entries.get(id) ?? null;
  }

  setPayload(id: string, payload: CatalogPayload): void {
    const e = this.entries.get(id);
    if (e) e.payload = payload;
  }

  setOptions(id: string, options: GenerationOptions): void {
    const e = this.entries.get(id);
    if (e) e.options = options;
  }

  setVariants(id: string, variants: PhotoVariants): void {
    const e = this.entries.get(id);
    if (e) e.variants = variants;
  }

  clearVariants(id: string): void {
    const e = this.entries.get(id);
    if (e) delete e.variants;
  }

  private sweep(): void {
    const t = this.now();
    for (const [id, e] of this.entries) if (t - e.createdAt > TTL_MS) this.entries.delete(id);
  }
}
