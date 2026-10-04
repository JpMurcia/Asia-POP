import { Router } from 'express';
import type { AppContext } from '../context';

export function panelRoutes(ctx: AppContext): Router {
  const r = Router();

  /** Resumen de Inicio, indicadores y estado de conexión. Si Alegra falla no es un error HTTP. */
  r.get('/panel/summary', async (req, res) => {
    res.json(await ctx.panelSummary.get(req.query.refresh === '1'));
  });

  return r;
}
