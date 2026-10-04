/**
 * Herramienta de revisión visual (no forma parte de las pruebas automáticas): captura el editor de plantillas y las
 * pantallas de la feature 003 de una app ya arrancada, para compararlas con el mockup y adjuntarlas a `visual-review.md`.
 *
 *   APP_URL=http://127.0.0.1:3000 SEED_USERNAME=… SEED_PASSWORD=… OUT=carpeta npx tsx backend/tests/fixtures/editor-shots.ts
 *
 * Genera en `OUT`:
 *   editor-<ancho>-<plantillas|elementos|estilo|datos|seleccion|vista-previa>.png  el editor a 1366 y 1024 px
 *   galeria-<ancho>.png                                                            la vista Plantillas
 *   bases/<estilo>/<pagina>.png                                                    cada plantilla base × cada página
 *   pantallas/<nombre>-1366.png                                                    Inicio, Conexión, Generar y Combos
 * Para tener datos de muestra, arranca antes `APP_URL=… npx tsx backend/tests/fixtures/dev-mock.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer, { type Page } from 'puppeteer';
import { resolveChromePath } from '../../src/pdf/pdf.service';

const appUrl = (process.env.APP_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const out = process.env.OUT ?? 'capturas-editor';
const username = process.env.SEED_USERNAME ?? 'admin';
const password = process.env.SEED_PASSWORD ?? 'AsiaPop2026';

const login = await fetch(`${appUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
if (login.status !== 204) throw new Error(`No se pudo iniciar sesión (${login.status}): revisa SEED_USERNAME y SEED_PASSWORD`);
const sid = /sid=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')![1]!;

const browser = await puppeteer.launch({ headless: true, executablePath: await resolveChromePath(), args: ['--no-sandbox'] });
const settle = (ms = 250) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(out, { recursive: true });

async function open(route: string, width: number, height = 768, scale = 1): Promise<Page> {
  const page = await browser.newPage();
  // tsx (esbuild) envuelve las funciones con `__name`, que no existe en la página
  await page.evaluateOnNewDocument('globalThis.__name = (f) => f;');
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  await page.setCookie({ name: 'sid', value: sid, url: appUrl });
  await page.goto(`${appUrl}${route}`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await settle(400);
  return page;
}

/** Pulsa un botón por su nombre accesible (`aria-label` o texto), exacto o por prefijo. */
async function press(page: Page, name: string, prefix = false): Promise<void> {
  const ok = await page.evaluate(
    (n, p) => {
      const label = (b: Element) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
      const el = Array.from(document.querySelectorAll('button')).find((b) => (p ? label(b).startsWith(n) : label(b) === n));
      (el as HTMLElement | undefined)?.click();
      return !!el;
    },
    name,
    prefix,
  );
  if (!ok) throw new Error(`No hay un botón "${name}"`);
  await settle();
}

// --- El editor a dos anchos ---------------------------------------------------------------------------------------
for (const width of [1366, 1024]) {
  const page = await open('/apariencia', width);
  await page.screenshot({ path: path.join(out, `editor-${width}-plantillas.png`) });
  for (const tab of ['Elementos', 'Estilo', 'Datos']) {
    await press(page, tab);
    await page.screenshot({ path: path.join(out, `editor-${width}-${tab.toLowerCase()}.png`) });
  }
  await press(page, 'Elementos');
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('[data-testid="layers"] .ed-layer-main')).find((b) => b.textContent?.startsWith('Banner'));
    (row as HTMLElement | undefined)?.click();
  });
  await settle();
  await page.screenshot({ path: path.join(out, `editor-${width}-seleccion.png`) });
  await press(page, 'Vista previa');
  await page.screenshot({ path: path.join(out, `editor-${width}-vista-previa.png`) });
  await press(page, 'Editar');
  await press(page, 'Vista Plantillas');
  await page.screenshot({ path: path.join(out, `galeria-${width}.png`) });
  await page.close();
}

// --- Cada plantilla base × cada página (el lienzo, a doble resolución) -----------------------------------------------
const PAGES = ['Portada', 'Portada de sección', 'Productos', 'Políticas'];
const SLUGS = ['portada', 'seccion', 'productos', 'politicas'];
const BASES: [string, string][] = [
  ['neon', 'Neón Noche'],
  ['pop', 'Pop crema'],
  ['kawaii', 'Kawaii pastel'],
  ['kraft', 'Kraft minimal'],
];
const page = await open('/apariencia', 1366, 900, 2);
for (const [slug, name] of BASES) {
  await press(page, 'Plantillas'); // el riel
  await page.evaluate((n) => {
    const item = Array.from(document.querySelectorAll('[data-testid="panel-template"]')).find((b) => b.textContent?.includes(n));
    (item as HTMLElement | undefined)?.click();
  }, name);
  await settle();
  fs.mkdirSync(path.join(out, 'bases', slug), { recursive: true });
  for (const [i, label] of PAGES.entries()) {
    await press(page, label);
    await settle(400);
    const canvas = await page.$('[data-testid="canvas-page"]');
    await canvas!.screenshot({ path: path.join(out, 'bases', slug, `${SLUGS[i]}.png`) });
  }
}
await page.close();

// --- Las pantallas que cambian con la historia 6 -------------------------------------------------------------------------
fs.mkdirSync(path.join(out, 'pantallas'), { recursive: true });
for (const [route, name] of [
  ['/', 'inicio'],
  ['/alegra', 'conexion-alegra'],
  ['/combos', 'combos'],
] as const) {
  const p = await open(route, 1366);
  if (name === 'combos') {
    await press(p, '+ Agregar producto');
    await p.select('select[aria-label="Producto"]', await p.$eval('select[aria-label="Producto"] option:nth-child(2)', (o) => (o as HTMLOptionElement).value));
    await settle();
  }
  await p.screenshot({ path: path.join(out, 'pantallas', `${name}-1366.png`), fullPage: true });
  await p.close();
}
const gen = await open('/generar', 1366);
await press(gen, '1. Preparar y revisar', true);
await settle(1500);
await gen.screenshot({ path: path.join(out, 'pantallas', 'generar-1366.png'), fullPage: true });
await gen.close();

await browser.close();
console.log('Capturas guardadas en', path.resolve(out));
