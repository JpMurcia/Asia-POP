import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FONT_KEYS, FONT_LABELS, type FontKey } from '../../src/catalog/template';
import { baseTemplate } from '../../src/catalog/template-presets';
import { copyOf, startHarness, type Harness } from '../fixtures/pdf-harness';

/**
 * FR-017: las seis familias tipográficas salen en el PDF sin conexión. Para cada una se genera con una plantilla que
 * la usa en títulos y cuerpo y se comprueba, con Chrome real, que quedó cargada antes de exportar (`document.fonts`)
 * y que la página de impresión no pidió nada fuera de este equipo (las peticiones externas se bloquean y se cuentan).
 */

let h: Harness;
const external: string[] = [];

/** Se evalúa en la página de impresión, con las fuentes ya cargadas (`__printReady`). */
const MEASURE = `(() => {
  const family = (f) => f.replace(/["']/g, '').trim();
  return {
    loaded: Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => family(f.family)),
    used: Array.from(new Set(Array.from(document.querySelectorAll('.tpl-text')).map((e) => family(getComputedStyle(e).fontFamily.split(',')[0])))),
    checks: Object.fromEntries(${JSON.stringify(Object.values(FONT_LABELS))}.map((name) => [name, document.fonts.check('700 20px "' + name + '"')])),
  };
})()`;

beforeAll(async () => {
  h = await startHarness({
    categories: [{ id: 'c1', name: 'RAMEN' }],
    items: (url) => [
      { id: '1', name: 'Fideos', description: 'Ricos', status: 'active', price: 9000, category: { id: 'c1', name: 'RAMEN' }, images: [`${url}/img/ok.png`] },
    ],
  });
  h.renderer.prepare = async (page) => {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const { protocol, hostname } = new URL(req.url());
      if (protocol.startsWith('http') && hostname !== '127.0.0.1' && hostname !== 'localhost') {
        external.push(req.url());
        void req.abort();
      } else {
        void req.continue();
      }
    });
  };
  await h.save((ws) => ({
    templates: [
      ...ws.templates,
      ...FONT_KEYS.map((key) => {
        const t = copyOf(baseTemplate('neon'), `f${key}`, `Fuente ${key}`);
        t.fonts = { title: key, body: key };
        return t;
      }),
    ],
  }));
}, 180_000);

afterAll(async () => {
  await h?.close();
});

describe.each(FONT_KEYS)('familia %s', (key: FontKey) => {
  it('queda cargada antes de exportar y no se pide a internet', async () => {
    const name = FONT_LABELS[key];
    const before = external.length;
    const r = await h.generate({ prepare: { templateId: `f${key}`, sectionKeys: ['alegra:c1'] }, measure: MEASURE });
    const m = r.measure as { loaded: string[]; used: string[]; checks: Record<string, boolean> };
    expect(r.payload.template.id).toBe(`f${key}`);
    expect(m.used, 'el texto de las páginas usa la familia').toContain(name);
    expect(m.loaded, 'la tipografía se cargó con `document.fonts`').toContain(name);
    expect(m.checks[name], '`document.fonts.check` confirma la tipografía').toBe(true);
    expect(external.slice(before), 'ninguna petición fuera de este equipo').toEqual([]);
    expect(r.pdfPages).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
