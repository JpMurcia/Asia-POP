import { mapAlegraItem } from '../alegra/alegra.mapper';
import { ConnectionRepo } from '../alegra/connection.repo';
import { toHttpError } from '../api/alegra-settings.routes';
import { HttpError } from '../api/errors';
import type { AppContext } from '../context';
import { photoTarget } from '../pdf/photo-target';
import { collectPhotoUrls } from '../pdf/photo-variants';
import { buildCatalog } from './catalog-builder';
import { loadLocalInputs } from './catalog-inputs';
import { DEFAULT_PDF_QUALITY, type PdfQuality } from './pdf-quality';
import { computeStructure } from './structure';
import type { Template } from './template';
import { TemplateRepo } from './template.repo';
import type {
  AvailableSection,
  BundleDecision,
  CatalogPayload,
  CatalogStructure,
  GenerationOptions,
  PhotoFailureReason,
  ReviewReport,
} from './types';

/** Respuesta de `prepare` y de `setOptions`. */
export interface PrepareResult {
  prepareId: string;
  report: ReviewReport;
  structure: CatalogStructure;
  availableSections: AvailableSection[];
  options: GenerationOptions;
}

export interface PrepareParams {
  sectionKeys?: string[];
  hideSoldOut?: boolean;
  bannerText?: string;
  /** Plantilla de esta generación; ausente = la predeterminada. */
  templateId?: string;
}

/** La plantilla con la que se generó; `fallback` indica que la elegida ya no existe y se usó la predeterminada. */
export interface UsedTemplate {
  id: string;
  name: string;
  fallback: boolean;
}

export class CatalogService {
  private conn: ConnectionRepo;

  constructor(private ctx: AppContext) {
    this.conn = new ConnectionRepo(ctx.db, ctx.config);
  }

  /** Consulta Alegra, descarga imágenes, aplica las reglas y devuelve el informe de revisión. */
  async prepare(params: PrepareParams): Promise<PrepareResult> {
    const { jobs } = this.ctx;
    const client = this.conn.client();
    if (!client) throw new HttpError(422, 'alegra_not_configured', 'Primero configura la conexión con Alegra.');

    const jobId = jobs.acquire('preparing', 'Consultando Alegra');
    try {
      let categories, rawItems;
      try {
        [categories, rawItems] = await Promise.all([client.listCategories(), client.listActiveItems()]);
      } catch (e) {
        throw toHttpError(e);
      }
      const items = rawItems.map(mapAlegraItem);

      jobs.update(jobId, { step: 'Descargando imágenes', progress: 20 });
      // Cada producto aporta sus fotos candidatas (favorita primero); se prueban en orden hasta que una sirva
      const candidates = new Map(
        items.map((i) => [i.id, i.imageUrls ?? (i.remoteImageUrl ? [i.remoteImageUrl] : [])] as const),
      );
      const outcomes = await this.ctx.imageCache.downloadAll(candidates, 6, (done, total) =>
        jobs.update(jobId, { progress: 20 + Math.round((done / Math.max(total, 1)) * 70) }),
      );
      const localImages = new Map<string, string | null>(
        [...outcomes].map(([id, o]) => [id, o.status === 'ok' ? o.url : null] as const),
      );
      // Productos con foto en Alegra que no se pudo obtener, con el motivo; el informe los separa de los que no tienen foto
      const photoFailures = new Map<string, PhotoFailureReason>();
      for (const [id, o] of outcomes) if (o.status === 'failed') photoFailures.set(id, o.reason);

      const input = {
        ...loadLocalInputs(this.ctx),
        categories: categories.map((c) => ({ id: String(c.id), name: c.name })),
        items,
        localImages,
        photoFailures,
      };
      // La plantilla se lee en cada construcción para que una guardada después de preparar se aplique (FR-022)
      const build = (decisions: Record<string, BundleDecision>, options: GenerationOptions, template?: Template) =>
        buildCatalog({
          ...input,
          decisions,
          sectionKeys: options.sectionKeys,
          hideSoldOut: options.hideSoldOut,
          bannerText: options.bannerText,
          template: template ?? this.templates().resolve(options.templateId).template,
        });
      const options: GenerationOptions = {
        sectionKeys: params.sectionKeys,
        hideSoldOut: params.hideSoldOut ?? false,
        bannerText: params.bannerText,
        templateId: params.templateId,
      };
      const first = build({}, options);
      const prepareId = this.ctx.prepares.add({ build, payload: first.payload, params, options });
      return {
        prepareId,
        report: first.report,
        structure: computeStructure(first.payload),
        availableSections: first.availableSections,
        options,
      };
    } finally {
      jobs.release(jobId);
    }
  }

  private templates(): TemplateRepo {
    return new TemplateRepo(this.ctx.db);
  }

  /**
   * Valida la instantánea y las decisiones, e inicia el renderizado en segundo plano. Devuelve el trabajo y la
   * plantilla usada (si la elegida se eliminó, la predeterminada con `fallback: true`). La calidad del PDF es
   * parámetro de esta generación y no de la preparación (FR-001).
   */
  generate(
    prepareId: string,
    decisions: Record<string, BundleDecision>,
    quality: PdfQuality = DEFAULT_PDF_QUALITY,
  ): { jobId: string; template: UsedTemplate } {
    const entry = this.ctx.prepares.get(prepareId);
    if (!entry) {
      throw new HttpError(410, 'prepare_expired', 'La revisión expiró. Vuelve a preparar el catálogo.');
    }
    const resolved = this.templates().resolve(entry.options.templateId);
    const built = entry.build(decisions, entry.options, resolved.template);
    if (built.report.emptyCatalog) {
      throw new HttpError(422, 'empty_catalog', 'No hay productos para generar el catálogo.');
    }
    const missing = built.report.soldOutBundles.filter((b) => !decisions[b.bundleId]);
    if (missing.length) {
      throw new HttpError(
        422,
        'bundle_decision_required',
        'Decide qué hacer con los combos que tienen productos agotados.',
        missing,
      );
    }

    const jobId = this.ctx.jobs.acquire('rendering', 'Generando PDF'); // 409 si hay otro activo
    this.ctx.prepares.setPayload(prepareId, built.payload);
    // `pages` se guarda con el historial para mostrarlo en Inicio sin abrir el PDF; `quality`, para quien lo consulte
    const params = { options: entry.options, decisions, pages: computeStructure(built.payload).totalPages, quality };
    void this.render(jobId, prepareId, built.report, params, quality, built.payload, resolved.template);
    return {
      jobId,
      template: { id: resolved.template.id, name: resolved.template.name, fallback: resolved.fallback },
    };
  }

  /**
   * Guarda las opciones de la preparación y recalcula informe, estructura y secciones disponibles
   * **sin consultar Alegra** (reutiliza la instantánea). Las decisiones de combos permiten que la
   * estructura coincida con el PDF final.
   */
  setOptions(
    prepareId: string,
    options: GenerationOptions,
    decisions: Record<string, BundleDecision> = {},
  ): PrepareResult {
    const entry = this.ctx.prepares.get(prepareId);
    if (!entry) {
      throw new HttpError(410, 'prepare_expired', 'La revisión expiró. Vuelve a preparar el catálogo.');
    }
    if (this.ctx.jobs.current().status === 'rendering') {
      throw new HttpError(409, 'job_in_progress', 'Hay un catálogo generándose. Espera a que termine.');
    }
    const built = entry.build(decisions, options);
    this.ctx.prepares.setOptions(prepareId, options);
    this.ctx.prepares.setPayload(prepareId, built.payload);
    return {
      prepareId,
      report: built.report,
      structure: computeStructure(built.payload),
      availableSections: built.availableSections,
      options,
    };
  }

  private async render(
    jobId: string,
    prepareId: string,
    report: ReviewReport,
    params: unknown,
    quality: PdfQuality,
    payload: CatalogPayload,
    template: Template,
  ): Promise<void> {
    const { sessions, renderer, jobs, history, runtime, prepares, photoOptimizer } = this.ctx;
    const sid = sessions.create(); // sesión temporal para el navegador headless
    try {
      let printUrl = `${runtime.baseUrl}/print/${prepareId}`;
      // Solo en Optimizada: copias reducidas de las fotos, a 150 ppp al tamaño de su recuadro en esta plantilla. En
      // Original no se toca nada. Las fotos que no se pueden reducir se quedan con su dirección original (FR-008)
      if (quality === 'optimized') {
        const target = photoTarget(template);
        if (target) {
          jobs.update(jobId, { step: 'Optimizando fotos', progress: 5 });
          const variants = await photoOptimizer.run(jobId, collectPhotoUrls(payload), target, (done, total) =>
            jobs.update(jobId, { progress: 5 + Math.round((done / Math.max(total, 1)) * 25) }),
          );
          if (variants.size > 0) {
            prepares.setVariants(prepareId, variants);
            printUrl += '?quality=optimized';
          }
        }
      }
      jobs.update(jobId, { step: 'Renderizando páginas', progress: 30 });
      const pdf = await renderer.render(printUrl, sid);
      jobs.update(jobId, { step: 'Guardando archivo', progress: 90 });
      const entry = history.add(pdf, report.counts.included, report.counts.omitted, params);
      // Pasar el tamaño objetivo no aborta nada: solo se informa el tamaño y la pantalla decide si avisa (FR-012)
      jobs.complete(jobId, entry.id, { sizeBytes: pdf.length, quality });
    } catch (e) {
      // Nunca se entrega un PDF parcial (principio II).
      jobs.fail(jobId, (e as Error).message || 'No se pudo generar el PDF.');
    } finally {
      // Las copias son temporales: se borran con éxito o con error
      prepares.clearVariants(prepareId);
      photoOptimizer.cleanup(jobId);
      sessions.destroy(sid);
    }
  }
}
