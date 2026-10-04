import { Router } from 'express';
import { mapAlegraItem, type NormalizedItem } from '../alegra/alegra.mapper';
import { ConnectionRepo } from '../alegra/connection.repo';
import { computeBundlePrice } from '../catalog/bundle-pricing';
import type { AppContext } from '../context';
import { BundleRepo, bundleSchema, type Bundle } from '../custom/bundle.repo';
import { CustomProductRepo } from '../custom/custom-product.repo';
import { imageUpload, saveUploadedImage, wrapUpload } from '../custom/image-upload';
import { HttpError } from './errors';

/** Ítems activos de Alegra (mejor esfuerzo): si Alegra no responde, se devuelve vacío y los precios quedan en null. */
async function alegraItems(ctx: AppContext): Promise<NormalizedItem[] | null> {
  const client = new ConnectionRepo(ctx.db, ctx.config).client();
  if (!client) return null;
  try {
    return (await client.listActiveItems()).map(mapAlegraItem);
  } catch {
    return null;
  }
}

export function bundlesRoutes(ctx: AppContext): Router {
  const r = Router();
  const bundles = new BundleRepo(ctx.db, ctx.uploadsDir);
  const products = new CustomProductRepo(ctx.db, ctx.uploadsDir);
  const upload = wrapUpload(imageUpload);

  /** Vista con componentes resueltos y precio calculado (null si no se pudo consultar Alegra). */
  const view = (b: Bundle, items: NormalizedItem[] | null) => {
    const byId = new Map((items ?? []).map((i) => [i.id, i]));
    let complete = true;
    const components = b.components.map((c) => {
      if (c.source === 'custom') {
        const p = products.get(c.productId);
        if (!p) complete = false;
        return {
          ...c,
          name: p?.name ?? 'Producto no disponible',
          unitPrice: p ? (p.price ?? p.options[0]?.price ?? 0) : 0,
          soldOut: !p,
        };
      }
      const it = byId.get(c.productId);
      if (!it) complete = false;
      return { ...c, name: it?.name ?? 'Producto no disponible', unitPrice: it?.price ?? 0, soldOut: it ? it.soldOut : true };
    });
    const computedPrice =
      b.pricing.type === 'fixed'
        ? b.pricing.price
        : items && complete
          ? computeBundlePrice(b.pricing, components)
          : null;
    return {
      ...b,
      imageUrl: b.imagePath ? `/media/uploads/${b.imagePath}` : null,
      components,
      computedPrice,
    };
  };

  r.get('/bundles', async (_req, res) => {
    const items = await alegraItems(ctx);
    res.json(bundles.list().map((b) => view(b, items)));
  });

  /**
   * Productos disponibles para armar un combo (Alegra en vivo + propios). `soldOut` deja avisar «Combo no disponible»
   * mientras se arma el combo; un producto propio nunca está agotado (principio II).
   */
  r.get('/bundles/component-options', async (_req, res) => {
    const items = await alegraItems(ctx);
    res.json({
      alegra: (items ?? [])
        .filter((i) => i.type !== 'variantParent')
        .map((i) => ({ id: i.id, name: i.name, price: i.price, soldOut: i.soldOut })),
      custom: products.list().map((p) => ({ id: p.id, name: p.name, price: p.price ?? p.options[0]?.price ?? 0, soldOut: false })),
      alegraAvailable: items !== null,
    });
  });

  r.post('/bundles', async (req, res) => {
    const created = bundles.create(bundleSchema.parse(req.body));
    res.status(201).json(view(created, await alegraItems(ctx)));
  });

  r.put('/bundles/:id', async (req, res) => {
    const updated = bundles.update(String(req.params.id), bundleSchema.parse(req.body));
    if (!updated) throw new HttpError(404, 'not_found', 'Combo no encontrado.');
    res.json(view(updated, await alegraItems(ctx)));
  });

  r.delete('/bundles/:id', (req, res) => {
    if (!bundles.remove(String(req.params.id))) throw new HttpError(404, 'not_found', 'Combo no encontrado.');
    res.status(204).end();
  });

  r.put('/bundles/:id/image', upload, (req, res) => {
    const id = String(req.params.id);
    if (!bundles.get(id)) throw new HttpError(404, 'not_found', 'Combo no encontrado.');
    const file = saveUploadedImage(ctx.uploadsDir, req.file);
    bundles.setImage(id, file);
    res.json({ imagePath: `/media/uploads/${file}` });
  });

  return r;
}
