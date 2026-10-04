import { Router } from 'express';
import { z } from 'zod';
import { BUSINESS_LIMITS } from '../catalog/business-limits';
import { BusinessSettingsRepo } from '../catalog/settings.repo';
import { TemplateRepo } from '../catalog/template.repo';
import type { AppContext } from '../context';
import { parseOr422 } from './errors';

/** Total de caracteres de las políticas: más que esto no cabe en la página final del PDF. */
export const MAX_TERMS_CHARS = BUSINESS_LIMITS.termsChars;

/**
 * Datos del negocio: los usan `PUT /settings/business` y `PUT /settings/templates` (que los guarda con las plantillas).
 * Los límites viven en `business-limits.ts`, que también usa el editor para avisar antes de guardar.
 */
export const businessSchema = z.object({
  storeName: z.string().trim().min(1).max(BUSINESS_LIMITS.storeName),
  phone1: z.string().trim().max(BUSINESS_LIMITS.phone),
  phone2: z.string().trim().max(BUSINESS_LIMITS.phone),
  address: z.string().trim().max(BUSINESS_LIMITS.address),
  coverTitle: z.string().trim().min(1).max(BUSINESS_LIMITS.coverTitle),
  terms: z
    .array(z.object({ title: z.string().trim().min(1).max(BUSINESS_LIMITS.termTitle), body: z.string().trim().max(BUSINESS_LIMITS.termBody) }))
    .max(BUSINESS_LIMITS.terms)
    .refine((terms) => terms.reduce((n, t) => n + t.body.length, 0) <= MAX_TERMS_CHARS, {
      message: `Las políticas no pueden superar ${MAX_TERMS_CHARS} caracteres en total (no caben en una página).`,
    }),
});

export function businessRoutes(ctx: AppContext): Router {
  const r = Router();
  const repo = new BusinessSettingsRepo(ctx.db);

  r.get('/settings/business', (_req, res) => {
    res.json(repo.get());
  });

  r.put('/settings/business', (req, res) => {
    const data = parseOr422(businessSchema, req.body, 'invalid_business', 'Los datos del negocio no son válidos.');
    const saved = repo.put(data);
    // Los datos del negocio forman parte del conjunto que edita Apariencia: otra pestaña debe enterarse (FR-027)
    new TemplateRepo(ctx.db).touch();
    res.json(saved);
  });

  return r;
}
