import type { AlegraData } from '../alegra/alegra-data.service';
import { AlegraError } from '../alegra/alegra.types';
import { ConnectionRepo } from '../alegra/connection.repo';
import { HttpError } from '../api/errors';
import type { AppContext } from '../context';
import { buildCatalog } from './catalog-builder';
import { loadLocalInputs } from './catalog-inputs';
import { computeStructure } from './structure';
import type { PanelSummary } from './types';

type AlegraPart = Pick<PanelSummary, 'stats' | 'sections'> & { status: 'ok' | 'unreachable'; message?: string };

const GENERIC_FAILURE = 'No se pudo consultar Alegra. Intenta de nuevo en un momento.';

/**
 * Resumen de Inicio. Calcula indicadores y secciones con el mismo constructor del catálogo
 * (sin descargar imágenes: se asume con imagen todo ítem con foto), de modo que hay una sola fuente de reglas.
 *
 * Feature 007: se calcula con la copia local de los datos de Alegra y las entradas locales de cada petición, así que ya
 * no consulta a Alegra ni se cachea. `?refresh=1` actualiza la copia (espera la descarga); si falla y hay copia, se
 * muestran sus datos con el aviso `syncError`.
 */
export class PanelSummaryService {
  constructor(
    private ctx: AppContext,
    private now: () => number = Date.now,
  ) {}

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

    const { data, error } = await this.load(refresh);
    // El aviso sigue mientras no haya una descarga buena, no solo en la petición que falló
    const syncError = data ? (error ?? this.ctx.alegraData.status().lastError?.message) : undefined;
    const part: AlegraPart = data
      ? this.compute(data)
      : { status: 'unreachable', stats: null, sections: null, message: error };

    return {
      alegra: {
        status: part.status,
        email: status.email ?? undefined,
        lastTestedAt: status.lastTestedAt,
        message: part.message,
        // Solo hay datos que mostrar si hay copia: su antigüedad, y el aviso si la última actualización falló
        ...(data ? { syncedAt: data.syncedAt } : {}),
        ...(syncError ? { syncError } : {}),
      },
      stats: part.stats,
      sections: part.sections,
      lastCatalog,
      generatedAt,
    };
  }

  /** La copia (o la descarga única si falta); con `refresh`, una actualización. Un fallo con copia no es un error. */
  private async load(refresh: boolean): Promise<{ data: AlegraData | null; error?: string }> {
    const { alegraData } = this.ctx;
    try {
      return { data: refresh ? await alegraData.refresh() : await alegraData.get() };
    } catch (e) {
      const error = e instanceof AlegraError || e instanceof HttpError ? e.message : GENERIC_FAILURE;
      if (alegraData.status().state === 'none') return { data: null, error };
      try {
        return { data: await alegraData.get(), error };
      } catch {
        return { data: null, error };
      }
    }
  }

  private compute(data: AlegraData): AlegraPart {
    const { items } = data;
    const local = loadLocalInputs(this.ctx);
    const built = buildCatalog({
      ...local,
      categories: data.categories,
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
        // Los omitidos no salen en el catálogo, así que no cuentan entre los que salen con la indicación AGOTADO
        soldOut: real.filter((i) => i.soldOut && !local.omittedIds.has(i.id)).length,
        // pendientes: los que ya tienen sección asignada localmente no cuentan
        uncategorized: built.report.omittedNoSection.length,
        estimatedPages: computeStructure(built.payload).totalPages,
        omitted: real.filter((i) => local.omittedIds.has(i.id)).length,
      },
      sections: built.availableSections.map((s) => ({ ...s, soldOut: soldOutBySection.get(s.key) ?? 0 })),
    };
  }
}
