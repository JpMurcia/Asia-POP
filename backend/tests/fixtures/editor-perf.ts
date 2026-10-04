/**
 * Herramienta de medición (no forma parte de las pruebas automáticas): mide en una app ya arrancada los tiempos que
 * pide el quickstart (escenario 15, SC-001 y SC-008) con 60 elementos en la página, a 1366×768:
 *
 *   - el elemento arrastrado acompaña al puntero: retraso de `pointermove` al siguiente cuadro pintado (< 100 ms);
 *   - propiedad → lienzo: escribir un valor en el inspector hasta que el lienzo lo muestra (< 0,2 s);
 *   - Guardar: del clic a "Todo guardado" (< 1 s);
 *   - cambio de color → PDF: cambiar un color, guardar, preparar y generar hasta tener el PDF (< 3 min).
 *
 *   APP_URL=http://127.0.0.1:3000 SEED_USERNAME=… SEED_PASSWORD=… npx tsx backend/tests/fixtures/editor-perf.ts
 *
 * Modifica la plantilla Neón Noche de esa app (agrega elementos y cambia un color): úsala con datos de prueba
 * (`DATA_DIR` temporal), no con los datos reales de la tienda.
 */
import puppeteer from 'puppeteer';
import { resolveChromePath } from '../../src/pdf/pdf.service';
import type { Template, WorkspaceState } from '../../src/catalog/template';
import { draftText } from '../../src/catalog/template-presets';

const appUrl = (process.env.APP_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const username = process.env.SEED_USERNAME ?? 'admin';
const password = process.env.SEED_PASSWORD ?? 'AsiaPop2026';

const login = await fetch(`${appUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
if (login.status !== 204) throw new Error(`No se pudo iniciar sesión (${login.status})`);
const sid = /sid=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')![1]!;
const cookie = `sid=${sid}`;

async function api<T>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`${appUrl}${route}`, {
    method,
    headers: { Cookie: cookie, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${route} → ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// --- 60 elementos en Portada de Neón Noche ----------------------------------------------------------------------------
const ws = await api<WorkspaceState>('GET', '/api/settings/templates');
const neon = ws.templates.find((t) => t.id === 'neon') as Template;
// Se puede repetir: primero quita los de una medición anterior
neon.pages.portada.els = neon.pages.portada.els.filter((e) => !e.id.startsWith('perf'));
const els = neon.pages.portada.els;
for (let i = els.length; i < 60; i++) {
  els.push({ ...draftText({ name: `Elemento ${i}`, text: `Elemento ${i}`, size: 14, x: (i * 7) % 80, y: 5 + ((i * 11) % 85), w: 16, h: 3.5 }), id: `perf${i}` });
}
await api('PUT', '/api/settings/templates', { templates: ws.templates, defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision });
console.log(`Portada de Neón Noche con ${els.length} elementos.`);

const browser = await puppeteer.launch({ headless: true, executablePath: await resolveChromePath(), args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.evaluateOnNewDocument('globalThis.__name = (f) => f;');
await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
await page.setCookie({ name: 'sid', value: sid, url: appUrl });
await page.goto(`${appUrl}/apariencia`, { waitUntil: 'networkidle0', timeout: 60_000 });
await page.waitForSelector('[data-testid="canvas-page"]');
await new Promise((r) => setTimeout(r, 500));

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const p = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
  return { n: s.length, media: xs.reduce((a, b) => a + b, 0) / xs.length, p95: p(0.95), max: s.at(-1)! };
};
const ms = (n: number) => `${n.toFixed(1)} ms`;
const results: [string, string, boolean][] = [];

// --- 1. Arrastre: retraso hasta el siguiente cuadro pintado ----------------------------------------------------------------
const target = await page.$eval('[data-el-id="perf30"]', (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(target.x, target.y);
await page.mouse.down();
const drag = (await page.evaluate(
  async (x0: number, y0: number) => {
    const times: number[] = [];
    for (let i = 1; i <= 60; i++) {
      const t0 = performance.now();
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: x0 + i * 2, clientY: y0 + i, pointerId: 1, bubbles: true }));
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      times.push(performance.now() - t0);
    }
    return times;
  },
  target.x,
  target.y,
)) as number[];
await page.mouse.up();
const d = stats(drag);
console.log(`Arrastre (60 movimientos): media ${ms(d.media)}, p95 ${ms(d.p95)}, máx ${ms(d.max)}`);
results.push(['Arrastre acompaña al puntero (p95)', `${ms(d.p95)} (< 100 ms)`, d.p95 < 100]);

// --- 2. Propiedad → lienzo -------------------------------------------------------------------------------------------------
// El arrastre pudo tomar otro elemento (hay 60 apilados): se elige explícitamente uno desde la lista de capas
await page.keyboard.press('Escape');
await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('[data-testid="layers"] .ed-layer-main')).find((b) => b.textContent?.startsWith('Elemento 30'));
  (row as HTMLElement).click();
});
await new Promise((r) => setTimeout(r, 200));
const prop = (await page.evaluate(async () => {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="X %"]');
  if (!input) throw new Error('no hay inspector de elemento: ' + document.querySelector('[data-testid="inspector"]')?.textContent?.slice(0, 80));
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  const node = document.querySelector<HTMLElement>('[data-testid="canvas-page"] [data-el-id="perf30"]')!;
  const times: number[] = [];
  for (let i = 0; i < 20; i++) {
    const value = String(10 + i);
    const t0 = performance.now();
    set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    if (node.style.left !== `${value}%`) throw new Error(`el lienzo no mostró ${value}%`);
    times.push(performance.now() - t0);
  }
  return times;
})) as number[];
const p = stats(prop);
console.log(`Propiedad → lienzo (20 cambios): media ${ms(p.media)}, p95 ${ms(p.p95)}, máx ${ms(p.max)}`);
results.push(['Propiedad → lienzo (p95)', `${ms(p.p95)} (< 200 ms)`, p.p95 < 200]);

// --- 3. Guardar -----------------------------------------------------------------------------------------------------------
const save = (await page.evaluate(async () => {
  const button = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Guardar') as HTMLButtonElement;
  const t0 = performance.now();
  button.click();
  while (!document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado')) {
    await new Promise((r) => setTimeout(r, 5));
    if (performance.now() - t0 > 30_000) throw new Error('el guardado no terminó');
  }
  return performance.now() - t0;
})) as number;
console.log(`Guardar (60 elementos): ${ms(save)}`);
results.push(['Guardar', `${ms(save)} (< 1000 ms)`, save < 1000]);

// --- 4. Cambio de color → PDF -----------------------------------------------------------------------------------------------
await page.evaluate(async () => {
  const button = Array.from(document.querySelectorAll('nav button')).find((b) => b.textContent?.trim() === 'Estilo') as HTMLButtonElement;
  button.click();
});
await new Promise((r) => setTimeout(r, 200));
const t0 = Date.now();
await page.evaluate(() => {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Acento 1 hexadecimal"]')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '#00AAFF');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 100));
await page.evaluate(() => (Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Guardar') as HTMLButtonElement).click());
await page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado'));

const prep = await api<{ prepareId: string; report: { soldOutBundles: { bundleId: string }[] } }>('POST', '/api/catalog/prepare', {});
const bundleDecisions = Object.fromEntries(prep.report.soldOutBundles.map((b) => [b.bundleId, 'keep']));
await api('POST', '/api/catalog/generate', { prepareId: prep.prepareId, bundleDecisions });
let status = 'rendering';
for (let i = 0; i < 1200 && (status === 'rendering' || status === 'preparing'); i++) {
  await new Promise((r) => setTimeout(r, 250));
  status = (await api<{ status: string }>('GET', '/api/catalog/jobs/current')).status;
}
const pdfMs = Date.now() - t0;
console.log(`Cambio de color → PDF (${status}): ${(pdfMs / 1000).toFixed(1)} s`);
results.push(['Cambio de color → PDF', `${(pdfMs / 1000).toFixed(1)} s (< 180 s), estado ${status}`, status === 'done' && pdfMs < 180_000]);

// --- 5. Recorrido de SC-004, sin pausas humanas -----------------------------------------------------------------------------
// Crear una plantilla desde un estilo base, cambiar un color, mover un elemento, marcarla predeterminada y generar el PDF.
// El tiempo que toma una persona sin ayuda (< 10 min) se cronometra a mano; esto da el piso técnico del recorrido.
const click = async (name: string, prefix = false) => {
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
  await new Promise((r) => setTimeout(r, 150));
};
const setInput = (label: string, value: string) =>
  page.evaluate(
    (l, v) => {
      const input = document.querySelector<HTMLInputElement>(`input[aria-label="${l}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    },
    label,
    value,
  );
const flow0 = Date.now();
await click('Vista Plantillas');
await click('Nueva plantilla desde Kawaii pastel');
await click('Estilo');
await setInput('Acento 1 hexadecimal', '#7C3AED');
await click('Elementos');
await page.evaluate(() => {
  const row = Array.from(document.querySelectorAll('[data-testid="layers"] .ed-layer-main')).find((b) => b.textContent?.startsWith('Banner'));
  (row as HTMLElement).click();
});
await new Promise((r) => setTimeout(r, 150));
await setInput('X %', '12');
await click('Usar al generar');
await click('Guardar');
await page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado'));
const prep2 = await api<{ prepareId: string; report: { soldOutBundles: { bundleId: string }[] } }>('POST', '/api/catalog/prepare', {});
const decisions2 = Object.fromEntries(prep2.report.soldOutBundles.map((b) => [b.bundleId, 'keep']));
const gen2 = await api<{ template: { name: string; fallback: boolean } }>('POST', '/api/catalog/generate', { prepareId: prep2.prepareId, bundleDecisions: decisions2 });
let status2 = 'rendering';
for (let i = 0; i < 1200 && (status2 === 'rendering' || status2 === 'preparing'); i++) {
  await new Promise((r) => setTimeout(r, 250));
  status2 = (await api<{ status: string }>('GET', '/api/catalog/jobs/current')).status;
}
const flowMs = Date.now() - flow0;
console.log(`Recorrido SC-004 automatizado (${gen2.template.name}, ${status2}): ${(flowMs / 1000).toFixed(1)} s`);
results.push(['Recorrido SC-004, solo el piso técnico', `${(flowMs / 1000).toFixed(1)} s (la persona: < 600 s)`, status2 === 'done' && !gen2.template.fallback && flowMs < 600_000]);

await browser.close();
console.log('\n| Medida | Resultado | ¿Cumple? |\n| --- | --- | --- |');
for (const [name, value, ok] of results) console.log(`| ${name} | ${value} | ${ok ? 'sí' : 'NO'} |`);
if (results.some(([, , ok]) => !ok)) process.exitCode = 1;
