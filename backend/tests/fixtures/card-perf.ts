/**
 * Medición de peso y tiempos de la foto-tarjeta (feature 010, SC-005 y SC-009). No forma parte de las pruebas
 * automáticas: genera un catálogo sintético de ~180 productos con fotos del tamaño de las reales, con Alegra simulado y
 * Chrome real, y compara la plantilla Base AsianPop con Neón Noche.
 *
 *   PRODUCTS=180 BACKDROP=marco|sin-fondo npx tsx backend/tests/fixtures/card-perf.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import { createContext } from '../../src/context';
import { openDatabase } from '../../src/db/database';
import { PuppeteerRenderer } from '../../src/pdf/pdf.service';
import { startAlegraMock } from './alegra-mock';

const COUNT = Number(process.env.PRODUCTS ?? 180);
const BACKDROP = process.env.BACKDROP ?? 'marco';
const PHOTOS = ['heavy.jpg', 'alpha.png', 'light.jpg', 'heavy.png'];

const mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
mock.setItems(
  Array.from({ length: COUNT }, (_, i) => ({
    id: String(i + 1),
    name: `Producto ${i + 1} de prueba con nombre algo largo`,
    description: 'Fideos instantáneos coreanos con caldo intenso y picante. Ideal para preparar rápido.',
    status: 'active',
    price: 9000,
    category: { id: 'c1', name: 'RAMEN' },
    images: [{ id: i + 1, name: `foto-${i + 1}`, url: `${mock.url}/img/${PHOTOS[i % PHOTOS.length]}?i=${i + 1}`, favorite: true }],
  })),
);
const config = {
  port: 0,
  seedUsername: 'tienda',
  seedPassword: 'clave-semilla-test',
  encryptionKey: Buffer.alloc(32, 7),
  dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-perf-')),
  alegraBaseUrl: mock.url,
  frontendDir: path.join(ROOT_DIR, 'frontend', 'dist'),
};
const ctx = createContext(config, openDatabase(':memory:'), { renderer: new PuppeteerRenderer() });
const server = createApp(ctx).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
ctx.runtime.baseUrl = base;

let cookie = '';
async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(base + url, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0]!;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}
await api('POST', '/api/auth/login', { username: 'tienda', password: 'clave-semilla-test' });
await api('PUT', '/api/settings/alegra', { email: 'tienda@example.com', apiToken: 'tok_valido' });

async function run(label: string, templateId: string) {
  const prep = await api('POST', '/api/catalog/prepare', { templateId, photoBackdrop: templateId === 'base' ? BACKDROP : undefined });
  const started = Date.now();
  await api('POST', '/api/catalog/generate', { prepareId: prep.prepareId, bundleDecisions: {}, quality: 'optimized' });
  let job: { status: string; sizeBytes?: number; backdropFallbacks?: unknown[]; error?: string } = { status: 'rendering' };
  while (job.status === 'rendering') {
    await new Promise((r) => setTimeout(r, 500));
    job = await api('GET', '/api/catalog/jobs/current');
  }
  const seconds = (Date.now() - started) / 1000;
  const mb = job.sizeBytes ? (job.sizeBytes / 1048576).toFixed(2) : '?';
  console.log(`${label.padEnd(28)} ${job.status.padEnd(7)} ${String(seconds.toFixed(1)).padStart(6)} s  ${String(mb).padStart(7)} MB  páginas=${prep.structure.totalPages}  respaldos=${job.backdropFallbacks?.length ?? 0}${job.error ? '  ERROR ' + job.error : ''}`);
}

console.log(`${COUNT} productos, fondo de la foto: ${BACKDROP}`);
await run('Neón Noche (referencia)', 'neon');
await run('Base AsianPop, 1.ª vez', 'base');
await run('Base AsianPop, 2.ª vez', 'base');
await ctx.renderer.close();
server.close();
await mock.close();
process.exit(0);
