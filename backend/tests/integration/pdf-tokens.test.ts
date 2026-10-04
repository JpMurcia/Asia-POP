import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PageKey, TextEl } from '../../src/catalog/template';
import { PAGE_KEYS } from '../../src/catalog/template';
import { baseTemplate, draftText } from '../../src/catalog/template-presets';
import { PNG, copyOf, startHarness, type Harness } from '../fixtures/pdf-harness';

/**
 * FR-024: los marcadores `{banner}`, `{seccion}`, `{telefonos}`, `{direccion}` y `{tienda}` salen con el dato real en
 * el PDF. Cada página de la plantilla de prueba lleva un texto por marcador (más uno desconocido), y `pdf-parse` lee
 * el texto real del PDF.
 */

const TOKENS = ['banner', 'seccion', 'telefonos', 'direccion', 'tienda', 'desconocido'] as const;
const LETTER = { banner: 'B', seccion: 'S', telefonos: 'T', direccion: 'D', tienda: 'N', desconocido: 'X' } as const;
const label = (t: (typeof TOKENS)[number]) => `[${LETTER[t]}:{${t}}]`;

let h: Harness;
let savedBanner = '';
let phones = '';

beforeAll(async () => {
  h = await startHarness({
    categories: [{ id: 'c1', name: 'RAMEN' }],
    items: (url) => [
      { id: '1', name: 'Fideos', description: 'Ricos', status: 'active', price: 9000, category: { id: 'c1', name: 'RAMEN' }, images: [`${url}/img/ok.png`] },
    ],
  });
  await h.save((ws) => {
    const t = copyOf(baseTemplate('neon'), 'tmarcadores', 'Marcadores');
    for (const key of PAGE_KEYS as readonly PageKey[]) {
      const tokens: TextEl[] = TOKENS.map((tok, i) => ({
        ...draftText({ text: label(tok), size: 11, font: 'body', color: '#000000', x: 5, y: 2 + i * 3.2, w: 90, h: 3, align: 'left' }),
        id: `tok-${key}-${tok}`,
      }));
      t.pages[key].els.push(...tokens);
    }
    return { templates: [...ws.templates, t] };
  });
  const business = (await h.workspace()).business;
  savedBanner = business.coverTitle;
  phones = [business.phone1, business.phone2].join(' · ');
}, 180_000);

afterAll(async () => {
  await h?.close();
});

/** Páginas del PDF de una sección: portada, portada de sección, productos y políticas. */
async function generate(prepare: object = {}) {
  const r = await h.generate({ prepare: { templateId: 'tmarcadores', sectionKeys: ['alegra:c1'], ...prepare } });
  expect(r.pdfPages).toBe(4);
  return r;
}

describe('marcadores en el PDF', () => {
  it('{telefonos}, {direccion} y {tienda} salen con el dato real en cada página', async () => {
    const business = (await h.workspace()).business;
    const r = await generate();
    for (const [i, page] of r.pageTexts.entries()) {
      expect(page, `página ${i + 1}`).toContain(`[T:${phones}]`);
      expect(page).toContain(`[D:${business.address}]`);
      expect(page).toContain(`[N:${business.storeName}]`);
    }
  }, 120_000);

  it('{banner} usa el texto guardado y, con `bannerText`, el de esa generación sin cambiar lo guardado', async () => {
    const normal = await generate();
    expect(normal.pageTexts[0]).toContain(`[B:${savedBanner}]`);

    const custom = await generate({ bannerText: 'Oferta de otoño' });
    for (const page of custom.pageTexts) expect(page).toContain('[B:Oferta de otoño]');
    expect(custom.pageTexts.join(' ')).not.toContain(`[B:${savedBanner}]`);
    expect((await h.workspace()).business.coverTitle, 'lo guardado no cambió').toBe(savedBanner);
    expect((await h.agent.get('/api/settings/business')).body.coverTitle).toBe(savedBanner);
  }, 120_000);

  it('{seccion} muestra el nombre de la sección en sus páginas y queda vacío en portada y políticas', async () => {
    const r = await generate();
    expect(r.pageTexts[0], 'portada').toContain('[S:]');
    expect(r.pageTexts[1], 'portada de sección').toContain('[S:RAMEN]');
    expect(r.pageTexts[2], 'productos').toContain('[S:RAMEN]');
    expect(r.pageTexts[3], 'políticas').toContain('[S:]');
  }, 120_000);

  it('cada sección usa su propio nombre', async () => {
    const section = (await h.agent.post('/api/sections/custom').send({ name: 'MOCHIS' }).expect(201)).body;
    const product = (
      await h.agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Caja de mochis', description: 'Rellenos', price: 30000 }).expect(201)
    ).body;
    await h.agent.put(`/api/custom-products/${product.id}/image`).attach('image', PNG, 'p.png').expect(200);
    const sections = await h.sections();
    const own = sections.find((s) => s.name === 'MOCHIS')!;
    const r = await h.generate({ prepare: { templateId: 'tmarcadores', sectionKeys: ['alegra:c1', own.key] } });
    const text = r.pageTexts.join('\n');
    expect(text).toContain('[S:RAMEN]');
    expect(text).toContain('[S:MOCHIS]');
  }, 120_000);

  it('un marcador desconocido queda literal', async () => {
    const r = await generate();
    for (const page of r.pageTexts) expect(page).toContain('[X:{desconocido}]');
  }, 120_000);

  it('un dato vacío no deja residuo: sin segundo teléfono, {telefonos} muestra solo el primero', async () => {
    const ws = await h.workspace();
    await h.save(() => ({ business: { ...ws.business, phone2: '' } }));
    const r = await generate();
    expect(r.pageTexts[0]).toContain(`[T:${ws.business.phone1}]`);
    expect(r.pageTexts[0]).not.toContain(ws.business.phone2);
    await h.save(() => ({ business: ws.business })); // se deja como estaba
  }, 120_000);
});
