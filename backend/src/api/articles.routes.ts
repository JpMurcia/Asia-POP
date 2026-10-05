import { Router } from 'express';
import { z } from 'zod';
import { mapAlegraItem } from '../alegra/alegra.mapper';
import { ConnectionRepo } from '../alegra/connection.repo';
import { listSections } from '../catalog/sections.service';
import type { AppContext } from '../context';
import { BundleRepo } from '../custom/bundle.repo';
import { OmittedItemRepo } from '../custom/omitted-item.repo';
import { OverrideRepo } from '../custom/override.repo';
import { toHttpError } from './alegra-settings.routes';
import { HttpError } from './errors';

/** Identificador de un artículo de Alegra: texto de 1 a 64 caracteres. No se comprueba contra Alegra. */
const itemIdSchema = z.string().min(1).max(64);

function parseItemId(raw: unknown): string {
  const parsed = itemIdSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(422, 'invalid_item', 'Ese artículo no es válido.');
  return parsed.data;
}

/**
 * Artículos de Alegra que la persona omite del catálogo (feature 006). La lista es solo local: ninguna de estas rutas
 * escribe en Alegra (principio I) y omitir o volver a incluir ni siquiera la consulta.
 */
export function articlesRoutes(ctx: AppContext): Router {
  const r = Router();
  const conn = new ConnectionRepo(ctx.db, ctx.config);
  const omitted = new OmittedItemRepo(ctx.db);

  /** Artículos activos de Alegra (consulta en vivo) con su marca de omitido y la sección con la que se mostrarían. */
  r.get('/catalog/articles', async (_req, res) => {
    const client = conn.client();
    if (!client) throw new HttpError(422, 'alegra_not_configured', 'Primero configura la conexión con Alegra.');
    let raw;
    let sections;
    try {
      [raw, sections] = await Promise.all([client.listActiveItems(), listSections(ctx)]);
    } catch (e) {
      throw toHttpError(e);
    }
    const sectionName = new Map(sections.map((s) => [s.key, s.name]));
    const overrides = new OverrideRepo(ctx.db).all();
    const omittedIds = omitted.all();

    // Nombres de los combos que usan cada artículo de Alegra como componente (sin repetir, por nombre)
    const bundlesOf = new Map<string, Set<string>>();
    for (const b of new BundleRepo(ctx.db, ctx.uploadsDir).list()) {
      for (const c of b.components) {
        if (c.source !== 'alegra') continue;
        if (!bundlesOf.has(c.productId)) bundlesOf.set(c.productId, new Set());
        bundlesOf.get(c.productId)!.add(b.name);
      }
    }

    const items = raw
      .map(mapAlegraItem)
      .filter((i) => i.type !== 'variantParent')
      .map((i) => {
        // La categoría del artículo; si no tiene, la sección asignada en «Sin categoría»; si tampoco, ninguna
        let sectionKey: string | null = null;
        let name: string | null = null;
        if (i.categoryId) {
          sectionKey = `alegra:${i.categoryId}`;
          name = i.categoryName ?? sectionName.get(sectionKey) ?? null;
        } else {
          const assigned = overrides.get(i.id);
          if (assigned && sectionName.has(assigned)) {
            sectionKey = assigned;
            name = sectionName.get(assigned)!;
          }
        }
        return {
          itemId: i.id,
          name: i.name,
          sectionKey,
          sectionName: name,
          price: i.price,
          soldOut: i.soldOut,
          omitted: omittedIds.has(i.id),
          bundles: [...(bundlesOf.get(i.id) ?? [])].sort((x, y) => x.localeCompare(y, 'es', { sensitivity: 'base' })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    res.json({ items });
  });

  r.put('/catalog/omitted/:itemId', (req, res) => {
    omitted.add(parseItemId(req.params.itemId));
    res.status(204).end();
  });

  r.delete('/catalog/omitted/:itemId', (req, res) => {
    omitted.remove(parseItemId(req.params.itemId));
    res.status(204).end();
  });

  return r;
}
