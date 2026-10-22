import path from 'node:path';
import { AlegraDataRepo } from './alegra/alegra-data.repo';
import { AlegraDataService } from './alegra/alegra-data.service';
import { ConnectionRepo } from './alegra/connection.repo';
import { SessionStore } from './auth/session';
import { PanelSummaryService } from './catalog/panel-summary';
import { PrepareStore } from './catalog/prepare-store';
import type { AppConfig } from './config/env';
import type { Db } from './db/database';
import { CardMaker } from './pdf/card-cache';
import { ImageCache } from './pdf/image-cache';
import { PhotoOptimizer } from './pdf/image-optimizer';
import { JobManager } from './pdf/job';
import { HistoryRepo } from './pdf/history.repo';
import { PuppeteerRenderer, type PdfRenderer } from './pdf/pdf.service';

/** Tiempo máximo de cada petición de la descarga de la copia de Alegra. */
const ALEGRA_REQUEST_TIMEOUT_MS = 30_000;

/** Dependencias compartidas por las rutas. */
export interface AppContext {
  config: AppConfig;
  db: Db;
  sessions: SessionStore;
  jobs: JobManager;
  prepares: PrepareStore;
  imageCache: ImageCache;
  /** Copias reducidas de las fotos para el PDF en calidad Optimizada (carpeta temporal por generación). */
  photoOptimizer: PhotoOptimizer;
  /** Foto-tarjetas generadas de los productos (feature 010), en una carpeta temporal. */
  cardMaker: CardMaker;
  history: HistoryRepo;
  panelSummary: PanelSummaryService;
  /** Copia local de los datos de Alegra (feature 007): las pantallas la leen en lugar de consultar a Alegra cada vez. */
  alegraData: AlegraDataService;
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
    photoOptimizer: new PhotoOptimizer(path.join(config.dataDir, 'pdf-photos'), {
      cacheDir: path.join(config.dataDir, 'image-cache'),
      uploadsDir: path.join(config.dataDir, 'uploads'),
    }),
    cardMaker: new CardMaker(path.join(config.dataDir, 'card-cache'), {
      cacheDir: path.join(config.dataDir, 'image-cache'),
      uploadsDir: path.join(config.dataDir, 'uploads'),
    }),
    history: new HistoryRepo(db, path.join(config.dataDir, 'output')),
    renderer: new PuppeteerRenderer(config.chromePath),
    uploadsDir: path.join(config.dataDir, 'uploads'),
    runtime: { baseUrl: `http://127.0.0.1:${config.port}` },
    ...overrides,
  } as AppContext;
  // Cada petición a Alegra de la copia tiene su propio tiempo límite: una descarga colgada no deja «Actualizando» para siempre
  ctx.alegraData ??= new AlegraDataService({
    repo: new AlegraDataRepo(ctx.db),
    client: () => new ConnectionRepo(ctx.db, ctx.config).client({ timeoutMs: ALEGRA_REQUEST_TIMEOUT_MS }),
    email: () => new ConnectionRepo(ctx.db, ctx.config).status().email,
  });
  // El servicio del resumen necesita el contexto completo (base de datos, historial, rutas de subida)
  ctx.panelSummary ??= new PanelSummaryService(ctx);
  return ctx;
}
