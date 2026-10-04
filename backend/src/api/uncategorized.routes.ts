import { Router } from 'express';
import { z } from 'zod';
import { mapAlegraItem } from '../alegra/alegra.mapper';
import { ConnectionRepo } from '../alegra/connection.repo';
import { listSections } from '../catalog/sections.service';
import type { AppContext } from '../context';
import { OverrideRepo } from '../custom/override.repo';
import { toHttpError } from './alegra-settings.routes';
import { HttpError } from './errors';

const assignSchema = z.object({ sectionKey: z.string().min(1) });

export function uncategorizedRoutes(ctx: AppContext): Router {
  const r = Router();
  const overrides = new OverrideRepo(ctx.db);
  const conn = new ConnectionRepo(ctx.db, ctx.config);

  /** Ítems activos de Alegra sin categoría (consulta en vivo) y su asignación local, si existe. */
  r.get('/catalog/uncategorized', async (_req, res) => {
    const client = conn.client();
    if (!client) throw new HttpError(422, 'alegra_not_configured', 'Primero configura la conexión con Alegra.');
    let raw;
    try {
      raw = await client.listActiveItems();
    } catch (e) {
      throw toHttpError(e);
    }
    const items = raw
      .map(mapAlegraItem)
      .filter((i) => !i.categoryId && i.type !== 'variantParent')
      .map((i) => ({ itemId: i.id, name: i.name, assignedSectionKey: overrides.get(i.id) }));
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
