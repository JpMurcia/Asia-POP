import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CatalogService } from '../catalog/catalog.service';
import { DEFAULT_PHOTO_BACKDROP, PHOTO_BACKDROPS } from '../catalog/photo-backdrop';
import { DEFAULT_PDF_QUALITY, PDF_QUALITIES } from '../catalog/pdf-quality';
import { TemplateRepo } from '../catalog/template.repo';
import type { AppContext } from '../context';
import { DEFAULT_CARD_SIZE } from '../pdf/photo-card';
import { cardPlan } from '../pdf/photo-target';
import { withPhotoVariants, type PhotoVariants } from '../pdf/photo-variants';
import { HttpError, parseOr422 } from './errors';

const prepareSchema = z.object({
  sectionKeys: z.array(z.string()).optional(),
  hideSoldOut: z.boolean().optional(),
  bannerText: z.string().max(80, 'Máximo 80 caracteres.').optional(),
  /** Plantilla de esta generación; ausente = la predeterminada. */
  templateId: z.string({ error: 'Debe ser texto.' }).max(80, 'Máximo 80 caracteres.').optional(),
  /** Fondo de las foto-tarjetas (feature 010); ausente = `marco`. */
  photoBackdrop: z.enum(PHOTO_BACKDROPS, { error: 'Debe ser «marco» o «sin-fondo».' }).optional(),
});

/** Opciones nuevas de una preparación; las decisiones de combos permiten que la estructura coincida con el PDF. */
const optionsSchema = prepareSchema.extend({
  bundleDecisions: z.record(z.string(), z.enum(['keep', 'omit'])).default({}),
});

const INVALID_OPTIONS = 'Las opciones de generación no son válidas.';

const generateSchema = z.object({
  prepareId: z.string().min(1),
  bundleDecisions: z.record(z.string(), z.enum(['keep', 'omit'])).default({}),
  /** Calidad del PDF de esta generación (FR-001, FR-002): no es una opción de la preparación. */
  quality: z.enum(PDF_QUALITIES).default(DEFAULT_PDF_QUALITY),
  /** Si llega, reemplaza el fondo de las foto-tarjetas de la preparación (feature 010). */
  photoBackdrop: z.enum(PHOTO_BACKDROPS, { error: 'Debe ser «marco» o «sin-fondo».' }).optional(),
});

const cardPreviewSchema = z.object({
  prepareId: z.string().min(1),
  backdrop: z.enum(PHOTO_BACKDROPS, { error: 'Debe ser «marco» o «sin-fondo».' }),
  itemId: z.string().optional(),
});

const SAFE_FILE = /^[A-Za-z0-9._-]+$/;

export function catalogRoutes(ctx: AppContext): Router {
  const r = Router();
  const service = new CatalogService(ctx);

  r.post('/catalog/prepare', async (req, res) => {
    const params = parseOr422(prepareSchema, req.body ?? {}, 'invalid_options', INVALID_OPTIONS);
    res.json(await service.prepare(params));
  });

  /** Cambia las opciones de una preparación y recalcula informe y estructura sin consultar Alegra. */
  r.put('/catalog/prepare/:prepareId/options', (req, res) => {
    const { bundleDecisions, ...rest } = parseOr422(optionsSchema, req.body ?? {}, 'invalid_options', INVALID_OPTIONS);
    const options = {
      sectionKeys: rest.sectionKeys,
      hideSoldOut: rest.hideSoldOut ?? false,
      bannerText: rest.bannerText,
      templateId: rest.templateId,
      photoBackdrop: rest.photoBackdrop,
    };
    res.json(service.setOptions(String(req.params.prepareId), options, bundleDecisions));
  });

  r.post('/catalog/generate', (req, res) => {
    const { prepareId, bundleDecisions, quality, photoBackdrop } = generateSchema.parse(req.body ?? {});
    res.status(202).json(service.generate(prepareId, bundleDecisions, quality, photoBackdrop));
  });

  r.get('/catalog/jobs/current', (_req, res) => {
    res.json(ctx.jobs.current());
  });

  /** Datos de la vista previa / vista de impresión (la usa el navegador headless con su sesión temporal). */
  r.get('/catalog/payload/:prepareId', async (req, res) => {
    const entry = ctx.prepares.get(String(req.params.prepareId));
    if (!entry) throw new HttpError(410, 'prepare_expired', 'La revisión expiró. Vuelve a preparar el catálogo.');
    // El payload es el de la última preparación, cambio de opciones o generación; solo la plantilla se refresca,
    // para que la vista previa refleje una plantilla guardada después de preparar.
    const template = new TemplateRepo(ctx.db).resolve(entry.options.templateId).template;
    const payload = { ...entry.payload, template };
    // Solo el navegador de la generación en calidad Optimizada pide `?quality=optimized`: recibe el mismo payload con
    // las direcciones de las fotos reemplazadas por sus copias reducidas. La vista previa y el editor no lo piden.
    const replacements: PhotoVariants = new Map(req.query.quality === 'optimized' ? entry.variants : undefined);
    // Plantilla con foto-tarjeta (feature 010): cada foto local se reemplaza por su tarjeta. Las tarjetas ganan a las
    // copias reducidas (no se vuelven a reducir). Con cualquier otra plantilla el payload es el de siempre.
    const plan = cardPlan(template);
    if (plan) {
      const made = await ctx.cardMaker.forPayload(payload, { ...plan, backdrop: entry.options.photoBackdrop ?? DEFAULT_PHOTO_BACKDROP });
      for (const [photo, card] of made.cards) replacements.set(photo, card);
    }
    res.json(replacements.size ? withPhotoVariants(payload, replacements) : payload);
  });

  /** La tarjeta de ejemplo de la pantalla Generar (feature 010, FR-008c): un producto con foto en el modo pedido. */
  r.post('/catalog/card-preview', async (req, res) => {
    const { prepareId, backdrop, itemId } = cardPreviewSchema.parse(req.body ?? {});
    const entry = ctx.prepares.get(prepareId);
    if (!entry) throw new HttpError(410, 'prepare_expired', 'La revisión expiró. Vuelve a preparar el catálogo.');
    const template = new TemplateRepo(ctx.db).resolve(entry.options.templateId).template;
    const items = entry.payload.sections.flatMap((s) => s.pages.flat());
    const localPhoto = (url: string) => /^\/media\/(?:cache|uploads)\//.test(url);
    const item = itemId ? items.find((i) => String(i.id) === itemId && localPhoto(i.imageUrl)) : items.find((i) => localPhoto(i.imageUrl));
    if (!item) throw new HttpError(404, 'not_found', 'No hay ningún producto con foto para mostrar la tarjeta.');
    const size = cardPlan(template) ?? { ...DEFAULT_CARD_SIZE, fill: template.palette.bg.toUpperCase() };
    const card = await ctx.cardMaker.make(item.imageUrl, { ...size, backdrop });
    if (!card) throw new HttpError(404, 'not_found', 'No se pudo leer la foto de ese producto.');
    res.json({ url: card.url, used: card.used, fellBack: card.fellBack, reason: card.reason, itemName: item.name });
  });

  r.get('/catalog/history', (_req, res) => {
    res.json(ctx.history.list());
  });

  r.get('/catalog/history/:id/pdf', (req, res) => {
    const file = ctx.history.filePath(String(req.params.id));
    if (!file) throw new HttpError(404, 'not_found', 'No se encontró ese catálogo.');
    const created = ctx.history.list().find((h) => h.id === req.params.id)?.createdAt ?? new Date().toISOString();
    const d = new Date(created);
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `catalogo-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    fs.createReadStream(file).pipe(res);
  });

  return r;
}

/** Imágenes locales (caché de descargas y cargas del usuario). Se monta en `/media`, con sesión. */
export function mediaRoutes(ctx: AppContext): Router {
  const r = Router();
  const serveDir = (dir: string) => (req: Request, res: Response) => {
    const file = String(req.params.file);
    if (!SAFE_FILE.test(file)) throw new HttpError(400, 'invalid_file', 'Nombre de archivo inválido.');
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) throw new HttpError(404, 'not_found', 'Imagen no encontrada.');
    res.sendFile(full);
  };
  r.get('/cache/:file', serveDir(path.join(ctx.config.dataDir, 'image-cache')));
  r.get('/uploads/:file', serveDir(ctx.uploadsDir));
  // Foto-tarjetas generadas (feature 010): solo nombres `<sha1>.jpg`; cualquier otro responde 404
  r.get('/cards/:file', (req, res) => {
    const full = ctx.cardMaker.fileFor(String(req.params.file));
    if (!full) throw new HttpError(404, 'not_found', 'Imagen no encontrada.');
    res.sendFile(full);
  });
  // Copias reducidas de una generación en curso (feature 005): existen solo mientras se renderiza
  r.get('/pdf/:run/:file', (req, res) => {
    const run = String(req.params.run);
    const file = String(req.params.file);
    if (!SAFE_FILE.test(run) || !SAFE_FILE.test(file)) throw new HttpError(400, 'invalid_file', 'Nombre de archivo inválido.');
    const full = ctx.photoOptimizer.fileFor(run, file);
    if (!full) throw new HttpError(404, 'not_found', 'Imagen no encontrada.');
    res.sendFile(full);
  });
  return r;
}
