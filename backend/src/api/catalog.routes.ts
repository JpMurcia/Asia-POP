import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { CatalogService } from '../catalog/catalog.service';
import { TemplateRepo } from '../catalog/template.repo';
import type { AppContext } from '../context';
import { HttpError, parseOr422 } from './errors';

const prepareSchema = z.object({
  sectionKeys: z.array(z.string()).optional(),
  hideSoldOut: z.boolean().optional(),
  bannerText: z.string().max(80, 'Máximo 80 caracteres.').optional(),
  /** Plantilla de esta generación; ausente = la predeterminada. */
  templateId: z.string({ error: 'Debe ser texto.' }).max(80, 'Máximo 80 caracteres.').optional(),
});

/** Opciones nuevas de una preparación; las decisiones de combos permiten que la estructura coincida con el PDF. */
const optionsSchema = prepareSchema.extend({
  bundleDecisions: z.record(z.string(), z.enum(['keep', 'omit'])).default({}),
});

const INVALID_OPTIONS = 'Las opciones de generación no son válidas.';

const generateSchema = z.object({
  prepareId: z.string().min(1),
  bundleDecisions: z.record(z.string(), z.enum(['keep', 'omit'])).default({}),
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
    };
    res.json(service.setOptions(String(req.params.prepareId), options, bundleDecisions));
  });

  r.post('/catalog/generate', (req, res) => {
    const { prepareId, bundleDecisions } = generateSchema.parse(req.body ?? {});
    res.status(202).json(service.generate(prepareId, bundleDecisions));
  });

  r.get('/catalog/jobs/current', (_req, res) => {
    res.json(ctx.jobs.current());
  });

  /** Datos de la vista previa / vista de impresión (la usa el navegador headless con su sesión temporal). */
  r.get('/catalog/payload/:prepareId', (req, res) => {
    const entry = ctx.prepares.get(String(req.params.prepareId));
    if (!entry) throw new HttpError(410, 'prepare_expired', 'La revisión expiró. Vuelve a preparar el catálogo.');
    // El payload es el de la última preparación, cambio de opciones o generación; solo la plantilla se refresca,
    // para que la vista previa refleje una plantilla guardada después de preparar.
    res.json({ ...entry.payload, template: new TemplateRepo(ctx.db).resolve(entry.options.templateId).template });
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
  return r;
}
