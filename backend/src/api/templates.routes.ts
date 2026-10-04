import { Router } from 'express';
import { z } from 'zod';
import { paletteWarnings, type Template, type TemplateWarning } from '../catalog/template';
import { TemplateRepo } from '../catalog/template.repo';
import { workspaceSchema } from '../catalog/template.schema';
import type { AppContext } from '../context';
import { businessSchema } from './business.routes';
import { HttpError, fieldPath } from './errors';

const revisionSchema = z
  .number({ error: 'Falta la revisión que recibió la pestaña.' })
  .int('La revisión debe ser un número entero.');

type Issue = { path: PropertyKey[]; message: string };
const details = (issues: Issue[]) => issues.map((i) => ({ field: fieldPath(i.path), message: i.message }));

/** Plantillas del catálogo y los datos del negocio que se guardan con ellas (FR-018..027). */
export function templatesRoutes(ctx: AppContext): Router {
  const r = Router();
  const repo = new TemplateRepo(ctx.db);

  r.get('/settings/templates', (_req, res) => {
    res.json(repo.getWorkspace());
  });

  /** Ligero (sin documentos): lo usa el selector de Generar catálogo. */
  r.get('/settings/templates/summary', (_req, res) => {
    res.json(repo.summary());
  });

  /** Guarda todo el conjunto en una transacción; si algo falla no se escribe nada. */
  r.put('/settings/templates', (req, res) => {
    const raw = (req.body ?? {}) as Record<string, unknown>;

    const workspace = workspaceSchema.safeParse({ templates: raw.templates, defaultId: raw.defaultId });
    const revision = revisionSchema.safeParse(raw.expectedRevision);
    if (!workspace.success || !revision.success) {
      const issues = [
        ...(workspace.success ? [] : workspace.error.issues),
        ...(revision.success ? [] : revision.error.issues.map((i) => ({ ...i, path: ['expectedRevision'] }))),
      ];
      throw new HttpError(422, 'invalid_templates', 'Las plantillas no son válidas.', details(issues));
    }

    const business = businessSchema.safeParse(raw.business);
    if (!business.success) {
      throw new HttpError(422, 'invalid_business', 'Los datos del negocio no son válidos.', details(business.error.issues));
    }

    const templates = workspace.data.templates as Template[];
    const state = repo.save({
      templates,
      defaultId: workspace.data.defaultId,
      business: business.data,
      expectedRevision: revision.data,
    });
    // Advertencias de contraste de la paleta: no bloquean el guardado (FR-016)
    const warnings: TemplateWarning[] = state.templates.flatMap((t) =>
      paletteWarnings(t.palette).map((w) => ({ templateId: t.id, ...w })),
    );
    res.json({ ...state, warnings });
  });

  return r;
}
