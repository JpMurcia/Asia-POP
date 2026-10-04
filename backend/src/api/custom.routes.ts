import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { CustomProductRepo, productSchema } from '../custom/custom-product.repo';
import { imageUpload, saveUploadedImage, wrapUpload } from '../custom/image-upload';
import { SectionRepo } from '../custom/section.repo';
import { HttpError } from './errors';

const sectionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  introText: z.string().trim().max(800).nullable().optional(),
});

const view = (p: ReturnType<CustomProductRepo['get']>) =>
  p && { ...p, imageUrl: p.imagePath ? `/media/uploads/${p.imagePath}` : null };

/** Secciones propias y productos propios (mochis, regalos...). */
export function customRoutes(ctx: AppContext): Router {
  const r = Router();
  const sections = new SectionRepo(ctx.db, ctx.uploadsDir);
  const products = new CustomProductRepo(ctx.db, ctx.uploadsDir);
  const upload = wrapUpload(imageUpload);

  // ---- Secciones propias
  r.get('/sections/custom', (_req, res) => {
    res.json(sections.list());
  });

  r.post('/sections/custom', (req, res) => {
    const { name, introText } = sectionSchema.parse(req.body);
    res.status(201).json(sections.create(name, introText));
  });

  r.put('/sections/custom/:id', (req, res) => {
    const { name, introText } = sectionSchema.parse(req.body);
    const updated = sections.update(String(req.params.id), name, introText);
    if (!updated) throw new HttpError(404, 'not_found', 'Sección no encontrada.');
    res.json(updated);
  });

  r.delete('/sections/custom/:id', (req, res) => {
    if (!sections.remove(String(req.params.id))) throw new HttpError(404, 'not_found', 'Sección no encontrada.');
    res.status(204).end();
  });

  // ---- Productos propios
  r.get('/custom-products', (req, res) => {
    const sectionId = typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined;
    res.json(products.list(sectionId).map(view));
  });

  r.post('/custom-products', (req, res) => {
    const created = products.create(productSchema.parse(req.body));
    res.status(201).json(view(created));
  });

  r.put('/custom-products/:id', (req, res) => {
    const updated = products.update(String(req.params.id), productSchema.parse(req.body));
    if (!updated) throw new HttpError(404, 'not_found', 'Producto no encontrado.');
    res.json(view(updated));
  });

  r.delete('/custom-products/:id', (req, res) => {
    if (!products.remove(String(req.params.id))) throw new HttpError(404, 'not_found', 'Producto no encontrado.');
    res.status(204).end();
  });

  r.put('/custom-products/:id/image', upload, (req, res) => {
    const id = String(req.params.id);
    if (!products.get(id)) throw new HttpError(404, 'not_found', 'Producto no encontrado.');
    const file = saveUploadedImage(ctx.uploadsDir, req.file);
    products.setImage(id, file);
    res.json({ imagePath: `/media/uploads/${file}` });
  });

  return r;
}
