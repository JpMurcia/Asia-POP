import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { AlegraClient } from '../alegra/alegra.client';
import { AlegraError } from '../alegra/alegra.types';
import { ConnectionRepo } from '../alegra/connection.repo';
import { rateLimit } from '../auth/middleware';
import type { AppContext } from '../context';
import { HttpError } from './errors';

const credsSchema = z.object({
  email: z.string().trim().min(3).max(200),
  apiToken: z.string().trim().min(1).max(500),
});

/** Convierte un error de Alegra en un error HTTP propio con mensaje claro. */
export function toHttpError(e: unknown): unknown {
  if (!(e instanceof AlegraError)) return e;
  switch (e.kind) {
    case 'rejected':
      return new HttpError(422, 'alegra_rejected', 'Alegra rechazó el correo o el token.');
    case 'rate_limit':
      return new HttpError(429, 'alegra_rate_limited', e.message);
    case 'unreachable':
      return new HttpError(502, 'alegra_unreachable', 'No se pudo conectar con Alegra.');
    default:
      return new HttpError(502, 'alegra_error', e.message);
  }
}

export function alegraSettingsRoutes(ctx: AppContext): Router {
  const r = Router();
  const repo = new ConnectionRepo(ctx.db, ctx.config);

  const validate = async (email: string, token: string): Promise<void> => {
    const client = new AlegraClient({ baseUrl: ctx.config.alegraBaseUrl, email, token });
    try {
      await client.getCompany();
    } catch (e) {
      throw toHttpError(e);
    }
  };

  // Una única instancia: el mismo limitador cuenta los intentos y los informa (FR-035)
  const testLimiter = rateLimit(10, 60_000);
  const attempts = (req: Request) => ({ limit: testLimiter.limit, remaining: testLimiter.remaining(req) });
  /** Igual que el limitador, pero su `429` también lleva los intentos restantes en `details`. */
  const limitTests: RequestHandler = (req, res, next) =>
    testLimiter(req, res, (err?: unknown) => {
      if (err instanceof HttpError && err.status === 429) err.details = { testAttempts: attempts(req) };
      next(err);
    });

  r.get('/settings/alegra', (req, res) => {
    res.json({ ...repo.status(), testAttempts: attempts(req) });
  });

  r.put('/settings/alegra', async (req, res) => {
    const { email, apiToken } = credsSchema.parse(req.body);
    await validate(email, apiToken); // si falla, se conservan las anteriores (FR-006)
    repo.save(email, apiToken, new Date().toISOString());
    res.json(repo.status());
  });

  r.post('/settings/alegra/test', limitTests, async (req, res) => {
    try {
      const { email, apiToken } = credsSchema.parse(req.body);
      await validate(email, apiToken);
      res.json({ ok: true, testAttempts: attempts(req) });
    } catch (e) {
      // Los errores de Alegra (422, 429, 502…) también dicen cuántos intentos quedan
      if (e instanceof HttpError) e.details ??= { testAttempts: attempts(req) };
      throw e;
    }
  });

  return r;
}

export { ConnectionRepo };
