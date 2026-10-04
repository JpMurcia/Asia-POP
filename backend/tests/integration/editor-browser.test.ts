import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import { resolveChromePath } from '../../src/pdf/pdf.service';
import { SEED, testConfig, testContext } from '../helpers';

/**
 * Quickstart 2 a 6 y 10 en un navegador real: los eventos de puntero, el foco y la geometría no se pueden validar en
 * jsdom (no calcula diseño). Usa `frontend/dist`: ejecuta `npm run build` antes si cambiaste el frontend.
 * Los escenarios que guardan van al final: comparten la base de datos.
 */

const DIST = path.join(ROOT_DIR, 'frontend', 'dist');

let server: Server;
let browser: Browser;
let baseUrl = '';
let sid = '';
const opened: Page[] = [];

beforeAll(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    execSync('npm run build -w frontend', { cwd: ROOT_DIR, stdio: 'ignore' });
  }
  const ctx = testContext({ config: testConfig({ frontendDir: DIST }) });
  const app = createApp(ctx);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  ctx.runtime.baseUrl = baseUrl;
  const login = await request.agent(server).post('/api/auth/login').send(SEED).expect(204);
  sid = /sid=([^;]+)/.exec(String(login.headers['set-cookie']))![1]!;
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
});

afterEach(async () => {
  while (opened.length) await opened.pop()!.close();
});

// ---------------------------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------------------------

const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
const center = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function openEditor(): Promise<Page> {
  const page = await browser.newPage();
  opened.push(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  (page as Page & { errors: string[] }).errors = errors;
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.setCookie({ name: 'sid', value: sid, url: baseUrl });
  await page.goto(`${baseUrl}/apariencia`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await page.waitForSelector('[data-testid="canvas-page"]', { timeout: 20_000 });
  await settle(300);
  return page;
}

const noErrors = (page: Page) => expect((page as Page & { errors: string[] }).errors, 'sin errores en la página').toEqual([]);

/** Pulsa un botón por su nombre accesible (`aria-label` o texto), exacto o por prefijo, dentro de un selector. */
async function press(page: Page, name: string, opts: { prefix?: boolean; scope?: string } = {}) {
  const ok = await page.evaluate(
    (n, prefix, scope) => {
      const root: ParentNode | null = scope ? document.querySelector(scope) : document;
      const label = (b: Element) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim();
      const el = Array.from(root?.querySelectorAll('button') ?? []).find((b) => (prefix ? label(b).startsWith(n) : label(b) === n));
      if (!el) return false;
      (el as HTMLElement).click();
      return true;
    },
    name,
    !!opts.prefix,
    opts.scope ?? null,
  );
  if (!ok) throw new Error(`No hay un botón "${name}"`);
  await settle(60);
}

const layer = (page: Page, name: string) => press(page, name, { prefix: true, scope: '[data-testid="layers"]' });

const rect = (page: Page, selector: string): Promise<Box> =>
  page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

const value = (page: Page, label: string) => page.$eval(`[aria-label="${label}"]`, (el) => (el as HTMLInputElement).value);
const has = (page: Page, selector: string) => page.$(selector).then((el) => el !== null);
const count = (page: Page, selector: string) => page.$$eval(selector, (els) => els.length);
const text = (page: Page, selector: string) => page.$eval(selector, (el) => el.textContent ?? '');
const status = (page: Page) => text(page, '[data-testid="save-status"]');

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
}

async function keyWith(page: Page, modifier: 'Control' | 'Shift', key: string) {
  await page.keyboard.down(modifier);
  await page.keyboard.press(key as never);
  await page.keyboard.up(modifier);
  await settle(40);
}

/** Selector dentro de la hoja del lienzo (la tira de páginas también dibuja miniaturas con los mismos elementos). */
const inCanvas = (selector: string) => `[data-testid="canvas-page"] ${selector}`;

/** Reemplaza el contenido de un campo escribiendo como una persona (selecciona todo y teclea; vacío = borrar). */
async function fill(page: Page, selector: string, value: string) {
  await page.$eval(selector, (el) => {
    (el as HTMLInputElement).focus();
    (el as HTMLInputElement).select();
  });
  if (value === '') await page.keyboard.press('Backspace');
  else await page.keyboard.type(value);
  await settle(80);
}

const ids = (page: Page) => page.$$eval('[data-testid="canvas-page"] [data-el-id]', (els) => els.map((e) => e.getAttribute('data-el-id')));

// ---------------------------------------------------------------------------------------------------------------
// Escenarios
// ---------------------------------------------------------------------------------------------------------------

describe('editor de plantillas en un navegador real', () => {
  it('2. entrar y salir: pantalla completa, secciones, tira de páginas, zoom y "← Menú"', async () => {
    const page = await openEditor();
    expect(await has(page, 'main'), 'sin la estructura del panel').toBe(false);
    expect(await has(page, '[data-testid="inspector"]')).toBe(true);
    expect(await count(page, '[data-testid^="thumb-"]')).toBe(4);
    expect(await text(page, '[data-testid="zoom-label"]')).toMatch(/^\d+%$/);
    await press(page, 'Acercar');
    const zoomed = Number.parseInt(await text(page, '[data-testid="zoom-label"]'));
    await press(page, 'Ajustar');
    expect(Number.parseInt(await text(page, '[data-testid="zoom-label"]'))).toBeLessThan(zoomed);
    // el lienzo mide lo que dice el zoom
    const frame = await rect(page, '[data-testid="canvas-page"]');
    expect(frame.width).toBeCloseTo((595.28 * Number.parseInt(await text(page, '[data-testid="zoom-label"]'))) / 100, 0);

    // Barra superior como el mockup: "← Menú" con el logo de la tienda y la plantilla predeterminada a pleno color
    expect(
      await page.$eval('.ed-back img', (img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
      'el logo de "← Menú" cargó',
    ).toBe(true);
    const defaultBtn = await page.$eval('.ed-default-btn', (el) => {
      const s = getComputedStyle(el);
      return { text: el.textContent, opacity: s.opacity, background: s.backgroundColor, color: s.color };
    });
    expect(defaultBtn).toEqual({ text: 'Predeterminada', opacity: '1', background: 'rgb(255, 184, 0)', color: 'rgb(42, 18, 88)' });

    // "← Menú" devuelve a la pantalla principal del panel
    await press(page, '← Menú');
    await page.waitForFunction(() => location.pathname === '/', { timeout: 10_000 });
    await page.waitForSelector('main', { timeout: 10_000 });
    noErrors(page);
  });

  it('3. editar en el lienzo: arrastrar, redimensionar, ajustar al centro y atajos', async () => {
    const page = await openEditor();
    await press(page, 'Elementos'); // el panel que abre por defecto es Plantillas
    await press(page, 'Agregar título');
    const frame = await rect(page, '[data-testid="canvas-page"]');
    const pctX = frame.width / 100;
    expect(await value(page, 'X %')).toBe('15');

    // Arrastrar: 100 px a la derecha y 60 hacia abajo
    const sel = await rect(page, '[data-testid="selection"]');
    await dragTo(page, center(sel), { x: center(sel).x + 100, y: center(sel).y + 60 });
    await page.mouse.up();
    await settle();
    expect(Number(await value(page, 'X %'))).toBeCloseTo(15 + 100 / pctX, 0);
    expect(Number(await value(page, 'Y %'))).toBeGreaterThan(44);

    // Redimensionar desde la esquina
    const wBefore = Number(await value(page, 'Ancho %'));
    const handle = await rect(page, '[data-testid="resize-handle"]');
    await dragTo(page, center(handle), { x: center(handle).x - 60, y: center(handle).y });
    await page.mouse.up();
    await settle();
    expect(Number(await value(page, 'Ancho %'))).toBeCloseTo(wBefore - 60 / pctX, 0);

    // Un título nuevo nace centrado: un empujón de 1 % se ajusta al centro y muestra la guía
    await press(page, 'Agregar título');
    const fresh = await rect(page, '[data-testid="selection"]');
    await dragTo(page, center(fresh), { x: center(fresh).x + pctX, y: center(fresh).y });
    expect(await has(page, '[data-testid="guide-v"]'), 'la guía de centro aparece durante el arrastre').toBe(true);
    await page.mouse.up();
    await settle();
    expect(await value(page, 'X %'), 'quedó centrado').toBe('15');
    expect(await has(page, '[data-testid="guide-v"]')).toBe(false);

    // Flechas: 0,5 % y 2 % con Mayús
    await page.keyboard.press('ArrowRight');
    expect(await value(page, 'X %')).toBe('15.5');
    await keyWith(page, 'Shift', 'ArrowRight');
    expect(await value(page, 'X %')).toBe('17.5');

    // Ctrl+D duplica y selecciona la copia
    await keyWith(page, 'Control', 'd');
    expect(await text(page, '.ed-inspector-title')).toMatch(/copia/);

    // Escribir en un campo no activa atajos
    const before = await count(page, '[data-testid="canvas-page"] [data-el-type="text"]');
    await page.click('textarea[aria-label="Texto"]');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await settle();
    expect(await count(page, '[data-testid="canvas-page"] [data-el-type="text"]')).toBe(before);
    expect(await page.$eval('textarea[aria-label="Texto"]', (el) => (el as HTMLTextAreaElement).value)).toBe('Nuevo títul');

    // Fuera del campo, Esc anula la selección y Supr elimina
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    expect(await has(page, '[data-testid="selection"]')).toBe(false);
    await page.mouse.click(center(await rect(page, '[data-testid="canvas-page"]')).x, 120);
    noErrors(page);
  });

  it('4. deshacer y rehacer: cinco cambios, un arrastre cuenta como un paso', async () => {
    const page = await openEditor();
    const original = await ids(page);
    await press(page, 'Elementos');
    await press(page, 'Agregar título'); // 1
    await press(page, 'Insignia'); // 2
    await press(page, 'Rectángulo'); // 3
    await page.keyboard.press('ArrowRight'); // 4: las flechas seguidas son una acción
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await settle(900); // fuera de la ventana de fusión
    const sel = await rect(page, '[data-testid="selection"]');
    await dragTo(page, center(sel), { x: center(sel).x + 50, y: center(sel).y + 40 }); // 5: un solo paso
    await page.mouse.up();
    await settle();
    const edited = await ids(page);
    expect(edited.length).toBe(original.length + 3);

    let steps = 0;
    while (await page.$eval('[aria-label="Deshacer"]', (b) => !(b as HTMLButtonElement).disabled)) {
      await press(page, 'Deshacer');
      steps++;
      if (steps > 20) throw new Error('el historial no termina');
    }
    expect(steps, 'cinco cambios = cinco pasos').toBe(5);
    expect(await ids(page)).toEqual(original);
    expect(await status(page)).toContain('Todo guardado');

    for (let i = 0; i < 5; i++) await press(page, 'Rehacer');
    expect(await ids(page)).toEqual(edited);
    expect(await status(page)).toContain('Cambios sin guardar');
    noErrors(page);
  });

  it('5. bloques automáticos: no se eliminan, ocultan ni duplican; sí se mueven y cambian de estilo', async () => {
    const page = await openEditor();
    await press(page, 'Productos');
    await layer(page, 'Productos');
    const toast = () => text(page, '[data-testid="toast"]');
    await press(page, 'Eliminar');
    expect(await toast()).toMatch(/obligatorio/i);
    await press(page, 'Duplicar');
    expect(await toast()).toMatch(/un bloque de este tipo/i);
    await press(page, 'Ocultar');
    expect(await toast()).toMatch(/ocultar/i);
    expect(await count(page, inCanvas('[data-el-type="products"]'))).toBe(1);

    // Está fijo: se desbloquea y se mueve
    await press(page, 'Desbloquear');
    const before = Number(await value(page, 'Y %'));
    await page.keyboard.press('ArrowDown');
    expect(Number(await value(page, 'Y %'))).toBeCloseTo(before + 0.5, 1);

    for (const layout of ['Tarjetas', 'Lista', 'Alternado']) {
      await press(page, layout, { scope: '[role="group"][aria-label="Distribución"]' });
      expect(await has(page, inCanvas(`.pb[data-layout="${layout.toLowerCase()}"]`)), `distribución ${layout}`).toBe(true);
    }
    await press(page, 'Cinta', { scope: '[role="group"][aria-label="Estilo"]' });
    expect(await text(page, inCanvas('.pb-ribbon'))).toContain('AGOTADO');
    await press(page, 'Gris', { scope: '[role="group"][aria-label="Estilo"]' });
    expect(await has(page, inCanvas('[data-sold-out="true"]'))).toBe(true);
    await press(page, 'Sello', { scope: '[role="group"][aria-label="Estilo"]' });
    expect(await count(page, inCanvas('[data-testid="product-card"]'))).toBe(3);

    // El pie tampoco se puede eliminar
    await page.keyboard.press('Escape');
    await layer(page, 'Pie de página');
    await press(page, 'Eliminar');
    expect(await toast()).toMatch(/obligatorio/i);

    // Portada de sección: el bloque de introducción
    await press(page, 'Portada de sección');
    expect(await has(page, inCanvas('[data-el-type="intro"]'))).toBe(true);
    noErrors(page);
  });

  it('6. capas, fondo y vista previa', async () => {
    const page = await openEditor();
    // Fondo
    await press(page, 'Degradado', { scope: '[role="group"][aria-label="Fondo"]' });
    expect(await page.$eval('[data-testid="canvas-page"] .tpl-page', (el) => (el as HTMLElement).style.backgroundImage)).toContain('linear-gradient');
    await press(page, 'Color', { scope: '[role="group"][aria-label="Fondo"]' });
    expect(await has(page, '[data-testid="canvas-page"] img.tpl-bg')).toBe(false);

    // Capas: ocultar el Banner, seleccionarlo oculto y volver a mostrarlo
    const banner = '[data-testid="canvas-page"] [data-el-id="neon-p2"]';
    expect(await has(page, banner)).toBe(true);
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('[data-testid="layers"] li')).find((li) => li.textContent?.startsWith('Banner'))!;
      (Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Visible') as HTMLElement).click();
    });
    await settle();
    expect(await has(page, banner)).toBe(false);
    await layer(page, 'Banner');
    expect(await text(page, '.ed-inspector-title')).toBe('Banner');
    await press(page, 'Mostrar');
    expect(await has(page, banner)).toBe(true);

    // Vista previa: cuatro páginas sin ayudas de edición
    await press(page, 'Vista previa');
    expect(await count(page, '[data-testid^="preview-"]:not([data-testid="preview-pages"])')).toBe(4);
    expect(await has(page, '[data-testid="selection"]')).toBe(false);
    for (const box of await page.$$eval('[data-testid^="preview-"]:not([data-testid="preview-pages"])', (els) =>
      els.map((e) => e.getBoundingClientRect().height),
    )) {
      expect(box).toBeGreaterThan(100);
    }
    await press(page, 'Editar');
    expect(await has(page, '[data-testid="canvas-page"]')).toBe(true);
    noErrors(page);
  });

  it('7. paleta y tipografía: recolorea, rechaza valores inválidos, avisa el contraste y cambia las fuentes', async () => {
    const page = await openEditor();
    await press(page, 'Estilo');
    const banner = inCanvas('[data-el-id="neon-p2"] .tpl-text');
    const glow = () => page.$eval(banner, (el) => getComputedStyle(el).textShadow);
    const hex = (label: string) => page.$eval(`[aria-label="${label} hexadecimal"]`, (el) => (el as HTMLInputElement).value);
    const typeHex = (label: string, value: string) => fill(page, `[aria-label="${label} hexadecimal"]`, value);

    // Acento 1: el resplandor del Banner (que lo usa) cambia en el lienzo
    expect(await glow()).toContain('rgb(255, 0, 122)');
    await typeHex('Acento 1', '#00AAFF');
    expect(await hex('Acento 1')).toBe('#00AAFF');
    expect(await glow()).toContain('rgb(0, 170, 255)');

    // Un valor que no es #RRGGBB se rechaza, se avisa y conserva el anterior
    await typeHex('Acento 1', 'rosa');
    expect(await text(page, '[role="alert"]')).toContain('Debe ser un color en formato #RRGGBB.');
    expect(await glow()).toContain('rgb(0, 170, 255)');
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await settle(80);
    expect(await hex('Acento 1')).toBe('#00AAFF');

    // Restaurar colores originales
    await press(page, 'Restaurar colores originales');
    expect(await hex('Acento 1')).toBe('#FF007A');
    expect(await status(page)).toContain('Todo guardado');

    // Un fondo claro avisa, pero se puede guardar
    await typeHex('Fondo', '#F5F5F5');
    expect(await text(page, '[data-testid="palette-warnings"]')).toContain('El texto blanco puede no leerse');
    expect(await page.$eval('.ed-save', (b) => (b as HTMLButtonElement).disabled)).toBe(false);

    // Otro par tipográfico: cambian títulos y cuerpo, con las fuentes realmente cargadas
    await press(page, 'Tipografía Bungee + Poppins');
    await page.evaluate('document.fonts.ready');
    expect(await page.$eval(banner, (el) => getComputedStyle(el).fontFamily)).toContain('Bungee');
    expect(await page.evaluate('document.fonts.check(\'700 20px "Bungee"\')')).toBe(true);
    noErrors(page);
  });

  it('8. galería: crear, duplicar, usar al generar y eliminar con confirmación', async () => {
    const page = await openEditor();
    page.on('dialog', (d) => void d.accept());
    const cards = () => page.$$eval('[data-testid="gallery-card"]', (els) => els.map((e) => e.getAttribute('aria-label')));
    const inCard = (name: string, button: string) =>
      page.evaluate(
        (n, b) => {
          const card = Array.from(document.querySelectorAll('[data-testid="gallery-card"]')).find((c) => c.getAttribute('aria-label') === n)!;
          (Array.from(card.querySelectorAll('button')).find((x) => x.textContent?.trim() === b) as HTMLElement).click();
        },
        name,
        button,
      );

    await press(page, 'Vista Plantillas');
    expect(await cards()).toEqual(['Neón Noche', 'Pop crema', 'Kawaii pastel', 'Kraft minimal']);
    expect(await count(page, '[data-testid="gallery-card"] [data-testid="palette-dot"]')).toBe(20);

    // Crear desde un estilo base: se abre en el editor
    await press(page, 'Nueva plantilla desde Kawaii pastel');
    expect(await value(page, 'Nombre de la plantilla')).toBe('Nueva · Kawaii pastel');
    await press(page, 'Vista Plantillas');

    // Duplicar, usar al generar y eliminar
    await inCard('Neón Noche', 'Duplicar');
    await settle();
    expect(await cards()).toContain('Neón Noche (copia)');
    await inCard('Pop crema', 'Usar al generar');
    await settle();
    expect(await text(page, '[data-testid="toast"]')).toContain('Pop crema se usará al generar');
    expect(await page.$$eval('[data-testid="gallery-card"][data-default="true"]', (els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(['Pop crema']);
    await inCard('Neón Noche (copia)', 'Eliminar');
    await settle();
    expect(await cards()).not.toContain('Neón Noche (copia)');

    // La predeterminada no ofrece Eliminar
    const canDeleteDefault = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="gallery-card"][data-default="true"]')!;
      return Array.from(card.querySelectorAll('button')).some((b) => b.textContent?.trim() === 'Eliminar');
    });
    expect(canDeleteDefault).toBe(false);

    // Renombrar desde la barra superior; un nombre vacío no se puede guardar
    await press(page, 'Vista Editor');
    await fill(page, '[aria-label="Nombre de la plantilla"]', '');
    expect(await text(page, '[role="alert"]')).toContain('El nombre no puede estar vacío.');
    expect(await page.$eval('.ed-save', (b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await page.keyboard.type('Navidad');
    await settle(80);
    expect(await page.$eval('.ed-save', (b) => (b as HTMLButtonElement).disabled)).toBe(false);
    noErrors(page);
  });

  it('9. datos y marcadores: se reflejan al instante y los límites bloquean Guardar', async () => {
    const page = await openEditor();
    await press(page, 'Datos');
    const phones = () => text(page, inCanvas('[data-el-id="neon-p5"]'));
    const typeInto = (label: string, value: string) => fill(page, `[aria-label="${label}"]`, value);

    expect(await phones()).toBe('310 669 0585 · 318 807 0709');
    await typeInto('Teléfono 2', '300 111 2222');
    expect(await phones()).toBe('310 669 0585 · 300 111 2222');
    await typeInto('Teléfono 2', '');
    expect(await phones(), 'con el segundo teléfono vacío {telefonos} muestra solo uno').toBe('310 669 0585');

    // Un banner de 81 caracteres: el contador alerta y Guardar se deshabilita
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('[aria-label="Texto del banner de portada"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'x'.repeat(81));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle(80);
    expect(await page.$eval('[data-testid="count-coverTitle"]', (el) => el.getAttribute('data-alert'))).toBe('true');
    expect(await page.$eval('.ed-save', (b) => (b as HTMLButtonElement).disabled)).toBe(true);

    // Los chips de datos crean un texto con el marcador
    await press(page, 'Elementos');
    await page.evaluate(() => {
      const group = document.querySelector('[role="group"][aria-label="Datos del catálogo"]')!;
      (Array.from(group.querySelectorAll('button')).find((b) => b.textContent === 'Tienda') as HTMLElement).click();
    });
    await settle(80);
    expect(await page.$eval('textarea[aria-label="Texto"]', (el) => (el as HTMLTextAreaElement).value)).toBe('{tienda}');
    noErrors(page);
  });

  it('10. guardar: indicador, aviso al salir, persistencia y dos pestañas', async () => {
    const dialogs: string[] = [];
    const page = await openEditor();
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    expect(await status(page)).toContain('Todo guardado');
    await layer(page, 'Banner');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await status(page)).toContain('Cambios sin guardar');
    const moved = await value(page, 'X %');

    // "← Menú" con cambios pendientes pregunta y, si se rechaza, se queda
    await press(page, '← Menú');
    expect(dialogs).toHaveLength(1);
    expect(new URL(page.url()).pathname).toBe('/apariencia');

    // Guardar y recargar: persiste (SC-007)
    await press(page, 'Guardar');
    await page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado'));
    expect(await text(page, '[data-testid="toast"]')).toMatch(/próximo catálogo/i);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="canvas-page"]');
    await layer(page, 'Banner');
    expect(await value(page, 'X %')).toBe(moved);

    // Dos pestañas: guardar en una y luego en la otra
    const a = await openEditor();
    const b = await openEditor();
    b.on('dialog', (d) => void d.accept());
    for (const tab of [a, b]) {
      await layer(tab, 'Banner');
      await keyWith(tab, 'Shift', 'ArrowDown');
    }
    const savedByA = await value(a, 'Y %');
    await press(a, 'Guardar');
    await a.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado'));
    await press(b, 'Guardar');
    await b.waitForSelector('[role="alert"]');
    expect(await text(b, '[role="alert"]')).toMatch(/Recarga/);
    expect(await status(b), 'no pisó nada').toContain('Cambios sin guardar');
    await press(b, 'Recargar');
    await b.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado'));
    await layer(b, 'Banner');
    expect(await value(b, 'Y %'), 'la pestaña B ve lo que guardó A').toBe(savedByA);
    noErrors(page);
    noErrors(a);
    noErrors(b);
  });

  it('11. arrastrar y agrandar muy lejos no deja valores que el servidor rechaza', async () => {
    const page = await openEditor();
    await press(page, 'Elementos');
    await press(page, 'Agregar título');
    // Con el zoom al mínimo la hoja mide ~120 px: un arrastre de 600 px son más de 400 puntos porcentuales
    for (let i = 0; i < 15 && (await text(page, '[data-testid="zoom-label"]')) !== '20%'; i++) await press(page, 'Alejar');
    expect(await text(page, '[data-testid="zoom-label"]')).toBe('20%');

    const sel = await rect(page, '[data-testid="selection"]');
    await dragTo(page, center(sel), { x: center(sel).x + 600, y: center(sel).y });
    await page.mouse.up();
    await settle();
    expect(Number(await value(page, 'X %')), 'X no pasa de 400 %').toBeLessThanOrEqual(400);

    const handle = await rect(page, '[data-testid="resize-handle"]');
    await dragTo(page, center(handle), { x: center(handle).x + 600, y: center(handle).y });
    await page.mouse.up();
    await settle();
    expect(Number(await value(page, 'Ancho %')), 'el ancho no pasa de 500 %').toBeLessThanOrEqual(500);

    // Y se puede guardar; antes respondía 422 «La posición X: el máximo es 400». Va al final del archivo porque deja
    // un título guardado en la plantilla compartida por todos los escenarios.
    await press(page, 'Guardar');
    await page.waitForFunction(() => document.querySelector('[data-testid="save-status"]')?.textContent?.includes('Todo guardado'), { timeout: 10_000 });
    expect(await has(page, '.ed-alert')).toBe(false);
    noErrors(page);
  });
});
