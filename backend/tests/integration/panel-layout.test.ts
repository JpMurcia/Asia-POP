import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import puppeteer, { type Browser } from 'puppeteer';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import { resolveChromePath } from '../../src/pdf/pdf.service';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { SEED, testConfig, testContext } from '../helpers';

/**
 * FR-005: el panel debe ser legible y operable sin desplazamiento horizontal de la página en ventanas de
 * 1366×768 y de 1024 px de ancho. Se recorre cada pantalla en un navegador real con datos de longitud extrema.
 * El editor de plantillas (`/apariencia`) ocupa toda la ventana y no tiene `main` ni barra lateral: se comprueba
 * aparte (barra superior, lienzo e inspector dentro de la ventana).
 * Con `PANEL_SHOTS=carpeta` además guarda una captura de cada pantalla para la revisión visual.
 */

const DIST = path.join(ROOT_DIR, 'frontend', 'dist');
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const SCREENS: [string, string][] = [
  ['/', 'inicio'],
  ['/alegra', 'conexion-alegra'],
  ['/sin-categoria', 'sin-categoria'],
  ['/contenido', 'contenido-secciones'],
  ['/contenido?tab=productos', 'contenido-productos'],
  ['/combos', 'combos'],
  ['/generar', 'generar'],
  ['/historial', 'historial'],
];
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
];

const long = (n: number, w: string) => {
  let s = '';
  while (s.length < n) s += `${w} `;
  return s.slice(0, n).trim();
};

let mock: AlegraMock;
let server: Server;
let browser: Browser;
let baseUrl = '';
let sid = '';
let preparedId = '';

beforeAll(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    execSync('npm run build -w frontend', { cwd: ROOT_DIR, stdio: 'ignore' });
  }
  mock = await startAlegraMock({
    categories: [
      { id: 'c1', name: 'RAMEN' },
      { id: 'c2', name: long(70, 'CATEGORÍA') },
    ],
  });
  const item = (id: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
    id,
    name: long(120, 'Producto'),
    description: 'desc',
    status: 'active',
    price: 9000,
    category: { id: 'c1', name: 'RAMEN' },
    images: [`${mock.url}/img/ok.png`],
    ...over,
  });
  mock.setItems([
    item('1'),
    item('2', { inventory: { availableQuantity: 0, trackInventory: true } }),
    item('3', { category: { id: 'c2', name: long(70, 'CATEGORÍA') } }),
    item('4', { category: null, name: long(120, 'SinCategoría') }),
    item('5', { category: null }),
  ]);

  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url, frontendDir: DIST }) });
  const app = createApp(ctx);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  ctx.runtime.baseUrl = baseUrl;

  const agent = request.agent(server);
  const login = await agent.post('/api/auth/login').send(SEED).expect(204);
  sid = /sid=([^;]+)/.exec(String(login.headers['set-cookie']))![1]!;
  await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'tok_valido' }).expect(200);

  // Contenido propio con nombres largos
  const section = (await agent.post('/api/sections/custom').send({ name: long(60, 'SECCIÓN'), introText: long(800, 'intro') }).expect(201)).body;
  const product = (
    await agent
      .post('/api/custom-products')
      .send({
        sectionId: section.id,
        name: long(120, 'Mochi'),
        description: long(600, 'relleno'),
        price: null,
        options: [{ label: long(80, 'Caja'), price: 30000, maxFlavors: 6 }],
        flavors: ['FRESA', 'MANGO'],
      })
      .expect(201)
  ).body;
  await agent.put(`/api/custom-products/${product.id}/image`).attach('image', PNG, 'p.png').expect(200);
  await agent
    .post('/api/bundles')
    .send({
      sectionId: section.id,
      name: long(100, 'Combo'),
      description: 'regalo',
      pricing: { type: 'discount', percent: 10 },
      components: [
        { source: 'alegra', productId: '1', quantity: 2 },
        { source: 'alegra', productId: '2', quantity: 1 },
      ],
    })
    .expect(201);
  await agent.put('/api/settings/business').send({
    storeName: 'ASIANPOP MARKET+',
    coverTitle: long(80, 'Banner'),
    phone1: '310 669 0585',
    phone2: '318 807 0709',
    address: long(160, 'Dirección'),
    terms: Array.from({ length: 10 }, (_, i) => ({ title: long(80, `Política${i + 1}`), body: long(350, 'condición') })),
  });
  preparedId = (await agent.post('/api/catalog/prepare').send({}).expect(200)).body.prepareId;
  await agent.post('/api/catalog/generate').send({ prepareId: preparedId, bundleDecisions: Object.fromEntries(((await agent.put(`/api/catalog/prepare/${preparedId}/options`).send({}).expect(200)).body.report.soldOutBundles as { bundleId: string }[]).map((b) => [b.bundleId, 'keep'])) });

  browser = await puppeteer.launch({
    headless: true,
    executablePath: await resolveChromePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}, 180_000);

afterAll(async () => {
  await browser?.close();
  server?.closeAllConnections();
  await new Promise((r) => server?.close(r));
  await mock?.close();
});

async function open(route: string, viewport: { width: number; height: number }) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.setCookie({ name: 'sid', value: sid, url: baseUrl });
  await page.goto(baseUrl + route, { waitUntil: 'networkidle0', timeout: 60_000 });
  // La pantalla puede cargar datos después del primer render
  await new Promise((r) => setTimeout(r, 300));
  return page;
}

describe('el panel no se desborda horizontalmente (FR-005)', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.width}×${viewport.height}`, () => {
      for (const [route, name] of SCREENS) {
        it(`${name}`, async () => {
          const page = await open(route, viewport);
          try {
            const metrics = await page.evaluate(() => ({
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              bodyScrollWidth: document.body.scrollWidth,
              // Elementos que sobresalen del borde derecho de la ventana (excluye los de scroll interno propio)
              offenders: Array.from(document.querySelectorAll('main *'))
                .filter((el) => {
                  const r = el.getBoundingClientRect();
                  if (r.width === 0 || r.right <= window.innerWidth + 1) return false;
                  // Dentro de un contenedor con desplazamiento propio no cuenta
                  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
                    const o = getComputedStyle(p).overflowX;
                    if (o === 'auto' || o === 'scroll' || o === 'hidden') return false;
                  }
                  return true;
                })
                .slice(0, 5)
                .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`),
              text: document.body.innerText.length,
            }));
            if (process.env.PANEL_SHOTS) {
              fs.mkdirSync(process.env.PANEL_SHOTS, { recursive: true });
              await page.screenshot({ path: path.join(process.env.PANEL_SHOTS, `${name}-${viewport.width}.png`), fullPage: true });
            }
            expect(metrics.text, 'la pantalla cargó contenido').toBeGreaterThan(50);
            expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
            expect(metrics.bodyScrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
            expect(metrics.offenders, JSON.stringify(metrics)).toEqual([]);
          } finally {
            await page.close();
          }
        }, 60_000);
      }
    });
  }
});

describe('el editor de plantillas cabe en la ventana (FR-005)', () => {
  for (const viewport of VIEWPORTS) {
    it(`${viewport.width}×${viewport.height}`, async () => {
      const page = await open('/apariencia', viewport);
      try {
        await page.waitForSelector('[data-testid="template-editor"]', { timeout: 20_000 });
        // El lienzo se ajusta a la ventana tras medir el área disponible
        await new Promise((r) => setTimeout(r, 300));
        const metrics = await page.evaluate(() => {
          const rect = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
          };
          const inside = (r: ReturnType<typeof rect>) =>
            r.width > 0 && r.height > 0 && r.left >= -0.5 && r.top >= -0.5 && r.right <= window.innerWidth + 0.5 && r.bottom <= window.innerHeight + 0.5;
          const outsideButtons = Array.from(document.querySelectorAll('header button, header input'))
            .filter((el) => !inside(rect(el)))
            .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim());
          const canvas = document.querySelector('[data-testid="canvas-page"]');
          const inspector = document.querySelector('[data-testid="inspector"]');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            topbarButtons: document.querySelectorAll('header button').length,
            outsideButtons,
            canvas: canvas ? inside(rect(canvas)) : false,
            inspector: inspector ? inside(rect(inspector)) : false,
            hasMain: !!document.querySelector('main'),
          };
        });
        if (process.env.PANEL_SHOTS) {
          fs.mkdirSync(process.env.PANEL_SHOTS, { recursive: true });
          await page.screenshot({ path: path.join(process.env.PANEL_SHOTS, `apariencia-${viewport.width}.png`) });
        }
        expect(metrics.scrollWidth, JSON.stringify(metrics)).toBeLessThanOrEqual(metrics.clientWidth);
        expect(metrics.topbarButtons, 'la barra superior tiene sus botones').toBeGreaterThanOrEqual(5);
        expect(metrics.outsideButtons, JSON.stringify(metrics)).toEqual([]);
        expect(metrics.canvas, 'el lienzo es visible y entra en la ventana').toBe(true);
        expect(metrics.inspector, 'el inspector es visible').toBe(true);
        expect(metrics.hasMain, 'sin la estructura del panel').toBe(false);
      } finally {
        await page.close();
      }
    }, 60_000);
  }
});
