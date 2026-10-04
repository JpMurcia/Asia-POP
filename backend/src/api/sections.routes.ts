import { Router } from 'express';
import { z } from 'zod';
import { listSections } from '../catalog/sections.service';
import { SectionOrderRepo } from '../catalog/settings.repo';
import type { AppContext } from '../context';

const orderSchema = z.object({ keys: z.array(z.string().min(1)) });

export function sectionsRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/sections', async (_req, res) => {
    res.json(await listSections(ctx));
  });

  r.put('/sections/order', (req, res) => {
    const { keys } = orderSchema.parse(req.body);
    new SectionOrderRepo(ctx.db).set(keys);
    res.status(204).end();
  });

  return r;
}
