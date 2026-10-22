import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BASE_IDS, type ProductsEl, type Template } from '../../src/catalog/template';
import { PNG, startHarness, text, type Harness } from '../fixtures/pdf-harness';

/**
 * Prueba de desbordamiento (FR-031 / SC-006): `pdf-parse` no detecta texto recortado, así que se abre la vista de
 * impresión en un navegador real con textos en el máximo permitido y se mide el DOM, con cada una de las cuatro
 * plantillas base. El mínimo de 6 pt debe bastar: ningún elemento puede quedar marcado con `data-overflow`.
 */

interface Finding {
  selector: string;
  page: string | null;
  text: string;
  detail?: string;
}
interface Inspection {
  overflow: Finding[];
  outside: Finding[];
  overlaps: string[];
  marked: Finding[];
  pages: number;
}

/** Función evaluada dentro de la página de impresión. */
const MEASURE = `(() => {
  const out = { overflow: [], outside: [], overlaps: [], marked: [], pages: document.querySelectorAll('.a4-page').length };
  const short = (el) => (el.textContent || '').trim().slice(0, 40);
  const pageOf = (el) => { const s = el.closest('.a4-page'); return s ? s.getAttribute('data-testid') : null; };
  // Límite de altura: el max-height calculado (px o %) o, si no tiene, la altura de la caja
  const limit = (el) => {
    const raw = getComputedStyle(el).maxHeight;
    if (raw.endsWith('%')) return el.offsetParent ? (el.offsetParent.clientHeight * parseFloat(raw)) / 100 : el.clientHeight;
    const px = parseFloat(raw);
    return Number.isFinite(px) ? px : el.clientHeight;
  };
  const rect = (el) => el.getBoundingClientRect();
  const hit = (a, b) => !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 || a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);
  // El texto (no la caja) de un elemento
  const textRect = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };

  // 1) Ningún bloque ni texto ajustable desborda su caja
  for (const sel of ['[data-part="bubble"]', '[data-part="terms-body"]', '[data-part="intro"]', '[data-part="footer"]', '[data-fit="true"]']) {
    document.querySelectorAll(sel).forEach((el) => {
      if (el.scrollHeight > limit(el) + 1) {
        out.overflow.push({ selector: sel, page: pageOf(el), text: short(el), detail: 'alto ' + el.scrollHeight + ' > ' + limit(el) + ', fit ' + el.style.getPropertyValue('--fit') });
      }
      if (sel === '[data-fit="true"]' && el.scrollWidth > el.clientWidth + 1) {
        out.overflow.push({ selector: sel + ' (ancho)', page: pageOf(el), text: short(el), detail: 'ancho ' + el.scrollWidth + ' > ' + el.clientWidth });
      }
    });
  }

  // 2) Nada marcado como "no cabe ni con el mínimo"
  document.querySelectorAll('[data-overflow="true"]').forEach((el) => out.marked.push({ selector: el.className, page: pageOf(el), text: short(el) }));

  // 3) Nada se dibuja fuera de la hoja
  document.querySelectorAll('.a4-page').forEach((sheet) => {
    const s = rect(sheet);
    const inside = (r) => r.left >= s.left - 1 && r.right <= s.right + 1 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1;
    sheet.querySelectorAll('[data-fit="true"]').forEach((el) => {
      if (!inside(textRect(el))) out.outside.push({ selector: 'texto', page: pageOf(el), text: short(el) });
    });
    sheet.querySelectorAll('[data-part]').forEach((el) => {
      if (!inside(rect(el))) out.outside.push({ selector: el.getAttribute('data-part'), page: pageOf(el), text: short(el) });
    });
  });

  // 4) Los textos largos no se pisan con el logo, el collage, el pie ni la introducción
  document.querySelectorAll('.a4-page').forEach((sheet) => {
    const page = pageOf(sheet) || '';
    const footer = sheet.querySelector('[data-part="footer"]');
    sheet.querySelectorAll('[data-part="photo"], [data-part="bubble"], [data-part="price"], [data-part="terms-body"], [data-part="intro"]').forEach((el) => {
      if (footer && hit(rect(el), rect(footer))) out.overlaps.push(page + ': ' + el.getAttribute('data-part') + ' / pie');
    });
    const images = sheet.querySelectorAll('img[data-src="logo"], img[data-src="collage"]');
    const intro = sheet.querySelector('[data-part="intro"]');
    sheet.querySelectorAll('[data-fit="true"]').forEach((el) => {
      const t = textRect(el);
      images.forEach((img) => { if (hit(t, rect(img))) out.overlaps.push(page + ': "' + short(el) + '" / ' + img.getAttribute('data-src')); });
      if (intro && hit(t, rect(intro))) out.overlaps.push(page + ': "' + short(el) + '" / introducción');
    });
    // La burbuja de texto no debe pisar la etiqueta de precio de su fila
    sheet.querySelectorAll('[data-testid="product-card"]').forEach((row) => {
      const b = row.querySelector('[data-part="bubble"]'), p = row.querySelector('[data-part="price"]');
      if (b && p && hit(rect(b), rect(p))) out.overlaps.push(page + ': burbuja / precio');
    });
  });

  // 5) Los bloques de la burbuja no deben encogerse (se colapsarían en vez de ajustar la letra)
  document.querySelectorAll('[data-part="bubble"] > *').forEach((el) => {
    if (getComputedStyle(el).flexShrink !== '0') out.overlaps.push('bloque de burbuja que se encoge: ' + el.className);
  });
  return out;
})()`;

let h: Harness;
const LONG_CATEGORY = 'CATEGORÍA DE ALEGRA CON UN NOMBRE EXCESIVAMENTE LARGO PARA EL TÍTULO';

beforeAll(async () => {
  h = await startHarness({
    categories: [
      { id: 'c1', name: 'RAMEN' },
      { id: 'c2', name: LONG_CATEGORY },
    ],
    items: (url) => {
      const base = { status: 'active', price: 9000, images: [`${url}/img/ok.png`], category: { id: 'c1', name: 'RAMEN' } };
      return [
        // Nombre y descripción larguísimos
        { ...base, id: '1', name: text(120, 'Nombre'), description: text(2000, 'descripción') },
        // Sin descripción: la tarjeta muestra el nombre, que es larguísimo
        { ...base, id: '2', name: text(120, 'Fideos'), description: '' },
        { ...base, id: '3', name: 'Producto 3', description: 'Descripción corta 3', inventory: { availableQuantity: 0, trackInventory: true } },
        { ...base, id: '4', name: 'Snack', description: text(600, 'snack'), category: { id: 'c2', name: LONG_CATEGORY } },
      ];
    },
    seed: async (agent) => {
      // Negocio: dirección de 160 caracteres, banner de 80 y 10 políticas que suman 3500 caracteres
      await agent
        .put('/api/settings/business')
        .send({
          storeName: 'ASIANPOP MARKET+',
          coverTitle: text(80, 'Banner'),
          phone1: '310 669 0585',
          phone2: '318 807 0709',
          address: text(160, 'Dirección'),
          terms: Array.from({ length: 10 }, (_, i) => ({ title: text(80, `Política${i + 1}`), body: text(350, 'condición') })),
        })
        .expect(200);
      // Sección propia: nombre de 60 caracteres, introducción de 800 y productos con textos y opciones largos
      const section = (await agent.post('/api/sections/custom').send({ name: text(60, 'SECCIÓN').toUpperCase(), introText: text(800, 'introducción') }).expect(201)).body;
      const product = (
        await agent
          .post('/api/custom-products')
          .send({
            sectionId: section.id,
            name: text(120, 'Mochi'),
            description: text(600, 'relleno'),
            price: null,
            options: Array.from({ length: 4 }, (_, i) => ({ label: text(80, `Caja${i + 1}`), price: 30000 + i, maxFlavors: 6 })),
            flavors: Array.from({ length: 12 }, (_, i) => text(60, `SABOR${i + 1}`)),
          })
          .expect(201)
      ).body;
      await agent.put(`/api/custom-products/${product.id}/image`).attach('image', PNG, 'p.png').expect(200);
      const bundle = (
        await agent
          .post('/api/bundles')
          .send({
            sectionId: section.id,
            name: text(100, 'Combo'),
            description: text(500, 'regalo'),
            pricing: { type: 'discount', percent: 10 },
            components: [
              { source: 'alegra', productId: '1', quantity: 2 },
              { source: 'alegra', productId: '2', quantity: 1 },
              { source: 'alegra', productId: '3', quantity: 3 },
              { source: 'custom', productId: product.id, quantity: 1 },
            ],
          })
          .expect(201)
      ).body;
      await agent.put(`/api/bundles/${bundle.id}/image`).attach('image', PNG, 'b.png').expect(200);
    },
    measure: MEASURE,
  });
}, 240_000);

afterAll(async () => {
  await h?.close();
});

describe.each(BASE_IDS)('textos extremos en el PDF con la plantilla %s (FR-031, SC-006)', (id) => {
  let r: Awaited<ReturnType<Harness['generate']>>;
  let inspection: Inspection;

  beforeAll(async () => {
    r = await h.generate({ prepare: { templateId: id, bannerText: text(80, 'Oferta') } });
    inspection = r.measure as Inspection;
  }, 240_000);

  it('se midió la vista de impresión completa', () => {
    expect(inspection).toBeDefined();
    expect(inspection.pages).toBe(r.structure.totalPages);
  });

  it('ningún bloque de texto desborda su caja', () => {
    expect(inspection.overflow, JSON.stringify(inspection.overflow, null, 2)).toEqual([]);
  });

  it('ningún elemento queda marcado: el mínimo de 6 pt basta (data-overflow)', () => {
    expect(inspection.marked, JSON.stringify(inspection.marked, null, 2)).toEqual([]);
  });

  it('nada se dibuja fuera de la hoja', () => {
    expect(inspection.outside, JSON.stringify(inspection.outside, null, 2)).toEqual([]);
  });

  it('los textos largos no se pisan entre sí ni con el pie, el logo, el collage o la introducción', () => {
    expect(inspection.overlaps, JSON.stringify(inspection.overlaps, null, 2)).toEqual([]);
  });

  it('el número de páginas no cambia por los textos largos', () => {
    expect(r.pdfPages).toBe(r.structure.totalPages);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Feature 007: nombre en su propio rótulo, opciones que se parten y aviso de textos que no caben
// ---------------------------------------------------------------------------------------------------------------

interface NamesInspection {
  cards: number;
  names: number;
  nameBox: string[];
  nameOutside: string[];
  nameOverlaps: string[];
  optionCut: string[];
  marked: { item: string | null; part: string | null; clipped: boolean; overflow: boolean }[];
  reported: { item: string; part: string }[];
}

/** Función evaluada en la vista de impresión: mide el rótulo del nombre, las opciones y las marcas de `useFit`. */
const MEASURE_NAMES = `(() => {
  const out = { cards: 0, names: 0, nameBox: [], nameOutside: [], nameOverlaps: [], optionCut: [], marked: [], reported: window.__printTextOverflow || [] };
  const rect = (el) => el.getBoundingClientRect();
  const hit = (a, b) => !(a.right <= b.left + 0.5 || a.left >= b.right - 0.5 || a.bottom <= b.top + 0.5 || a.top >= b.bottom - 0.5);
  const itemOf = (el) => { const row = el.closest('.pb-row'); return row ? row.getAttribute('data-item-name') : null; };
  out.cards = document.querySelectorAll('[data-testid="product-card"]').length;
  document.querySelectorAll('.a4-page').forEach((sheet) => {
    const s = rect(sheet);
    const footer = sheet.querySelector('[data-part="footer"]');
    sheet.querySelectorAll('[data-part="name"]').forEach((tag) => {
      out.names++;
      const item = itemOf(tag);
      if (tag.scrollHeight > tag.clientHeight + 1) out.nameBox.push(item + ': alto ' + tag.scrollHeight + ' > ' + tag.clientHeight);
      const r = rect(tag);
      if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) out.nameOutside.push(String(item));
      const row = tag.closest('.pb-row');
      for (const part of ['photo', 'bubble', 'price']) {
        const other = row.querySelector('[data-part="' + part + '"]');
        if (other && hit(r, rect(other))) out.nameOverlaps.push(item + ' / ' + part);
      }
      if (footer && hit(r, rect(footer))) out.nameOverlaps.push(item + ' / pie');
      sheet.querySelectorAll('img[data-src="logo"], img[data-src="collage"]').forEach((img) => {
        if (hit(r, rect(img))) out.nameOverlaps.push(item + ' / ' + img.getAttribute('data-src'));
      });
    });
  });
  document.querySelectorAll('.pb-opt-label').forEach((label) => {
    const li = label.closest('li');
    const cut = label.scrollWidth > label.clientWidth + 1 || (li && li.scrollWidth > li.clientWidth + 1) || getComputedStyle(label).textOverflow === 'ellipsis';
    if (cut) out.optionCut.push((label.textContent || '').slice(0, 30));
  });
  document.querySelectorAll('[data-clipped="true"], [data-overflow="true"]').forEach((el) => {
    out.marked.push({ item: itemOf(el), part: el.getAttribute('data-part'), clipped: el.getAttribute('data-clipped') === 'true', overflow: el.getAttribute('data-overflow') === 'true' });
  });
  return out;
})()`;

/** La plantilla con el nombre separado en su bloque de productos (las demás de fábrica ya traen `burbuja`). */
function withSeparatedName(t: Template): Template {
  const copy = structuredClone(t);
  for (const el of copy.pages.productos.els) {
    if (el.type === 'products') Object.assign(el as ProductsEl, { nameStyle: 'separado', nameColor: 'a1', nameFill: 'bg', nameGlow: true });
  }
  return copy;
}

// Base AsianPop no usa el rótulo separado: su nombre va dentro de la foto-tarjeta (feature 010) y se prueba aparte
describe.each(BASE_IDS.filter((id) => id !== 'base'))('nombre separado y texto completo con la plantilla %s, con los textos en el máximo (feature 007)', (id) => {
  let r: Awaited<ReturnType<Harness['generate']>>;
  let m: NamesInspection;

  beforeAll(async () => {
    await h.save((ws) => ({ templates: ws.templates.map((t) => (t.id === id ? withSeparatedName(t) : t)) }));
    r = await h.generate({ prepare: { templateId: id, bannerText: text(80, 'Oferta') }, measure: MEASURE_NAMES });
    m = r.measure as NamesInspection;
  }, 240_000);

  it('cada producto lleva su propio rótulo de nombre', () => {
    expect(m.cards).toBeGreaterThan(0);
    expect(m.names).toBe(m.cards);
  });

  it('ningún rótulo desborda su caja, se sale de la hoja ni pisa la foto, la burbuja, el precio, el pie o el logo', () => {
    expect(m.nameBox, JSON.stringify(m.nameBox)).toEqual([]);
    expect(m.nameOutside, JSON.stringify(m.nameOutside)).toEqual([]);
    expect(m.nameOverlaps, JSON.stringify(m.nameOverlaps)).toEqual([]);
  });

  it('las opciones de precio con etiqueta larga se parten en líneas: ninguna queda cortada con «…»', () => {
    expect(m.optionCut, JSON.stringify(m.optionCut)).toEqual([]);
  });

  it('un nombre de 120 caracteres se ve completo: ningún rótulo queda recortado ni marcado', () => {
    expect(m.marked.filter((x) => x.part === 'name'), JSON.stringify(m.marked)).toEqual([]);
  });

  it('lo que el navegador marcó como recortado es exactamente lo que se informa al terminar la generación', () => {
    const key = (e: { item: string | null; part: string | null }) => `${e.part}\u0000${e.item}`;
    const marked = new Set(m.marked.filter((x) => x.part === 'name' || x.part === 'bubble').map(key));
    expect(new Set(m.reported.map(key))).toEqual(marked);
    expect(new Set(r.textOverflow.map(key))).toEqual(marked);
  });

  it('el número de páginas no cambia', () => {
    expect(r.pdfPages).toBe(r.structure.totalPages);
  });
});

describe('un texto imposible de ver completo se informa y el PDF se genera igual (feature 007)', () => {
  let h2: Harness;
  const LONG_NAME = text(300, 'Nombre');
  const alegraItem = (id: string, name: string, description: string) => ({
    status: 'active',
    price: 9000,
    category: { id: 'c1', name: 'RAMEN' },
    id,
    name,
    description,
  });
  beforeAll(async () => {
    h2 = await startHarness({
      categories: [{ id: 'c1', name: 'RAMEN' }],
      items: (url) => [
        { ...alegraItem('1', LONG_NAME, text(3500, 'descripción')), images: [`${url}/img/ok.png`] },
        { ...alegraItem('2', 'Producto normal', 'Una descripción corta'), images: [`${url}/img/ok.png`] },
      ],
    });
  }, 240_000);
  afterAll(async () => {
    await h2?.close();
  });

  it('lista el producto con su parte y no impide generar; el producto normal no aparece', async () => {
    const r = await h2.generate({ prepare: { templateId: 'neon' } });
    expect(r.pdfPages).toBeGreaterThan(0);
    expect(r.textOverflow.some((e) => e.item === LONG_NAME)).toBe(true);
    expect(r.textOverflow.every((e) => e.item === LONG_NAME)).toBe(true);
    expect(r.textOverflow.every((e) => e.part === 'name' || e.part === 'bubble')).toBe(true);
    // sin repetir la misma pareja producto-parte
    expect(new Set(r.textOverflow.map((e) => `${e.part}${e.item}`)).size).toBe(r.textOverflow.length);
  }, 240_000);

  it('con un producto normal solo, no hay nada que informar', async () => {
    h2.mock.setItems([{ ...alegraItem('2', 'Producto normal', 'Una descripción corta'), images: [`${h2.mock.url}/img/ok.png`] }]);
    const r = await h2.generate({ prepare: { templateId: 'neon' } });
    expect(r.textOverflow).toEqual([]);
  }, 240_000);
});
