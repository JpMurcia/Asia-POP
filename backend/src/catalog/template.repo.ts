import { HttpError } from '../api/errors';
import type { Db } from '../db/database';
import { BusinessSettingsRepo } from './settings.repo';
import type { Template, TemplateDoc, TemplateSummary, WorkspaceState } from './template';
import { BASE_TEMPLATES } from './template-presets';
import type { BusinessSettings } from './types';

interface TemplateRow {
  id: string;
  name: string;
  base: string;
  position: number;
  doc_json: string;
}

interface ThemeRow {
  background: string;
  accent1: string;
  accent2: string;
  accent3: string;
}

export interface SaveInput {
  templates: Template[];
  defaultId: string;
  business: BusinessSettings;
  /** Revisión que la pestaña recibió con el conjunto; si ya no coincide, otra pestaña guardó (409). */
  expectedRevision: number;
}

export interface Resolved {
  template: Template;
  /** `true` si se pidió una plantilla que ya no existe y se usó la predeterminada. */
  fallback: boolean;
}

/** Lo que se guarda en `doc_json`: todo salvo lo que tiene columna propia. */
function toDoc(t: Template): TemplateDoc {
  return { version: t.version, palette: t.palette, fonts: t.fonts, pages: t.pages };
}

function toTemplate(row: TemplateRow): Template {
  return { id: row.id, name: row.name, base: row.base as Template['base'], ...(JSON.parse(row.doc_json) as TemplateDoc) };
}

/**
 * Plantillas del catálogo y su conjunto: siembra, lectura, guardado atómico con control de revisión, resolución por
 * id con reemplazo y resumen. Todos los métodos públicos siembran antes de actuar, de modo que una base recién
 * migrada nunca se encuentra vacía (p. ej. la primera generación sin haber abierto Apariencia).
 */
export class TemplateRepo {
  constructor(private db: Db) {}

  /**
   * Siembra las 4 plantillas base (Neón Noche predeterminada, revisión 1) si todavía no hay conjunto. Si la feature
   * 002 dejó un tema guardado, sus cuatro colores pasan a la paleta de Neón Noche. Es idempotente y no toca
   * `catalog_theme`.
   */
  ensureSeeded(): void {
    if (this.db.prepare('SELECT 1 FROM template_workspace WHERE id = 1').get()) return;
    const theme = this.db.prepare('SELECT * FROM catalog_theme WHERE id = 1').get() as ThemeRow | undefined;
    this.db.transaction(() => {
      const insert = this.db.prepare(
        'INSERT INTO catalog_template (id, name, base, position, doc_json) VALUES (?, ?, ?, ?, ?)',
      );
      BASE_TEMPLATES.forEach((base, position) => {
        const t = structuredClone(base);
        if (t.id === 'neon' && theme) {
          t.palette = {
            ...t.palette,
            bg: theme.background.toUpperCase(),
            a1: theme.accent1.toUpperCase(),
            a2: theme.accent2.toUpperCase(),
            a3: theme.accent3.toUpperCase(),
          };
        }
        insert.run(t.id, t.name, t.base, position, JSON.stringify(toDoc(t)));
      });
      this.db
        .prepare("INSERT INTO template_workspace (id, default_template_id, revision) VALUES (1, 'neon', 1)")
        .run();
    })();
  }

  private rows(): TemplateRow[] {
    return this.db.prepare('SELECT * FROM catalog_template ORDER BY position').all() as TemplateRow[];
  }

  private workspaceRow(): { default_template_id: string; revision: number } {
    return this.db.prepare('SELECT default_template_id, revision FROM template_workspace WHERE id = 1').get() as {
      default_template_id: string;
      revision: number;
    };
  }

  /** Todas las plantillas con su documento, la predeterminada, los datos del negocio y la revisión. */
  getWorkspace(): WorkspaceState {
    this.ensureSeeded();
    const { default_template_id, revision } = this.workspaceRow();
    return {
      templates: this.rows().map(toTemplate),
      defaultId: default_template_id,
      business: new BusinessSettingsRepo(this.db).get(),
      revision,
    };
  }

  /**
   * Guarda todo el conjunto en una transacción: borra las plantillas ausentes, reemplaza las demás, fija la
   * predeterminada, escribe los datos del negocio e incrementa la revisión. Los datos ya deben estar validados;
   * si `expectedRevision` no coincide se rechaza con `409 templates_changed` sin escribir nada.
   */
  save(input: SaveInput): WorkspaceState {
    this.ensureSeeded();
    this.db.transaction(() => {
      const { revision } = this.workspaceRow();
      if (input.expectedRevision !== revision) {
        throw new HttpError(
          409,
          'templates_changed',
          'Las plantillas o los datos del catálogo cambiaron desde otra pestaña. Recarga la página para ver los valores actuales.',
        );
      }
      if (!input.templates.some((t) => t.id === input.defaultId)) {
        throw new HttpError(422, 'invalid_templates', 'La plantilla predeterminada debe estar entre las plantillas guardadas.', [
          { field: 'defaultId', message: 'La plantilla predeterminada debe estar entre las plantillas guardadas.' },
        ]);
      }
      this.db.prepare('DELETE FROM catalog_template').run();
      const insert = this.db.prepare(
        'INSERT INTO catalog_template (id, name, base, position, doc_json) VALUES (?, ?, ?, ?, ?)',
      );
      input.templates.forEach((t, position) => insert.run(t.id, t.name, t.base, position, JSON.stringify(toDoc(t))));
      new BusinessSettingsRepo(this.db).put(input.business);
      this.db
        .prepare('UPDATE template_workspace SET default_template_id = ?, revision = revision + 1 WHERE id = 1')
        .run(input.defaultId);
    })();
    return this.getWorkspace();
  }

  /** Incrementa la revisión: lo llama `PUT /settings/business`, para que una edición de datos se detecte. */
  touch(): void {
    this.ensureSeeded();
    this.db.prepare('UPDATE template_workspace SET revision = revision + 1 WHERE id = 1').run();
  }

  /** La plantilla predeterminada. */
  private defaultTemplate(): Template {
    const { default_template_id } = this.workspaceRow();
    const rows = this.rows();
    const row = rows.find((r) => r.id === default_template_id) ?? rows[0];
    // Siempre hay al menos una plantilla; esta reserva solo protege de una base editada a mano
    return row ? toTemplate(row) : structuredClone(BASE_TEMPLATES[0]!);
  }

  /**
   * La plantilla con ese id o, si falta (se eliminó) o no se indicó, la predeterminada. `fallback` solo es `true`
   * cuando se pidió una plantilla concreta que ya no existe.
   */
  resolve(templateId?: string): Resolved {
    this.ensureSeeded();
    if (templateId) {
      const row = this.db.prepare('SELECT * FROM catalog_template WHERE id = ?').get(templateId) as TemplateRow | undefined;
      if (row) return { template: toTemplate(row), fallback: false };
      return { template: this.defaultTemplate(), fallback: true };
    }
    return { template: this.defaultTemplate(), fallback: false };
  }

  /** Resumen ligero (sin documentos) para el selector de Generar catálogo. */
  summary(): { defaultId: string; items: TemplateSummary[] } {
    this.ensureSeeded();
    const { default_template_id } = this.workspaceRow();
    return {
      defaultId: default_template_id,
      items: this.rows().map((row) => {
        const t = toTemplate(row);
        return { id: t.id, name: t.name, isDefault: t.id === default_template_id, palette: t.palette, fonts: t.fonts };
      }),
    };
  }
}
