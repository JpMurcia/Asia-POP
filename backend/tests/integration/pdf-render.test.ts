import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import type { AppContext } from '../../src/context';
import { PuppeteerRenderer } from '../../src/pdf/pdf.service';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { SEED, testConfig, testContext } from '../helpers';

const DIST = path.join(ROOT_DIR, 'frontend', 'dist');

let mock: AlegraMock;
let server: Server;
let renderer: PuppeteerRenderer;
let ctx: AppContext;
let agent: ReturnType<typeof request.agent>;
let pdf: Buffer;

// Fotos con la forma real de Alegra: `{ id, name, url, favorite }`, servidas como `binary/octet-stream`.
// Cada producto tiene su propia URL (el simulador ignora la consulta) para que cada uno tenga su archivo en el caché.
const item = (id: string, name: string, cat: [string, string], over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name,
  description: `Descripción de ${name}. Fideos instantáneos con caldo intenso y picante.`,
  status: 'active',
  price: 9000,
  category: { id: cat[0], name: cat[1] },
  images: [{ id: Number(id), name: `foto-${id}.png`, url: `${mock.url}/img/generic.png?item=${id}`, favorite: true }],
  ...over,
});

beforeAll(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    execSync('npm run build -w frontend', { cwd: ROOT_DIR, stdio: 'ignore' });
  }
  mock = await startAlegraMock({
    categories: [
      { id: 'c1', name: 'RAMEN' },
      { id: 'c2', name: 'SNACKS' },
    ],
  });
  mock.setItems([
    item('1', 'Shin Ramyun', ['c1', 'RAMEN']),
    item('2', 'Champong', ['c1', 'RAMEN'], { inventory: { availableQuantity: 0, trackInventory: true } }),
    // Texto muy largo: no debe desbordar la burbuja ni cambiar el número de páginas
    item('3', 'Soon Veggie', ['c1', 'RAMEN'], {
      description: 'Sopa de fideos instantáneos coreanos 100% vegana con caldo suave y aromático. '.repeat(12),
    }),
    item('4', 'Kimchi Bowl', ['c1', 'RAMEN'], { price: 12000 }),
    item('5', 'Pepero', ['c2', 'SNACKS'], { price: 15000 }),
    item('6', 'Sin imagen', ['c2', 'SNACKS'], { images: [] }),
  ]);

  renderer = new PuppeteerRenderer();
  ctx = testContext({
    config: testConfig({ alegraBaseUrl: mock.url, frontendDir: DIST }),
    renderer,
  });
  const app = createApp(ctx);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  ctx.runtime.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  agent = request.agent(server);
  await agent.post('/api/auth/login').send(SEED).expect(204);
  await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'tok_valido' }).expect(200);
  const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
  await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);

  let job: { status: string; catalogId?: string; error?: string } = { status: 'rendering' };
  for (let i = 0; i < 400 && job.status === 'rendering'; i++) {
    await new Promise((r) => setTimeout(r, 250));
    job = (await agent.get('/api/catalog/jobs/current')).body;
  }
  if (job.status !== 'done') throw new Error(`generación fallida: ${job.error ?? job.status}`);
  const res = await agent.get(`/api/catalog/history/${job.catalogId}/pdf`).buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });
  pdf = res.body as Buffer;
  if (process.env.KEEP_SAMPLE_PDF) fs.writeFileSync(process.env.KEEP_SAMPLE_PDF, pdf);
}, 180_000);

afterAll(async () => {
  await renderer?.close();
  await new Promise((r) => server?.close(r));
  await mock?.close();
});

describe('PDF generado con Puppeteer', () => {
  it('es un PDF A4', async () => {
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    const info = await parser.getInfo({ parsePageInfo: true });
    await parser.destroy();
    const first = info.pages[0]!;
    expect(first.width).toBeCloseTo(595, 0);
    expect(first.height).toBeCloseTo(842, 0);
  });

  it('tiene portada + (portada + páginas) por sección + políticas = 7 páginas', async () => {
    // RAMEN: 4 productos = 2 páginas; SNACKS: 1 producto (el otro sin imagen) = 1 página
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    const info = await parser.getInfo();
    expect(info.total).toBe(7);
    await parser.destroy();
  });

  it('cada página de producto y la de políticas llevan el pie con teléfonos y dirección; las portadas no', async () => {
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    const { pages } = await parser.getText();
    await parser.destroy();
    const cover = (t: string) => t.includes('Domicilios');
    const content = pages.filter((p) => !cover(p.text));
    // 7 páginas: 3 portadas + 3 de producto... (RAMEN 2, SNACKS 1) + políticas
    expect(pages).toHaveLength(7);
    expect(content).toHaveLength(4);
    for (const p of content) {
      expect(p.text).toContain('310 669 0585');
      expect(p.text).toContain('318 807 0709');
      expect(p.text).toContain('Cra 10 # 18-15 centro');
    }
    for (const p of pages.filter((x) => cover(x.text))) {
      expect(p.text).not.toContain('Cra 10 # 18-15 centro');
      expect(p.text).toContain('310 669 0585'); // el bloque Domicilios conserva los teléfonos
    }
  });

  it('contiene títulos, precios, sello AGOTADO y no incluye el producto sin imagen', async () => {
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    const { text, pages } = await parser.getText();
    await parser.destroy();
    // El sombreado del texto hace que Chrome lo dibuje varias veces: se cuenta por páginas, no por apariciones
    const soldOutPages = pages.filter((p) => p.text.includes('AGOTADO'));
    expect(text).toContain('Catálogo de productos');
    expect(text).toMatch(/CAT[ÁA]LOGO RAMEN/i);
    expect(text).toContain('$9.000');
    expect(text).toContain('$12.000');
    expect(text).toContain('$15.000');
    expect(soldOutPages).toHaveLength(1);
    expect(text).not.toContain('Sin imagen');
    expect(text).toContain('Políticas de compra');
  });

  it('aborta la generación si una foto de producto no carga al renderizar: no hay PDF parcial ni recuadro roto', async () => {
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    // Una copia local borrada o dañada entre preparar y generar (cada producto tiene su propio archivo en el caché)
    const cacheDir = path.join(ctx.config.dataDir, 'image-cache');
    const cached = fs.readdirSync(cacheDir).filter((f) => /\.(png|jpg|webp|gif)$/.test(f));
    expect(cached.length).toBeGreaterThanOrEqual(5);
    fs.rmSync(path.join(cacheDir, cached[0]!));
    const before = (await agent.get('/api/catalog/history').expect(200)).body as unknown[];

    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    let job: { status: string; error?: string } = { status: 'rendering' };
    for (let i = 0; i < 400 && (job.status === 'rendering' || job.status === 'preparing'); i++) {
      await new Promise((r) => setTimeout(r, 250));
      job = (await agent.get('/api/catalog/jobs/current')).body;
    }
    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/No se pudo cargar la foto de 1 producto/);
    expect((await agent.get('/api/catalog/history').expect(200)).body).toHaveLength(before.length);
  }, 120_000);
});
