import { Router } from 'express';
import { z } from 'zod';
import { rateLimit, requireAuth, sessionIdOf } from '../auth/middleware';
import { clearedSessionCookie, credentialsMatch, sessionCookie, type SessionStore } from '../auth/session';
import type { AppConfig } from '../config/env';
import { HttpError } from './errors';

const loginSchema = z.object({ username: z.string(), password: z.string() });

/** Rutas públicas de autenticación (login) y rutas de sesión. */
export function authRoutes(config: AppConfig, store: SessionStore): Router {
  const r = Router();

  r.post('/auth/login', rateLimit(5, 60_000), (req, res) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success || !credentialsMatch(config, body.data.username, body.data.password)) {
      // Mensaje genérico: no revela cuál dato falló (FR-004).
      throw new HttpError(401, 'invalid_credentials', 'Usuario o contraseña incorrectos.');
    }
    res.setHeader('Set-Cookie', sessionCookie(store.create()));
    res.status(204).end();
  });

  r.post('/auth/logout', (req, res) => {
    store.destroy(sessionIdOf(req));
    res.setHeader('Set-Cookie', clearedSessionCookie());
    res.status(204).end();
  });

  r.get('/auth/session', requireAuth(store), (_req, res) => {
    res.json({ authenticated: true });
  });

  return r;
}
