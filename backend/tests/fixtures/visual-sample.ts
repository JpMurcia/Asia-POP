/**
 * Herramienta de revisión visual (no forma parte de las pruebas automáticas): genera un catálogo de muestra con
 * Alegra simulado, lo abre en Chrome y guarda una captura PNG por página en la carpeta indicada.
 *
 *   OUT=ruta/carpeta npx tsx backend/tests/fixtures/visual-sample.ts
 *
 * Variables opcionales:
 *   MOCK_IMG=ruta.png   imagen de producto (por defecto un píxel)
 *   LONG=1              textos en el máximo permitido (nombres, descripciones, políticas, dirección, banner)
 *   TEMPLATE=neon|pop|kawaii|kraft   plantilla con la que se dibuja (por defecto, la predeterminada: Neón Noche)
 *   PDF=ruta.pdf        además guarda el PDF generado
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import puppeteer from 'puppeteer';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import { createContext } from '../../src/context';
import { openDatabase } from '../../src/db/database';
import { PuppeteerRenderer, resolveChromePath } from '../../src/pdf/pdf.service';
import { startAlegraMock } from './alegra-mock';

const out = process.env.OUT ?? path.join(os.tmpdir(), 'asiapop-visual');
const long = process.env.LONG === '1';
fs.mkdirSync(out, { recursive: true });

const text = (n: number, seed: string) => {
  let s = '';
  while (s.length < n) s += `${seed} `;
  return s.slice(0, n).trim();
};

const mock = await startAlegraMock({
  categories: [
    { id: 'c1', name: 'RAMEN' },
    { id: 'c2', name: long ? 'CATEGORÍA DE ALEGRA CON UN NOMBRE EXCESIVAMENTE LARGO PARA EL TÍTULO' : 'SNACKS' },
    { id: 'c3', name: 'BEBIDAS' },
  ],
});
const img = `${mock.url}/img/ok.png`;
const base = { status: 'active', images: [img] };
const desc = 'Fideos instantáneos coreanos con caldo intenso y picante. Ideal para preparar rápido.';
mock.setItems([
  { ...base, id: '1', name: long ? text(120, 'Nombre') : 'Shin Ramyun', description: long ? text(2000, 'descripción') : desc, price: 9000, category: { id: 'c1', name: 'RAMEN' } },
  { ...base, id: '2', name: 'Champong', description: desc, price: 9000, category: { id: 'c1', name: 'RAMEN' }, inventory: { availableQuantity: 0, trackInventory: true } },
  { ...base, id: '3', name: 'Soon Veggie', description: desc, price: 9000, category: { id: 'c1', name: 'RAMEN' } },
  { ...base, id: '4', name: 'Kimchi Bowl', description: desc, price: 12000, category: { id: 'c1', name: 'RAMEN' } },
  { ...base, id: '5', name: 'Pepero', description: 'Barquillos cubiertos de chocolate.', price: 15000, category: { id: 'c2', name: 'SNACKS' } },
  { ...base, id: '6', name: 'Ramune', description: 'Gaseosa japonesa con canica.', price: 8000, category: { id: 'c3', name: 'BEBIDAS' } },
]);

const config = {
  port: 0,
  seedUsername: 'tienda',
  seedPassword: 'clave-semilla-test',
  encryptionKey: Buffer.alloc(32, 7),
  dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-visual-')),
  alegraBaseUrl: mock.url,
  frontendDir: path.join(ROOT_DIR, 'frontend', 'dist'),
};
const ctx = createContext(config, openDatabase(':memory:'), { renderer: new PuppeteerRenderer() });
const server = createApp(ctx).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base_url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
ctx.runtime.baseUrl = base_url;

let cookie = '';
async function api(method: string, url: string, body?: unknown, form?: FormData) {
  const res = await fetch(base_url + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0]!;
  const t = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${t}`);
  return t ? JSON.parse(t) : undefined;
}
const png = fs.readFileSync(process.env.MOCK_IMG ?? path.join(ROOT_DIR, 'docs', 'Diseño de catálogo y administración', 'assets', 'logo.jpg'));
const upload = (url: string) => {
  const fd = new FormData();
  fd.append('image', new Blob([png], { type: 'image/jpeg' }), 'p.jpg');
  return api('PUT', url, undefined, fd);
};

await api('POST', '/api/auth/login', { username: 'tienda', password: 'clave-semilla-test' });
await api('PUT', '/api/settings/alegra', { email: 'tienda@example.com', apiToken: 'tok_valido' });

if (long) {
  await api('PUT', '/api/settings/business', {
    storeName: 'ASIANPOP MARKET+',
    coverTitle: text(80, 'Banner'),
    phone1: '310 669 0585',
    phone2: '318 807 0709',
    address: text(160, 'Dirección'),
    terms: Array.from({ length: 10 }, (_, i) => ({ title: text(80, `Política${i + 1}`), body: text(350, 'condición') })),
  });
}
const templateId = process.env.TEMPLATE || undefined;
if (templateId && !['neon', 'pop', 'kawaii', 'kraft'].includes(templateId)) {
  throw new Error(`TEMPLATE debe ser neon, pop, kawaii o kraft (recibido: ${templateId})`);
}

const section = await api('POST', '/api/sections/custom', {
  name: long ? text(60, 'SECCIÓN').toUpperCase() : 'MOCHIS',
  introText: long ? text(800, 'introducción') : '¿Qué es el mochi?\nPostre japonés de arroz glutinoso relleno de crema.\nElaborado bajo pedido.',
});
const product = await api('POST', '/api/custom-products', {
  sectionId: section.id,
  name: long ? text(120, 'Mochi') : 'Caja de mochis',
  description: long ? text(600, 'relleno') : 'Rellenos de crema de leche.',
  price: null,
  options: [
    { label: long ? text(80, 'Caja1') : 'Caja x 6 UND', price: 30000, maxFlavors: 3 },
    { label: long ? text(80, 'Caja2') : 'Caja x 12 UND', price: 55000, maxFlavors: 6 },
  ],
  flavors: long ? Array.from({ length: 12 }, (_, i) => text(60, `SABOR${i + 1}`)) : ['FRESA', 'ARÁNDANO', 'MANGO', 'MARACUYÁ'],
});
await upload(`/api/custom-products/${product.id}/image`);
const bundle = await api('POST', '/api/bundles', {
  sectionId: section.id,
  name: long ? text(100, 'Combo') : 'Combo regalo',
  description: long ? text(500, 'regalo') : 'Ramen + snack para regalar.',
  pricing: { type: 'discount', percent: 10 },
  components: [
    { source: 'alegra', productId: '1', quantity: 2 },
    { source: 'alegra', productId: '5', quantity: 1 },
  ],
});
await upload(`/api/bundles/${bundle.id}/image`);

const prep = await api('POST', '/api/catalog/prepare', { templateId });
const decisions: Record<string, string> = {};
for (const b of prep.report.soldOutBundles) decisions[b.bundleId] = 'keep';
console.log('plantilla:', templateId ?? '(predeterminada)');
console.log('estructura:', JSON.stringify(prep.structure));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: await resolveChromePath(),
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 1 });
await page.setCookie({ name: 'sid', value: cookie.split('=')[1]!, url: base_url });
await page.goto(`${base_url}/vista-previa/${prep.prepareId}`, { waitUntil: 'networkidle0', timeout: 60_000 });
await page.waitForFunction('window.__printReady === true', { timeout: 60_000 });
const pages = await page.$$('.a4-page');
for (let i = 0; i < pages.length; i++) {
  await pages[i]!.screenshot({ path: path.join(out, `page-${String(i + 1).padStart(2, '0')}.png`) });
}
console.log(`${pages.length} páginas guardadas en ${out}`);

if (process.env.PDF) {
  await api('POST', '/api/catalog/generate', { prepareId: prep.prepareId, bundleDecisions: decisions });
  let job = { status: 'rendering' } as { status: string; catalogId?: string };
  for (let i = 0; i < 400 && job.status === 'rendering'; i++) {
    await new Promise((r) => setTimeout(r, 250));
    job = await api('GET', '/api/catalog/jobs/current');
  }
  const res = await fetch(`${base_url}/api/catalog/history/${job.catalogId}/pdf`, { headers: { Cookie: cookie } });
  fs.writeFileSync(process.env.PDF, Buffer.from(await res.arrayBuffer()));
  console.log('PDF guardado en', process.env.PDF);
}

await browser.close();
await ctx.renderer.close();
server.close();
await mock.close();
process.exit(0);
