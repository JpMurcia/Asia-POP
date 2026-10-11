import { HttpError } from '../api/errors';
import type { AlegraDataStatus } from '../catalog/types';
import { AlegraDataRepo, type AlegraSnapshot, type SnapshotCategory } from './alegra-data.repo';
import type { DownloadOptions } from './alegra.client';
import { mapAlegraItem, snapshotToNormalized, toSnapshotItem, type NormalizedItem } from './alegra.mapper';
import { AlegraError, type AlegraCategoryRaw, type AlegraItemRaw } from './alegra.types';

/** Lo único que el servicio necesita de un cliente de Alegra (solo lectura); `AlegraClient` lo cumple. */
export interface AlegraSource {
  listCategories(opts?: DownloadOptions): Promise<AlegraCategoryRaw[]>;
  listActiveItems(opts?: DownloadOptions): Promise<AlegraItemRaw[]>;
}

/** Los datos de Alegra que leen las pantallas: artículos ya normalizados, categorías y cuándo se descargaron. */
export interface AlegraData {
  items: NormalizedItem[];
  categories: SnapshotCategory[];
  syncedAt: string;
}

export interface AlegraDataDeps {
  repo: AlegraDataRepo;
  /** Cliente con las credenciales vigentes, o `null` si no hay conexión configurada. */
  client: () => AlegraSource | null;
  /** Correo de la conexión vigente (la cuenta a la que pertenecen los datos), o `null`. */
  email: () => string | null;
  now?: () => Date;
}

const GENERIC_FAILURE = 'No se pudo consultar Alegra. Intenta de nuevo en un momento.';

interface Flight {
  promise: Promise<AlegraData>;
}

/**
 * Copia local de lo que Alegra devuelve (feature 007): decide CUÁNDO se descarga. Las pantallas leen `get()`, que nunca
 * consulta a Alegra si ya hay copia de la cuenta vigente; solo se descarga la primera vez, al pedirlo (`refresh`), al
 * guardar la conexión (`start`) y, en `prepare`, que ya descarga todo y entrega su resultado con `store`.
 *
 * - Una sola descarga a la vez: una segunda petición comparte la primera.
 * - Una descarga reemplaza la copia solo si terminó bien; si falla, la anterior queda intacta y el error se recuerda
 *   (en memoria) para mostrarlo.
 * - Con otra cuenta (otro correo) la copia no sirve: se trata como ausente (FR-019).
 */
export class AlegraDataService {
  private flight: Flight | null = null;
  private progress: AlegraDataStatus['progress'] = null;
  private lastError: AlegraDataStatus['lastError'] = null;
  /** Sube al descartar la copia: una descarga que empezó antes ya no es de la cuenta vigente y no se guarda. */
  private generation = 0;

  constructor(private deps: AlegraDataDeps) {}

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }

  /** La copia solo sirve si es de la cuenta vigente. */
  private current(): AlegraSnapshot | null {
    const copy = this.deps.repo.read();
    const email = this.deps.email();
    if (!copy || !email || copy.accountEmail !== email.toLowerCase()) return null;
    return copy;
  }

  private toData(s: AlegraSnapshot): AlegraData {
    return { items: s.items.map(snapshotToNormalized), categories: s.categories, syncedAt: s.syncedAt };
  }

  /** Estado para las pantallas. Nunca consulta a Alegra. */
  status(): AlegraDataStatus {
    const copy = this.current();
    const syncing = this.flight !== null;
    return {
      state: syncing ? 'syncing' : copy ? 'ready' : 'none',
      syncedAt: copy?.syncedAt ?? null,
      articles: copy ? copy.items.filter((i) => i.type !== 'variantParent').length : null,
      categories: copy ? copy.categories.length : null,
      progress: syncing ? this.progress : null,
      lastError: this.lastError,
    };
  }

  /**
   * Los datos: la copia vigente o, si no hay, la descarga única (compartida por las llamadas simultáneas). Con copia
   * nunca consulta a Alegra, ni mientras se actualiza.
   */
  async get(): Promise<AlegraData> {
    const copy = this.current();
    if (copy) return this.toData(copy);
    return this.refresh();
  }

  /**
   * Descarga de nuevo y reemplaza la copia solo si todo terminó bien. Una sola a la vez: mientras hay una en curso
   * devuelve la misma promesa. Si falla propaga el error de Alegra y la copia anterior queda intacta.
   */
  refresh(): Promise<AlegraData> {
    if (this.flight) return this.flight.promise;
    const client = this.deps.client();
    const email = this.deps.email();
    if (!client || !email) {
      return Promise.reject(new HttpError(422, 'alegra_not_configured', 'Primero configura la conexión con Alegra.'));
    }
    const generation = this.generation;
    this.progress = { phase: 'categories', received: 0 };
    const flight: Flight = { promise: undefined as unknown as Promise<AlegraData> };
    flight.promise = (async () => {
      // Deja que `this.flight` quede asignado antes de que algo pueda terminar (un fallo síncrono del cliente incluido)
      await Promise.resolve();
      try {
        const categories = await client.listCategories({
          onProgress: (received) => (this.progress = { phase: 'categories', received }),
        });
        this.progress = { phase: 'items', received: 0 };
        const raw = await client.listActiveItems({
          onProgress: (received) => (this.progress = { phase: 'items', received }),
        });
        return this.save(email, categories, raw, generation);
      } catch (e) {
        if (generation === this.generation) {
          this.lastError = {
            message: e instanceof AlegraError || e instanceof HttpError ? e.message : GENERIC_FAILURE,
            at: this.now().toISOString(),
          };
        }
        throw e;
      } finally {
        if (this.flight === flight) {
          this.flight = null;
          this.progress = null;
        }
      }
    })();
    this.flight = flight;
    return flight.promise;
  }

  /** Inicia la descarga sin esperarla (guardar la conexión): un fallo se registra, no se propaga. */
  start(): void {
    if (!this.deps.client() || !this.deps.email()) return;
    this.refresh().catch(() => undefined);
  }

  /**
   * Guarda como copia vigente lo que `prepare` ya descargó (sin pedirlo dos veces). Sin conexión configurada no guarda
   * nada: no se sabría de qué cuenta son los datos.
   */
  store(categories: AlegraCategoryRaw[], rawItems: AlegraItemRaw[]): void {
    const email = this.deps.email();
    if (!email) return;
    this.save(email, categories, rawItems, this.generation);
  }

  /** Borra la copia (cambio de cuenta). Una descarga en curso es de la cuenta anterior y ya no se guardará. */
  discard(): void {
    this.generation++;
    this.flight = null;
    this.progress = null;
    this.lastError = null;
    this.deps.repo.clear();
  }

  private save(email: string, categories: AlegraCategoryRaw[], raw: AlegraItemRaw[], generation: number): AlegraData {
    const snapshot: AlegraSnapshot = {
      accountEmail: email.toLowerCase(),
      syncedAt: this.now().toISOString(),
      items: raw.map(mapAlegraItem).map(toSnapshotItem),
      categories: categories.map((c) => ({ id: String(c.id), name: c.name })),
    };
    // Una descarga que empezó antes de un cambio de cuenta entrega lo suyo a quien la pidió, pero no queda como copia
    if (generation === this.generation) {
      this.deps.repo.replace(snapshot);
      this.lastError = null;
    }
    return this.toData(snapshot);
  }
}
