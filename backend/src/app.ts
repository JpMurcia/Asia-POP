import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { alegraSettingsRoutes } from './api/alegra-settings.routes';
import { articlesRoutes } from './api/articles.routes';
import { authRoutes } from './api/auth.routes';
import { bundlesRoutes } from './api/bundles.routes';
import { businessRoutes } from './api/business.routes';
import { catalogRoutes, mediaRoutes } from './api/catalog.routes';
import { customRoutes } from './api/custom.routes';
import { errorHandler, notFound } from './api/errors';
import { panelRoutes } from './api/panel.routes';
import { sectionsRoutes } from './api/sections.routes';
import { templatesRoutes } from './api/templates.routes';
import { uncategorizedRoutes } from './api/uncategorized.routes';
import { requireAuth } from './auth/middleware';
import type { AppContext } from './context';

/** Construye la aplicación Express (sin escuchar), para poder probarla con supertest. */
export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable('x-powered-by');

  const guard = requireAuth(ctx.sessions);
  // El conjunto de plantillas (hasta 30 × 4 páginas × 60 elementos) supera el límite global: su `PUT` admite 2 MB.
  // Va antes del `express.json` global (que ya no lee un cuerpo leído) y detrás de la sesión, para que un cliente
  // sin sesión no pueda hacer que se lean 2 MB.
  app.use('/api/settings/templates', guard, express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();

  // Rutas públicas
  api.use(authRoutes(ctx.config, ctx.sessions));

  // Todo lo demás bajo /api y /media exige sesión (FR-003)
  api.use(guard);

  // Cualquier cambio exitoso (credenciales, secciones, productos, combos, overrides, preparar...) invalida el
  // resumen de Inicio, para que contadores y secciones no queden desactualizados hasta 60 s.
  api.use((req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) ctx.panelSummary.invalidate();
      });
    }
    next();
  });

  api.use(alegraSettingsRoutes(ctx));
  api.use(panelRoutes(ctx));
  api.use(catalogRoutes(ctx));
  api.use(uncategorizedRoutes(ctx));
  api.use(articlesRoutes(ctx));
  api.use(sectionsRoutes(ctx));
  api.use(customRoutes(ctx));
  api.use(bundlesRoutes(ctx));
  api.use(businessRoutes(ctx));
  api.use(templatesRoutes(ctx));

  app.use('/api', api);
  app.use('/api', notFound);
  app.use('/media', guard, mediaRoutes(ctx));

  // Frontend compilado (si existe) con fallback para el enrutador de React
  const dist = ctx.config.frontendDir;
  if (dist && fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
