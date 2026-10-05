/**
 * Arnés para las pruebas que generan PDF reales: arranca la aplicación con un Alegra simulado y un renderizador
 * que, antes de exportar, abre la vista de impresión en Chrome y ejecuta un script de medición sobre el DOM.
 * Lo comparten las pruebas de fidelidad, de estilos de agotado, de desbordamiento, de tipografías y de marcadores.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PDFParse } from 'pdf-parse';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import { resolveChromePath, type PdfRenderer } from '../../src/pdf/pdf.service';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import type { PdfQuality } from '../../src/catalog/pdf-quality';
import type { CatalogPayload, CatalogStructure } from '../../src/catalog/types';
import type { Template, WorkspaceState } from '../../src/catalog/template';
import { startAlegraMock, type AlegraMock } from './alegra-mock';
import { SEED, testConfig, testContext } from '../helpers';

export const DIST = path.join(ROOT_DIR, 'frontend', 'dist');
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Texto de exactamente `n` caracteres hecho de palabras (para que pueda partirse en líneas). */
export function text(n: number, seed = 'palabra'): string {
  let s = '';
  while (s.length < n) s += `${seed} `;
  return s.slice(0, n).trim().padEnd(n, 'x');
}

/** Renderizador de prueba: abre la vista de impresión, mide el DOM con `measure` y devuelve el PDF. */
export class InspectingRenderer implements PdfRenderer {
  /** Script (expresión) que se evalúa en la página; su resultado queda en `result`. */
  measure?: string;
  result?: unknown;
  /** Se llama con la página abierta, antes de medir (p. ej. para comprobar tipografías). */
  inspect?: (page: Page) => Promise<void>;
  /** Se llama con la página recién creada, antes de navegar (p. ej. para interceptar las peticiones). */
  prepare?: (page: Page) => Promise<void>;
  private browser?: Browser;

  async render(url: string, sessionId: string): Promise<Buffer> {
    this.browser ??= await puppeteer.launch({
      headless: true,
      executablePath: await resolveChromePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await this.browser.newPage();
    try {
      await page.setViewport({ width: 1000, height: 1200 });
      await page.setCookie({ name: 'sid', value: sessionId, url: new URL(url).origin });
      if (this.prepare) await this.prepare(page);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 90_000 });
      await page.waitForFunction('window.__printReady === true', { timeout: 60_000 });
      await page.evaluate('document.fonts.ready');
      if (this.measure) this.result = await page.evaluate(this.measure);
      if (this.inspect) await this.inspect(page);
      return Buffer.from(await page.pdf({ printBackground: true, preferCSSPageSize: true }));
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }
}

export interface GenerationResult {
  /** La estructura que anunció `prepare`. */
  structure: CatalogStructure;
  /** El payload con el que se imprimió (incluye la plantilla usada). */
  payload: CatalogPayload;
  /** Lo que respondió `generate` sobre la plantilla. */
  used: { id: string; name: string; fallback: boolean };
  pdfPages: number;
  /** Texto de cada página del PDF (pdf-parse). */
  pageTexts: string[];
  text: string;
  /** Resultado del script de medición. */
  measure: unknown;
  /** Los bytes del PDF y su longitud (para comparar el peso entre calidades). */
  pdf: Buffer;
  sizeBytes: number;
}

export interface Harness {
  agent: ReturnType<typeof request.agent>;
  mock: AlegraMock;
  renderer: InspectingRenderer;
  /** Plantillas, predeterminada y datos del negocio tal como están guardados. */
  workspace(): Promise<WorkspaceState>;
  /** Guarda un cambio en el conjunto (con la revisión al día) y devuelve el estado guardado. */
  save(edit: (ws: WorkspaceState) => Partial<Pick<WorkspaceState, 'templates' | 'defaultId' | 'business'>>): Promise<WorkspaceState>;
  /** Secciones disponibles para generar (consulta `prepare`). */
  sections(): Promise<{ key: string; name: string; source: 'alegra' | 'custom'; items: number }[]>;
  /** Prepara, genera con las decisiones indicadas y devuelve el PDF medido. Sin `quality` se usa la de siempre (Optimizada). */
  generate(options?: { prepare?: object; decision?: 'keep' | 'omit'; measure?: string; quality?: PdfQuality }): Promise<GenerationResult>;
  close(): Promise<void>;
}

export interface HarnessOptions {
  categories: { id: string; name: string }[];
  /** Productos de Alegra; recibe la URL del simulado para armar las imágenes. */
  items: (mockUrl: string) => AlegraItemRaw[];
  /** Antes de generar: datos propios (secciones, productos, combos) vía API. */
  seed?: (agent: ReturnType<typeof request.agent>) => Promise<void>;
  measure?: string;
}

export async function startHarness(opts: HarnessOptions): Promise<Harness> {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    execSync('npm run build -w frontend', { cwd: ROOT_DIR, stdio: 'ignore' });
  }
  const mock = await startAlegraMock({ categories: opts.categories });
  mock.setItems(opts.items(mock.url));
  const renderer = new InspectingRenderer();
  renderer.measure = opts.measure;
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url, frontendDir: DIST }), renderer });
  const app = createApp(ctx);
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  ctx.runtime.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const agent = request.agent(server);
  await agent.post('/api/auth/login').send(SEED).expect(204);
  await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'tok_valido' }).expect(200);
  if (opts.seed) await opts.seed(agent);

  const workspace = async (): Promise<WorkspaceState> => (await agent.get('/api/settings/templates').expect(200)).body;

  const harness: Harness = {
    agent,
    mock,
    renderer,
    workspace,
    async save(edit) {
      const ws = await workspace();
      const patch = edit(structuredClone(ws));
      const res = await agent
        .put('/api/settings/templates')
        .send({ templates: ws.templates, defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision, ...patch })
        .expect(200);
      return res.body;
    },
    async sections() {
      return (await agent.post('/api/catalog/prepare').send({}).expect(200)).body.availableSections;
    },
    async generate({ prepare = {}, decision = 'keep', measure, quality } = {}) {
      if (measure !== undefined) renderer.measure = measure;
      renderer.result = undefined;
      const prep = (await agent.post('/api/catalog/prepare').send(prepare).expect(200)).body;
      const bundleDecisions = Object.fromEntries(
        (prep.report.soldOutBundles as { bundleId: string }[]).map((b) => [b.bundleId, decision]),
      );
      const gen = await agent
        .post('/api/catalog/generate')
        .send({ prepareId: prep.prepareId, bundleDecisions, ...(quality ? { quality } : {}) })
        .expect(202);
      let job: { status: string; catalogId?: string; error?: string } = { status: 'rendering' };
      for (let i = 0; i < 480 && (job.status === 'rendering' || job.status === 'preparing'); i++) {
        await new Promise((r) => setTimeout(r, 250));
        job = (await agent.get('/api/catalog/jobs/current')).body;
      }
      if (job.status !== 'done') throw new Error(`generación fallida: ${job.error ?? job.status}`);
      const res = await agent.get(`/api/catalog/history/${job.catalogId}/pdf`).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      const parser = new PDFParse({ data: new Uint8Array(res.body as Buffer) });
      const info = await parser.getInfo();
      const parsed = await parser.getText();
      await parser.destroy();
      const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body as CatalogPayload;
      return {
        structure: prep.structure,
        payload,
        used: gen.body.template,
        pdfPages: info.total,
        pageTexts: parsed.pages.map((p) => p.text),
        text: parsed.text,
        measure: renderer.result,
        pdf: res.body as Buffer,
        sizeBytes: (res.body as Buffer).length,
      };
    },
    async close() {
      await renderer.close();
      // Chrome deja conexiones abiertas: sin cortarlas, `close` espera a que venzan
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      await mock.close();
    },
  };
  return harness;
}

/** Una plantilla guardada con otro id y nombre, para no tocar las de fábrica. */
export function copyOf(t: Template, id: string, name = `Copia ${id}`): Template {
  return { ...structuredClone(t), id, name };
}
