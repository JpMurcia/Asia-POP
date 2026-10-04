import path from 'node:path';
import { SessionStore } from './auth/session';
import { PanelSummaryService } from './catalog/panel-summary';
import { PrepareStore } from './catalog/prepare-store';
import type { AppConfig } from './config/env';
import type { Db } from './db/database';
import { ImageCache } from './pdf/image-cache';
import { JobManager } from './pdf/job';
import { HistoryRepo } from './pdf/history.repo';
import { PuppeteerRenderer, type PdfRenderer } from './pdf/pdf.service';

/** Dependencias compartidas por las rutas. */
export interface AppContext {
  config: AppConfig;
  db: Db;
  sessions: SessionStore;
  jobs: JobManager;
  prepares: PrepareStore;
  imageCache: ImageCache;
  history: HistoryRepo;
  panelSummary: PanelSummaryService;
  renderer: PdfRenderer;
  uploadsDir: string;
  /** URL base local desde la que el navegador headless abre la vista de impresión. Se fija al escuchar. */
  runtime: { baseUrl: string };
}

export function createContext(
  config: AppConfig,
  db: Db,
  overrides: Partial<AppContext> = {},
): AppContext {
  const ctx = {
    config,
    db,
    sessions: new SessionStore(),
    jobs: new JobManager(),
    prepares: new PrepareStore(),
    imageCache: new ImageCache(path.join(config.dataDir, 'image-cache')),
    history: new HistoryRepo(db, path.join(config.dataDir, 'output')),
    renderer: new PuppeteerRenderer(config.chromePath),
    uploadsDir: path.join(config.dataDir, 'uploads'),
    runtime: { baseUrl: `http://127.0.0.1:${config.port}` },
    ...overrides,
  } as AppContext;
  // El servicio del resumen necesita el contexto completo (base de datos, historial, rutas de subida)
  ctx.panelSummary ??= new PanelSummaryService(ctx);
  return ctx;
}
