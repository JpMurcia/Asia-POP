import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import sharp from 'sharp';
import type { PageElement } from '../catalog/template';
import { TemplateRepo } from '../catalog/template.repo';
import type { AppContext } from '../context';
import { detectImageExt, imageUpload, wrapUpload } from '../custom/image-upload';
import { HttpError } from './errors';

/** Imágenes de plantilla: `tpl-<nombre>-<id>.<ext>`. Las fotos de productos viven en la misma carpeta sin ese prefijo. */
const TEMPLATE_IMAGE = /^tpl-[A-Za-z0-9._-]+\.(png|jpg|webp)$/;

export interface TemplateImage {
  /** Nombre del archivo en la carpeta de subidas. */
  file: string;
  /** Nombre para mostrar (el original, saneado). */
  name: string;
  bytes: number;
  width: number;
  height: number;
  /** Valor para `ImageEl.src`. */
  src: string;
}

/** Del nombre original: solo letras y números, para que nunca salga de la carpeta ni lleve separadores. */
function slugOf(original: string): string {
  const base = path.parse(path.basename(original.replace(/\\/g, '/'))).name;
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 24);
  return slug || 'imagen';
}

/** `tpl-logo-ab12cd34.png` → `logo` */
const displayName = (file: string): string => file.replace(/^tpl-/, '').replace(/-[0-9a-f]{8}\.[a-z]+$/, '');

async function describe(dir: string, file: string): Promise<TemplateImage | null> {
  try {
    const full = path.join(dir, file);
    const [stat, meta] = await Promise.all([fs.promises.stat(full), sharp(full).metadata()]);
    return { file, name: displayName(file), bytes: stat.size, width: meta.width ?? 0, height: meta.height ?? 0, src: `upload:${file}` };
  } catch {
    return null;
  }
}

/** Subir, listar y borrar las imágenes que la persona responsable usa en sus plantillas (logo, ilustraciones). */
export function templateImagesRoutes(ctx: AppContext): Router {
  const r = Router();
  const upload = wrapUpload(imageUpload);

  r.post('/template-images', upload, async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(422, 'image_required', 'Adjunta una imagen en el campo "image".');
    const ext = detectImageExt(file.buffer);
    if (!ext) throw new HttpError(422, 'invalid_image', 'La imagen debe ser PNG, JPG o WEBP.');
    const name = `tpl-${slugOf(file.originalname)}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    fs.mkdirSync(ctx.uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.uploadsDir, name), file.buffer);
    const described = await describe(ctx.uploadsDir, name);
    if (!described) {
      fs.rmSync(path.join(ctx.uploadsDir, name), { force: true });
      throw new HttpError(422, 'invalid_image', 'No se pudo leer la imagen enviada.');
    }
    res.status(201).json({ ...described, name: displayName(name) });
  });

  r.get('/template-images', async (_req, res) => {
    const files = fs.existsSync(ctx.uploadsDir) ? fs.readdirSync(ctx.uploadsDir).filter((f) => TEMPLATE_IMAGE.test(f)).sort() : [];
    const images = (await Promise.all(files.map((f) => describe(ctx.uploadsDir, f)))).filter((i): i is TemplateImage => i !== null);
    res.json({ images });
  });

  r.delete('/template-images/:file', (req, res) => {
    const file = String(req.params.file);
    const full = path.join(ctx.uploadsDir, file);
    if (!TEMPLATE_IMAGE.test(file) || !fs.existsSync(full)) throw new HttpError(404, 'not_found', 'Imagen no encontrada.');
    const src = `upload:${file}`;
    const usedBy = new TemplateRepo(ctx.db)
      .getWorkspace()
      .templates.filter((t) => Object.values(t.pages).some((p) => p.els.some((e: PageElement) => e.type === 'image' && e.src === src)))
      .map((t) => ({ id: t.id, name: t.name }));
    if (usedBy.length > 0) {
      throw new HttpError(409, 'in_use', 'Esa imagen la usan una o más plantillas. Quítala de ellas antes de borrarla.', usedBy);
    }
    fs.rmSync(full, { force: true });
    res.status(204).end();
  });

  return r;
}
