import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BASE_IDS,
  FONT_LABELS,
  PAGE_H,
  PAGE_W,
  TEXT_DEFAULTS,
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
  /** Del cuerpo del texto, en px (feature 007). */
  fontSize: number | null;
  lineHeight: number | null;
  decoration: string | null;
  bodyH: number | null;
  /** Distancia del cuerpo del texto al borde superior de su caja, en px lógicos (feature 008). */
  bodyTop: number | null;
  letterSpacing: string | null;
  /** Sombra y fondo del texto (feature 011): `text-shadow` del cuerpo, color del <span> de fondo y cuántas líneas dibuja. */
  textShadow: string | null;
  spanBg: string | null;
  spanLines: number | null;
  spanBox: { left: number; right: number } | null;
  /** Formato y curvar (feature 012). */
  fontStyle: string | null;
  textAlign: string | null;
  rows: number | null;
  isCurve: boolean;
  curveBox: { left: number; right: number; top: number; bottom: number } | null;
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
        fontSize: bcs ? parseFloat(bcs.fontSize) : null, lineHeight: bcs ? parseFloat(bcs.lineHeight) : null,
        decoration: bcs ? bcs.textDecorationLine : null, bodyH: body ? body.offsetHeight : null,
        bodyTop: body ? ((body.getBoundingClientRect().top - el.getBoundingClientRect().top) / el.getBoundingClientRect().height) * el.offsetHeight : null,
        letterSpacing: bcs ? bcs.letterSpacing : null,
        textShadow: bcs ? bcs.textShadow : null,
        spanBg: body && body.querySelector('span') ? getComputedStyle(body.querySelector('span')).backgroundColor : null,
        fontStyle: bcs ? bcs.fontStyle : null,
        textAlign: bcs ? bcs.textAlign : null,
        rows: body ? body.children.length : null,
        isCurve: !!body && body.tagName.toLowerCase() === 'svg',
        curveBox: body && body.tagName.toLowerCase() === 'svg' ? (() => { const b = body.querySelector('text').getBoundingClientRect(), t = el.getBoundingClientRect(), k = el.offsetWidth / t.width; return { left: (b.left - t.left) * k, right: (b.right - t.left) * k, top: (b.top - t.top) * k, bottom: (b.bottom - t.top) * k }; })() : null,
        spanLines: body && body.querySelector('span') ? body.querySelector('span').getClientRects().length : null,
        spanBox: body && body.querySelector('span') ? (() => { const b = body.querySelector('span').getBoundingClientRect(), t = el.getBoundingClientRect(); return { left: (b.left - t.left) / t.width * el.offsetWidth, right: (b.right - t.left) / t.width * el.offsetWidth }; })() : null,
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
      // Un texto curvo es un SVG: su color y su tipografía son atributos del SVG y se comprueban aparte (feature 012)
      const curved = el.type === 'text' && !!el.curve;
      if ((el.type === 'text' || el.type === 'badge') && !curved) {
        const colorRef = el.color;
        // «Sin relleno» deja el relleno transparente
        expect(m.color, `${at} color`).toBe(el.type === 'text' && el.hollow ? 'rgba(0, 0, 0, 0)' : rgb(resolveColor(t.palette, colorRef)));
        const key: FontKey = el.font === 'title' ? t.fonts.title : el.font === 'body' ? t.fonts.body : el.font;
        expect(familyOf(m.fontFamily!), `${at} fuente`).toBe(FONT_LABELS[key]);
      }
      if (el.type === 'text' && !curved) {
        // Altura de línea y tachado (feature 007): sin los campos, los valores de siempre
        expect(m.lineHeight! / m.fontSize!, `${at} altura de línea`).toBeCloseTo(el.lh ?? TEXT_DEFAULTS.lh, 2);
        const lines = [el.underline ? 'underline' : '', (el.strike ?? TEXT_DEFAULTS.strike) ? 'line-through' : ''].filter(Boolean).join(' ');
        expect(m.decoration, `${at} subrayado y tachado`).toBe(lines || 'none');
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

describe('altura de línea y tachado (feature 007, FR-013, SC-004)', () => {
  it('un texto de tres líneas con lh 1.6 y tachado se dibuja igual que su documento', async () => {
    const t = copyOf(baseTemplate('neon'), 'tlh', 'Neón con promoción');
    t.pages.portada.els.push({
      ...draftText({ text: 'Línea uno\nLínea dos\nLínea tres', size: 20, lh: 1.6, strike: true, x: 10, y: 60, w: 80, h: 20 }),
      id: 'promo',
    });
    await h.save((ws) => ({ templates: [...ws.templates, t] }));
    const r = await h.generate({ prepare: { templateId: 'tlh' } });
    const measure = r.measure as Measure;
    expectMatchesDocument(r.payload.template, measure);
    const promo = measure.pages.find((p) => p.key === 'portada')!.els.find((e) => e.id === 'promo')!;
    expect(promo.lineHeight).toBeCloseTo(32, 1); // 20 px × 1.6
    expect(promo.decoration).toBe('line-through');
    // tres líneas exactas: el alto del texto es 3 × la altura de línea
    expect(promo.bodyH! / promo.lineHeight!).toBeCloseTo(3, 1);
  }, 120_000);
});

describe('altura de línea ampliada (feature 008, US1, SC-003)', () => {
  it.each([0.5, 1.37, 2.5])('un texto de tres líneas con lh %s corta igual en el lienzo y en el PDF y cabe en su caja', async (lh) => {
    const id = `tlh008-${String(lh).replace('.', '_')}`;
    const t = copyOf(baseTemplate('neon'), id, `Neón lh ${lh}`);
    t.pages.portada.els.push({
      ...draftText({ text: 'Línea uno\nLínea dos\nLínea tres', size: 20, lh, x: 10, y: 55, w: 80, h: 30 }),
      id: 'tres',
    });
    await h.save((ws) => ({ templates: [...ws.templates, t] }));
    const r = await h.generate({ prepare: { templateId: id } });
    const measure = r.measure as Measure;
    expectMatchesDocument(r.payload.template, measure);
    const el = measure.pages.find((p) => p.key === 'portada')!.els.find((e) => e.id === 'tres')!;
    expect(el.lineHeight! / el.fontSize!).toBeCloseTo(lh, 2);
    // tres líneas exactas, como en el lienzo
    expect(el.bodyH! / el.lineHeight!).toBeCloseTo(3, 1);
    expect(el.bodyH!).toBeLessThanOrEqual(el.h + 1);
  }, 120_000);
});

describe('espaciado entre letras ampliado (feature 008, US2, SC-003)', () => {
  it.each([-10, 0, 33.3, 60])('un título con espaciado %s px se dibuja con ese espaciado, con tres líneas exactas y dentro de su caja', async (ls) => {
    const id = `tls008-${String(ls).replace('.', '_').replace('-', 'm')}`;
    const t = copyOf(baseTemplate('neon'), id, `Neón ls ${ls}`);
    t.pages.portada.els.push({
      ...draftText({ text: 'Uno\nDos\nTres', size: 20, ls, x: 5, y: 55, w: 90, h: 30 }),
      id: 'espaciado',
    });
    await h.save((ws) => ({ templates: [...ws.templates, t] }));
    const r = await h.generate({ prepare: { templateId: id } });
    const measure = r.measure as Measure;
    expectMatchesDocument(r.payload.template, measure);
    const el = measure.pages.find((p) => p.key === 'portada')!.els.find((e) => e.id === 'espaciado')!;
    // Chrome devuelve «normal» cuando el espaciado es 0
    expect(el.letterSpacing === 'normal' ? 0 : parseFloat(el.letterSpacing!)).toBeCloseTo(ls, 1);
    expect(el.bodyH! / el.lineHeight!).toBeCloseTo(3, 1);
    expect(el.bodyH!).toBeLessThanOrEqual(el.h + 1);
  }, 120_000);
});

describe('anclaje vertical (feature 008, US3, SC-004)', () => {
  let seq = 0;
  const anchored = async (vAlign: 'top' | 'middle' | 'bottom' | undefined) => {
    const id = `tva008-${vAlign ?? 'none'}-${++seq}`;
    const t = copyOf(baseTemplate('neon'), id, `Neón anclaje ${vAlign ?? 'sin campo'}`);
    t.pages.portada.els.push({
      ...draftText({ text: 'Una línea', size: 20, x: 10, y: 55, w: 80, h: 30, ...(vAlign ? { vAlign } : {}) }),
      id: 'ancla',
    });
    await h.save((ws) => ({ templates: [...ws.templates, t] }));
    const r = await h.generate({ prepare: { templateId: id } });
    const measure = r.measure as Measure;
    expectMatchesDocument(r.payload.template, measure);
    return { r, el: measure.pages.find((p) => p.key === 'portada')!.els.find((e) => e.id === 'ancla')! };
  };

  it('arriba pega el texto al borde superior de la caja (< 0,5 % de su alto)', async () => {
    const { el } = await anchored('top');
    expect(Math.abs(el.bodyTop!)).toBeLessThanOrEqual(0.005 * el.h + 0.5);
  }, 120_000);

  it('abajo pega el texto al borde inferior de la caja (< 0,5 % de su alto)', async () => {
    const { el } = await anchored('bottom');
    expect(Math.abs(el.h - (el.bodyTop! + el.bodyH!))).toBeLessThanOrEqual(0.005 * el.h + 0.5);
  }, 120_000);

  it('centro, y la ausencia del campo, lo dejan centrado como siempre', async () => {
    for (const v of ['middle', undefined] as const) {
      const { el } = await anchored(v);
      expect(Math.abs(el.bodyTop! - (el.h - el.bodyH!) / 2), String(v)).toBeLessThanOrEqual(0.005 * el.h + 0.5);
    }
  }, 180_000);

  it('el anclaje llega al PDF como parte del documento de la plantilla', async () => {
    const { r } = await anchored('bottom');
    const doc = r.payload.template.pages.portada.els.find((e) => e.id === 'ancla');
    expect(doc && doc.type === 'text' && doc.vAlign).toBe('bottom');
  }, 120_000);
});

describe('sombra y fondo del texto (feature 011, FR-009, SC-002)', () => {
  let seq = 0;
  const withEffects = async (over: Parameters<typeof draftText>[0], box = { x: 10, y: 55, w: 80, h: 30 }) => {
    const id = `tfx011-${++seq}`;
    const t = copyOf(baseTemplate('neon'), id, `Neón efectos ${seq}`);
    t.pages.portada.els.push({ ...draftText({ size: 20, ...box, ...over }), id: 'fx' });
    await h.save((ws) => ({ templates: [...ws.templates, t] }));
    const r = await h.generate({ prepare: { templateId: id } });
    const measure = r.measure as Measure;
    expectMatchesDocument(r.payload.template, measure);
    return { r, measure, el: measure.pages.find((p) => p.key === 'portada')!.els.find((e) => e.id === 'fx')! };
  };

  it('la sombra de un texto llega al PDF con su color, su desplazamiento y su desenfoque', async () => {
    const { el } = await withEffects({ text: 'Con sombra', shadow: true, shDist: 8, shAngle: 90, shBlur: 4, shAlpha: 100, shColor: '#112233' });
    expect(el.textShadow).toContain('rgb(17, 34, 51)');
    expect(el.textShadow).toMatch(/0px 8px 4px/);
  }, 120_000);

  it('el fondo de un texto de dos líneas dibuja una caja por línea, con su color, y el texto cabe', async () => {
    const { el } = await withEffects({ text: 'Línea uno\nLínea dos', bg: true, bgColor: '#102030', bgAlpha: 50, bgPad: 6, bgRadius: 4 });
    expect(el.spanBg).toBe('rgba(16, 32, 48, 0.5)');
    expect(el.spanLines).toBe(2);
    expect(el.bodyH! / el.lineHeight!).toBeCloseTo(2, 1);
    expect(el.bodyH!).toBeLessThanOrEqual(el.h + 1);
  }, 120_000);

  it('sombra y fondo a la vez, y sin los efectos el texto no cambia de alto ni de renglones', async () => {
    const plain = await withEffects({ text: 'Línea uno\nLínea dos' });
    const both = await withEffects({ text: 'Línea uno\nLínea dos', shadow: true, bg: true });
    expect(plain.el.spanBg).toBeNull();
    expect(both.el.spanBg).not.toBeNull();
    expect(both.el.bodyH).toBeCloseTo(plain.el.bodyH!, 1);
    expect(both.el.textShadow).not.toBe('none');
  }, 180_000);

  it('un texto con datos insertables largo y con fondo no se sale de su caja ni ensancha la hoja', async () => {
    const { measure, el } = await withEffects({ text: '{tienda} {tienda} {tienda}', bg: true, bgPad: 40 }, { x: 10, y: 55, w: 40, h: 10 });
    expect(el.spanBox!.left).toBeGreaterThanOrEqual(-1);
    expect(el.spanBox!.right).toBeLessThanOrEqual(el.w + 1);
    expect(measure.scrollWidth).toBe(measure.clientWidth);
  }, 120_000);
});

describe('texto estilo Canva (feature 012, FR-014, SC-002)', () => {
  let seq = 0;
  const generated = async (over: Parameters<typeof draftText>[0], box = { x: 10, y: 55, w: 80, h: 30 }) => {
    const id = `tfx012-${++seq}`;
    const t = copyOf(baseTemplate('neon'), id, `Neón estilo ${seq}`);
    t.pages.portada.els.push({ ...draftText({ size: 20, ...box, ...over }), id: 'st' });
    // Una sola plantilla de esta serie a la vez: el conjunto tiene un máximo de plantillas
    await h.save((ws) => ({ templates: [...ws.templates.filter((x) => !x.id.startsWith('tfx012-')), t] }));
    const r = await h.generate({ prepare: { templateId: id } });
    const measure = r.measure as Measure;
    expectMatchesDocument(r.payload.template, measure);
    return { r, measure, el: measure.pages.find((p) => p.key === 'portada')!.els.find((e) => e.id === 'st')! };
  };
  const NL = String.fromCharCode(10);

  it('cursiva, subrayado y justificado llegan al PDF', async () => {
    const { el } = await generated({ text: 'Línea uno' + NL + 'Línea dos', italic: true, underline: true, align: 'justify' });
    expect(el.fontStyle).toBe('italic');
    expect(el.decoration).toBe('underline');
    expect(el.textAlign).toBe('justify');
    expect(el.bodyH! / el.lineHeight!).toBeCloseTo(2, 1);
  }, 120_000);

  it.each([
    ['bullet', '•'],
    ['number', '1.'],
  ] as const)('una lista %s dibuja una fila por renglón y no cambia el número de líneas', async (list, _marca) => {
    const { el } = await generated({ text: 'Uno' + NL + 'Dos' + NL + 'Tres', list });
    expect(el.rows).toBe(3);
    expect(el.bodyH! / el.lineHeight!).toBeCloseTo(3, 1);
    expect(el.bodyH!).toBeLessThanOrEqual(el.h + 1);
  }, 120_000);

  it('una lista en un texto con datos insertables largo cabe en su caja', async () => {
    const { el } = await generated({ text: '{tienda} {tienda} {tienda}', list: 'bullet' }, { x: 10, y: 55, w: 40, h: 10 });
    expect(el.bodyH!).toBeLessThanOrEqual(el.h + 1);
  }, 120_000);

  it.each([
    ['brillo', { bright: true }],
    ['eco', { echo: true }],
    ['desalineado', { misalign: true }],
    ['distorsión', { glitch: true }],
    ['sin relleno', { hollow: true }],
    ['todos a la vez con neón y sombra', { bright: true, echo: true, misalign: true, glitch: true, hollow: true, glow: 'a1', shadow: true, bg: true }],
  ] as const)('el efecto %s llega al PDF y no cambia el número de renglones', async (_n, fx) => {
    const { el } = await generated({ text: 'Línea uno' + NL + 'Línea dos', ...fx });
    expect(el.bodyH! / el.lineHeight!).toBeCloseTo(2, 1);
    if (!('hollow' in fx && Object.keys(fx).length === 1)) expect(el.textShadow).not.toBe('none');
  }, 180_000);

  it.each([60, -60])('curvar %s se dibuja como un SVG dentro de su caja, con su texto y sin ensanchar la hoja', async (curve) => {
    const { measure, el } = await generated({ text: 'Título curvo', curve, size: 24 });
    expect(el.isCurve).toBe(true);
    const box = el.curveBox!;
    expect(box.right - box.left).toBeGreaterThan(20);
    expect(box.left).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(el.w + 1);
    expect(measure.scrollWidth).toBe(measure.clientWidth);
  }, 120_000);

  it('curvatura 0 se dibuja como un texto recto normal', async () => {
    const { el } = await generated({ text: 'Recto', curve: 0 });
    expect(el.isCurve).toBe(false);
  }, 120_000);
});
