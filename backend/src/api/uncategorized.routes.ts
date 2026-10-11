import { Router } from 'express';
import { z } from 'zod';
import { listSections } from '../catalog/sections.service';
import type { AppContext } from '../context';
import { OmittedItemRepo } from '../custom/omitted-item.repo';
import { OverrideRepo } from '../custom/override.repo';
import { toHttpError } from './alegra-settings.routes';
import { HttpError } from './errors';

const assignSchema = z.object({ sectionKey: z.string().min(1) });

export function uncategorizedRoutes(ctx: AppContext): Router {
  const r = Router();
  const overrides = new OverrideRepo(ctx.db);
  const omitted = new OmittedItemRepo(ctx.db);

  /** Ítems activos de Alegra sin categoría (de la copia local) y su asignación local, si existe. */
  r.get('/catalog/uncategorized', async (_req, res) => {
    let data;
    try {
      data = await ctx.alegraData.get();
    } catch (e) {
      throw toHttpError(e);
    }
    // Un omitido conserva su asignación de sección (vuelve a aplicar si se lo incluye de nuevo) pero ya no está pendiente
    const omittedIds = omitted.all();
    const items = data.items
      .filter((i) => !i.categoryId && i.type !== 'variantParent')
      .map((i) => ({
        itemId: i.id,
        name: i.name,
        assignedSectionKey: overrides.get(i.id),
        omitted: omittedIds.has(i.id),
      }));
    res.json({ items });
  });

  r.put('/catalog/uncategorized/:itemId', async (req, res) => {
    const { sectionKey } = assignSchema.parse(req.body);
    const sections = await listSections(ctx);
    if (!sections.some((s) => s.key === sectionKey)) {
      throw new HttpError(422, 'invalid_section', 'Esa sección no existe.');
    }
    overrides.set(String(req.params.itemId), sectionKey);
    res.status(204).end();
  });

  r.delete('/catalog/uncategorized/:itemId', (req, res) => {
    overrides.remove(String(req.params.itemId));
    res.status(204).end();
  });

  return r;
}
