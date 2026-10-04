import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BASE_IDS,
  FONT_LABELS,
  PAGE_H,
  PAGE_W,
  resolveColor,
  type FontKey,
  type PageElement,
  type PageKey,
  type Template,
} from '../../src/catalog/template';
import { baseTemplate, draftText } from '../../src/catalog/template-presets';
import { PNG, copyOf, startHarness, type Harness } from '../fixtures/pdf-harness';

/**
 * Fidelidad editor ↔ PDF (FR-028, SC-002, principio IV): el editor y el PDF dibujan con el mismo componente, así que
 * cada elemento visible de la vista de impresión debe coincidir con el documento de la plantilla: posición y tamaño
 * (1 % de la hoja o menos), colores, tipografía, opacidad, rotación y orden de apilado. Se mide en Chrome real.
 */

interface Measured {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: string;
  rot: number;
  color: string | null;
  bg: string | null;
  fontFamily: string | null;
}
interface PageMeasure {
  key: PageKey;
  w: number;
  h: number;
  els: Measured[];
  footer: string | null;
}
interface Measure {
  pages: PageMeasure[];
  scrollWidth: number;
  clientWidth: number;
}

const MEASURE = `(() => {
  const keyOf = { 'cover-page': 'portada', 'section-cover': 'seccion', 'catalog-page': 'productos', 'terms-page': 'politicas' };
  const pages = [];
  document.querySelectorAll('.a4-page').forEach((sheet) => {
    const tpl = sheet.querySelector('.tpl-page');
    const els = [];
    tpl.querySelectorAll('[data-el-id]').forEach((el) => {
      const cs = getComputedStyle(el);
      const body = el.querySelector('.tpl-text, .tpl-badge-text, .tpl-shape');
      const bcs = body ? getComputedStyle(body) : null;
      const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
      els.push({
        id: el.getAttribute('data-el-id'), type: el.getAttribute('data-el-type'),
        x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
        opacity: cs.opacity, rot: (Math.atan2(m.b, m.a) * 180) / Math.PI,
        color: bcs ? bcs.color : null, bg: bcs ? bcs.backgroundColor : null, fontFamily: bcs ? bcs.fontFamily : null,
      });
    });
    const footer = sheet.querySelector('[data-testid=page-footer]');
    pages.push({ key: keyOf[sheet.getAttribute('data-testid')], w: tpl.offsetWidth, h: tpl.offsetHeight, els, footer: footer ? footer.textContent : null });
  });
  return { pages, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
})()`;

const rgb = (color: string): string => {
  if (color === 'transparent') return 'rgba(0, 0, 0, 0)';
  const n = parseInt(color.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const familyOf = (css: string) => css.replace(/["']/g, '').split(',')[0]!.trim();

let h: Harness;

beforeAll(async () => {
  h = await startHarness({
    categories: [{ id: 'c1', name: 'RAMEN' }],
    items: (url) => [1, 2, 3, 4].map((i) => ({
      id: String(i),
      name: `Producto ${i}`,
      description: `Descripción ${i}`,
      status: 'active',
      price: 9000,
      category: { id: 'c1', name: 'RAMEN' },
      images: [`${url}/img/ok.png`],
      ...(i === 2 ? { inventory: { availableQuantity: 0, trackInventory: true } } : {}),
    })),
    seed: async (agent) => {
      const section = (await agent.post('/api/sections/custom').send({ name: 'MOCHIS', introText: '¿Qué es el mochi?\nPostre japonés.' }).expect(201)).body;
      const product = (await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Caja de mochis', description: 'Rellenos', price: 30000 }).expect(201)).body;
      await agent.put(`/api/custom-products/${product.id}/image`).attach('image', PNG, 'p.png').expect(200);
    },
    measure: MEASURE,
  });
}, 180_000);

afterAll(async () => {
  await h?.close();
});

/** Compara cada elemento medido con el documento de la plantilla. */
function expectMatchesDocument(t: Template, measure: Measure) {
  const tolX = 0.01 * PAGE_W;
  const tolY = 0.01 * PAGE_H;
  expect(measure.pages.length).toBeGreaterThan(0);
  for (const page of measure.pages) {
    const where = `${t.id}/${page.key}`;
    // La hoja lógica mide 595,28 × 841,89 px
    expect(Math.abs(page.w - PAGE_W), where).toBeLessThanOrEqual(1);
    expect(Math.abs(page.h - PAGE_H), where).toBeLessThanOrEqual(1);

    const model = t.pages[page.key].els.filter((e) => e.visible !== false);
    // Orden de apilado: lo medido es una subsecuencia del modelo (la introducción puede faltar si la sección no la tiene)
    const modelIds = model.map((e) => e.id);
    const measuredIds = page.els.map((e) => e.id);
    expect(measuredIds, where).toEqual(modelIds.filter((id) => measuredIds.includes(id)));
    // Todo elemento visible aparece, salvo la introducción de una sección sin texto
    for (const el of model) {
      if (el.type === 'intro') continue;
      expect(measuredIds, `${where}/${el.id} falta`).toContain(el.id);
    }

    for (const m of page.els) {
      const el = model.find((e) => e.id === m.id) as PageElement;
      const at = `${where}/${m.id}`;
      expect(m.type, at).toBe(el.type);
      expect(Math.abs(m.x - (el.x / 100) * PAGE_W), `${at} x`).toBeLessThanOrEqual(tolX);
      expect(Math.abs(m.y - (el.y / 100) * PAGE_H), `${at} y`).toBeLessThanOrEqual(tolY);
      expect(Math.abs(m.w - (el.w / 100) * PAGE_W), `${at} ancho`).toBeLessThanOrEqual(tolX);
      expect(Math.abs(m.h - (el.h / 100) * PAGE_H), `${at} alto`).toBeLessThanOrEqual(tolY);
      expect(Math.abs(m.rot - (el.rot || 0)), `${at} rotación`).toBeLessThanOrEqual(0.5);
      expect(Number(m.opacity), `${at} opacidad`).toBeCloseTo(el.opacity, 2);
      if (el.type === 'text' || el.type === 'badge') {
        const colorRef = el.color;
        expect(m.color, `${at} color`).toBe(rgb(resolveColor(t.palette, colorRef)));
        const key: FontKey = el.font === 'title' ? t.fonts.title : el.font === 'body' ? t.fonts.body : el.font;
        expect(familyOf(m.fontFamily!), `${at} fuente`).toBe(FONT_LABELS[key]);
      }
      if (el.type === 'shape') {
        expect(m.bg, `${at} relleno`).toBe(rgb(resolveColor(t.palette, el.fill)));
      }
    }
  }
}

describe('el PDF dibuja cada plantilla base como su documento', () => {
  it.each(BASE_IDS)('%s: posición, tamaño, colores, tipografía, opacidad, rotación y orden', async (id) => {
    const r = await h.generate({ prepare: { templateId: id } });
    const t = r.payload.template;
    expect(t.id).toBe(id);
    const measure = r.measure as Measure;
    // las cuatro páginas de la plantilla aparecen en el documento
    expect([...new Set(measure.pages.map((p) => p.key))].sort()).toEqual(['politicas', 'portada', 'productos', 'seccion']);
    expectMatchesDocument(t, measure);
  }, 120_000);

  it.each(BASE_IDS)('%s: las páginas del PDF coinciden con la estructura y el pie lleva teléfonos y dirección (SC-010)', async (id) => {
    const r = await h.generate({ prepare: { templateId: id } });
    expect(r.pdfPages).toBe(r.structure.totalPages);
    expect((r.measure as Measure).pages.length).toBe(r.structure.totalPages);
    // pie de cada página de productos y de políticas
    const footers = (r.measure as Measure).pages.filter((p) => p.key === 'productos' || p.key === 'politicas');
    expect(footers.length).toBe(r.structure.productPages + r.structure.termsPages);
    for (const p of footers) {
      expect(p.footer, `${id}/${p.key}`).toContain('310 669 0585');
      expect(p.footer).toContain('318 807 0709');
      expect(p.footer).toContain('Cra 10 # 18-15 centro');
    }
    const withAddress = r.pageTexts.filter((t) => t.includes('Cra 10 # 18-15'));
    expect(withAddress.length).toBe(footers.length);
    // las portadas no llevan pie
    expect((r.measure as Measure).pages.filter((p) => p.key === 'portada' || p.key === 'seccion').every((p) => p.footer === null)).toBe(true);
  }, 120_000);
});

describe('elementos ocultos, girados y fuera de la hoja', () => {
  let custom: Template;
  let baselineWidth: number;

  beforeAll(async () => {
    baselineWidth = ((await h.generate({ prepare: { templateId: 'pop' } })).measure as Measure).scrollWidth;
    custom = copyOf(baseTemplate('pop'), 'tcustom', 'Pop con extras');
    custom.pages.portada.els.push(
      { ...draftText({ text: 'No se ve', x: 10, y: 50, w: 40, h: 5 }), id: 'oculto', visible: false },
      { ...draftText({ text: 'Asoma por la izquierda', x: -20, y: 90, w: 60, h: 5 }), id: 'izquierda' },
      { ...draftText({ text: 'Asoma por la derecha y por abajo', x: 80, y: 97, w: 40, h: 12 }), id: 'derecha' },
      { ...draftText({ text: 'Girado', x: 30, y: 60, w: 40, h: 6, rot: 25, opacity: 0.5, color: '#336699' }), id: 'girado' },
    );
    await h.save((ws) => ({ templates: [...ws.templates, custom] }));
  }, 120_000);

  it('un elemento oculto no existe en el DOM, y los girados y semitransparentes coinciden con el documento', async () => {
    const r = await h.generate({ prepare: { templateId: 'tcustom' } });
    const measure = r.measure as Measure;
    const portada = measure.pages.find((p) => p.key === 'portada')!;
    expect(portada.els.some((e) => e.id === 'oculto')).toBe(false);
    const girado = portada.els.find((e) => e.id === 'girado')!;
    expect(girado.rot).toBeCloseTo(25, 0);
    expect(Number(girado.opacity)).toBeCloseTo(0.5, 2);
    expect(girado.color).toBe('rgb(51, 102, 153)');
    expectMatchesDocument(r.payload.template, measure);
    expect(r.payload.template.pages.portada.els.some((e) => e.id === 'oculto')).toBe(true); // sigue en el documento
  }, 120_000);

  it('un elemento que sale de la hoja se recorta: no agranda el documento ni crea páginas', async () => {
    const r = await h.generate({ prepare: { templateId: 'tcustom' } });
    const measure = r.measure as Measure;
    const portada = measure.pages.find((p) => p.key === 'portada')!;
    const left = portada.els.find((e) => e.id === 'izquierda')!;
    expect(left.x).toBeLessThan(0);
    expect(left.w).toBeCloseTo(0.6 * PAGE_W, 0); // su tamaño no cambia por salirse
    expect(measure.scrollWidth).toBe(baselineWidth);
    expect(measure.scrollWidth).toBe(measure.clientWidth);
    expect(r.pdfPages).toBe(r.structure.totalPages);
  }, 120_000);
});
