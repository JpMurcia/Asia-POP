import { Router } from 'express';
import { ConnectionRepo } from '../alegra/connection.repo';
import type { AppContext } from '../context';
import { HttpError } from './errors';

/** Estado y actualización de la copia local de los datos de Alegra (feature 007). Alegra solo se lee (principio I). */
export function alegraDataRoutes(ctx: AppContext): Router {
  const r = Router();

  /** Estado de los datos guardados. Nunca consulta a Alegra: responde al instante, también mientras se descarga. */
  r.get('/alegra/data', (_req, res) => {
    res.json(ctx.alegraData.status());
  });

  /**
   * Inicia una actualización desde Alegra y responde sin esperarla. Si ya hay una descarga en curso no inicia otra. Un
   * fallo de Alegra no es un error de esta ruta: queda en `lastError` del estado y la copia anterior sigue intacta.
   */
  r.post('/alegra/data/refresh', (_req, res) => {
    if (!new ConnectionRepo(ctx.db, ctx.config).status().isConfigured) {
      throw new HttpError(422, 'alegra_not_configured', 'Primero configura la conexión con Alegra.');
    }
    ctx.alegraData.start();
    res.status(202).json(ctx.alegraData.status());
  });

  return r;
}
