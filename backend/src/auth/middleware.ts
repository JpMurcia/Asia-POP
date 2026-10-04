import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { HttpError } from '../api/errors';
import { parseCookies, SESSION_COOKIE, type SessionStore } from './session';

export function sessionIdOf(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

export function requireAuth(store: SessionStore): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!store.isValid(sessionIdOf(req))) {
      return next(new HttpError(401, 'unauthenticated', 'Debes iniciar sesión.'));
    }
    next();
  };
}

/** Un limitador que además dice cuántos intentos le quedan a una IP (FR-035). */
export interface RateLimiter extends RequestHandler {
  /** Intentos permitidos por ventana. */
  limit: number;
  /** Intentos que le quedan a la IP de la petición, sin consumir uno. */
  remaining(req: Request): number;
}

/** Limitador simple por IP en ventana deslizante (en memoria). */
export function rateLimit(max: number, windowMs: number, now: () => number = Date.now): RateLimiter {
  const hits = new Map<string, number[]>();
  const keyOf = (req: Request) => req.ip ?? 'local';
  const recentOf = (key: string) => {
    const t = now();
    return (hits.get(key) ?? []).filter((x) => t - x < windowMs);
  };

  const handler: RequestHandler = (req, _res, next) => {
    const key = keyOf(req);
    const recent = recentOf(key);
    if (recent.length >= max) {
      hits.set(key, recent);
      return next(new HttpError(429, 'too_many_requests', 'Demasiados intentos. Espera un minuto.'));
    }
    recent.push(now());
    hits.set(key, recent);
    next();
  };

  return Object.assign(handler, {
    limit: max,
    remaining: (req: Request) => Math.max(0, max - recentOf(keyOf(req)).length),
  });
}
