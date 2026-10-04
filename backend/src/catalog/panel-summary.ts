import { mapAlegraItem } from '../alegra/alegra.mapper';
import { ConnectionRepo } from '../alegra/connection.repo';
import { AlegraError } from '../alegra/alegra.types';
import type { AppContext } from '../context';
import { buildCatalog } from './catalog-builder';
import { loadLocalInputs } from './catalog-inputs';
import { computeStructure } from './structure';
import type { PanelSummary } from './types';

/** La parte que depende de Alegra se cachea este tiempo; un fallo, menos, para recuperarse pronto. */
export const SUMMARY_TTL_MS = 60_000;
export const SUMMARY_FAILURE_TTL_MS = 15_000;
/** Tiempo máximo por petición a Alegra: un Alegra colgado no debe bloquear la barra lateral. */
export const SUMMARY_TIMEOUT_MS = 8_000;

type AlegraPart = Pick<PanelSummary, 'stats' | 'sections'> & { status: 'ok' | 'unreachable'; message?: string };

/**
 * Resumen de Inicio. Calcula indicadores y secciones con el mismo constructor del catálogo
 * (sin descargar imágenes: se asume con imagen todo ítem con URL), de modo que hay una sola fuente de reglas.
 */
export class PanelSummaryService {
  private cache: { at: number; ttl: number; email: string; value: AlegraPart } | null = null;

  constructor(
    private ctx: AppContext,
    private now: () => number = Date.now,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  async get(refresh = false): Promise<PanelSummary> {
    const conn = new ConnectionRepo(this.ctx.db, this.ctx.config);
    const status = conn.status();
    // El último catálogo viene siempre del historial local: sin caché ni dependencia de Alegra
    const last = this.ctx.history.list()[0];
    const lastCatalog = last ?? null;
    const generatedAt = new Date(this.now()).toISOString();

    if (!status.isConfigured) {
      return { alegra: { status: 'not_configured' }, stats: null, sections: null, lastCatalog, generatedAt };
    }

    const cached = this.cache;
    const fresh = cached && cached.email === status.email && this.now() - cached.at < cached.ttl;
    let part: AlegraPart;
    /** Cuándo se hizo la lectura que sirve esta respuesta: no cambia mientras se sirva de la caché. */
    let readAt: number;
    if (!refresh && fresh && cached) {
      part = cached.value;
      readAt = cached.at;
    } else {
      part = await this.queryAlegra(conn);
      readAt = this.now();
      this.cache = {
        at: readAt,
        ttl: part.status === 'ok' ? SUMMARY_TTL_MS : SUMMARY_FAILURE_TTL_MS,
        email: status.email ?? '',
        value: part,
      };
    }

    return {
      alegra: {
        status: part.status,
        email: status.email ?? undefined,
        lastTestedAt: status.lastTestedAt,
        message: part.message,
        // Solo hay una lectura que mostrar si Alegra respondió
        ...(part.status === 'ok' ? { syncedAt: new Date(readAt).toISOString() } : {}),
      },
      stats: part.stats,
      sections: part.sections,
      lastCatalog,
      generatedAt,
    };
  }

  private async queryAlegra(conn: ConnectionRepo): Promise<AlegraPart> {
    const client = conn.client({ timeoutMs: SUMMARY_TIMEOUT_MS });
    if (!client) return { status: 'unreachable', stats: null, sections: null };
    try {
      const [categories, rawItems] = await Promise.all([client.listCategories(), client.listActiveItems()]);
      const items = rawItems.map(mapAlegraItem);
      const built = buildCatalog({
        ...loadLocalInputs(this.ctx),
        categories: categories.map((c) => ({ id: String(c.id), name: c.name })),
        items,
        localImages: new Map(items.map((i) => [i.id, i.remoteImageUrl])),
      });

      const soldOutBySection = new Map<string, number>(
        built.payload.sections.map((s) => [
          s.key,
          s.pages.flat().filter((i) => i.kind !== 'custom' && i.soldOut).length,
        ]),
      );
      const real = items.filter((i) => i.type !== 'variantParent');
      return {
        status: 'ok',
        stats: {
          products: real.length,
          soldOut: real.filter((i) => i.soldOut).length,
          // pendientes: los que ya tienen sección asignada localmente no cuentan
          uncategorized: built.report.omittedNoSection.length,
          estimatedPages: computeStructure(built.payload).totalPages,
        },
        sections: built.availableSections.map((s) => ({ ...s, soldOut: soldOutBySection.get(s.key) ?? 0 })),
      };
    } catch (e) {
      const message =
        e instanceof AlegraError ? e.message : 'No se pudo consultar Alegra. Intenta de nuevo en un momento.';
      return { status: 'unreachable', stats: null, sections: null, message };
    }
  }
}
