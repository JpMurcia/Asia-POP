import { describe, expect, it } from 'vitest';
import {
  BASE_TEMPLATES,
  FONT_PAIRS,
  PALETTE_PRESETS,
  baseTemplate,
  normalizeProductsBlocks,
} from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import {
  BASE_IDS,
  PAGE_KEYS,
  PRODUCTS_ZONE_MIN,
  REQUIRED_BLOCKS,
  TOKEN_NAMES,
  isAutoBlock,
  paletteWarnings,
  type PageElement,
  type ProductsEl,
} from '../../src/catalog/template';

/**
 * Paletas del mockup (`PAL_PRESETS` de Apariencia Editor.dc.html). Única diferencia: el color de texto de Neón Noche
 * pasa de blanco a un morado casi negro. Blanco sobre el papel crema `#F4EFE8` tiene contraste 1,2 y la plantilla de
 * fábrica no debe dar advertencias (research §10); además es el color con que el PDF de 002 escribe sobre la hoja
 * crema de las portadas.
 */
const MOCKUP = {
  neon: { bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' },
  pop: { bg: '#2A1258', a1: '#E5368C', a2: '#FFB800', a3: '#E5368C', ink: '#2A1258', paper: '#FFF7EC' },
  kawaii: { bg: '#FFD6E5', a1: '#FF5C93', a2: '#7ED8C3', a3: '#FFB84D', ink: '#5A2E4A', paper: '#FFF3F7' },
  kraft: { bg: '#1C1A17', a1: '#D9502F', a2: '#1C1A17', a3: '#D9502F', ink: '#1C1A17', paper: '#EFE6D6' },
  // Base AsianPop (feature 010): colores medidos en la base de Canva
  base: { bg: '#11052C', a1: '#C04B0F', a2: '#FF3131', a3: '#E7DECF', ink: '#000000', paper: '#FAFAFA' },
} as const;

const allEls = (id: (typeof BASE_IDS)[number]): { page: string; el: PageElement }[] =>
  PAGE_KEYS.flatMap((page) => baseTemplate(id).pages[page].els.map((el) => ({ page, el })));

describe('plantillas base', () => {
  it('son cinco, en este orden: las cuatro del mockup y Base AsianPop (feature 010) al final', () => {
    expect(BASE_TEMPLATES.map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft', 'base']);
    expect(BASE_TEMPLATES.map((t) => t.base)).toEqual(['neon', 'pop', 'kawaii', 'kraft', 'base']);
    expect(BASE_TEMPLATES.map((t) => t.name)).toEqual(['Neón Noche', 'Pop crema', 'Kawaii pastel', 'Kraft minimal', 'Base AsianPop']);
  });

  it('todas validan contra el esquema de plantillas', () => {
    const r = workspaceSchema.safeParse({ templates: BASE_TEMPLATES, defaultId: 'neon' });
    expect(r.success, r.success ? '' : JSON.stringify(r.error.issues, null, 2)).toBe(true);
  });

  it('el esquema no cambia ningún valor de las plantillas base (ya vienen normalizadas)', () => {
    const r = workspaceSchema.parse({ templates: BASE_TEMPLATES, defaultId: 'neon' });
    expect(r.templates).toEqual(BASE_TEMPLATES);
  });

  it.each(BASE_IDS)('%s: paleta igual a la del mockup', (id) => {
    expect(baseTemplate(id).palette).toEqual(MOCKUP[id]);
  });

  it('los pares tipográficos de cada plantilla son los del mockup', () => {
    expect(baseTemplate('neon').fonts).toEqual({ title: 'fredoka', body: 'poppins' });
    expect(baseTemplate('pop').fonts).toEqual({ title: 'fredoka', body: 'poppins' });
    expect(baseTemplate('kawaii').fonts).toEqual({ title: 'zen', body: 'zen' });
    expect(baseTemplate('kraft').fonts).toEqual({ title: 'serif', body: 'grotesk' });
  });

  it('Neón Noche usa los colores del PDF de 002 y no da advertencias de contraste', () => {
    const p = baseTemplate('neon').palette;
    expect([p.bg, p.a1, p.a2, p.a3]).toEqual(['#11052C', '#FF007A', '#00FF66', '#FF9900']);
    expect(paletteWarnings(p)).toEqual([]);
  });

  describe.each(BASE_IDS)('%s: estructura', (id) => {
    it('cada página trae exactamente los bloques automáticos que le corresponden', () => {
      const t = baseTemplate(id);
      for (const page of PAGE_KEYS) {
        const els = t.pages[page].els;
        for (const [type, n] of Object.entries(REQUIRED_BLOCKS[page])) {
          expect(els.filter((e) => e.type === type).length, `${id}/${page}/${type}`).toBe(n);
        }
      }
    });

    it('los bloques automáticos nacen bloqueados y visibles', () => {
      for (const { el } of allEls(id)) {
        if (isAutoBlock(el)) {
          expect(el.locked).toBe(true);
          expect(el.visible).toBe(true);
          expect(el.rot).toBe(0);
        }
      }
    });

    it('la portada de sección tiene el bloque de introducción', () => {
      expect(baseTemplate(id).pages.seccion.els.some((e) => e.type === 'intro')).toBe(true);
    });

    it('todos los marcadores usados son conocidos', () => {
      for (const { el } of allEls(id)) {
        const content = el.type === 'text' || el.type === 'badge' ? el.text : el.type === 'footer' ? el.content : '';
        for (const m of content.matchAll(/\{(\w+)\}/g)) {
          expect(TOKEN_NAMES as readonly string[], `{${m[1]}} en ${id}`).toContain(m[1]);
        }
      }
    });

    it('cada elemento cabe en la hoja, salvo adornos que pueden asomar', () => {
      for (const { page, el } of allEls(id)) {
        if (el.type === 'shape' || el.type === 'image') continue;
        expect(el.x, `${id}/${page}/${el.id}`).toBeGreaterThanOrEqual(0);
        expect(el.y).toBeGreaterThanOrEqual(0);
        expect(el.x + el.w).toBeLessThanOrEqual(100.01);
        expect(el.y + el.h).toBeLessThanOrEqual(100.01);
      }
    });
  });

  describe('Neón Noche reproduce el catálogo de 002', () => {
    const t = baseTemplate('neon');

    it('las portadas van sobre el atardecer con el marco, sin logo suelto', () => {
      for (const page of ['portada', 'seccion'] as const) {
        expect(t.pages[page].bg).toMatchObject({ type: 'image', image: 'coverbg' });
        const frame = t.pages[page].els.find((e) => e.type === 'image' && e.src === 'frame');
        // El PDF de 002 estira el marco a su caja (100 % × 100 %)
        expect(frame, page).toMatchObject({ x: 1.4, y: 0, w: 97.2, h: 100, fit: 'fill' });
        expect(t.pages[page].els.some((e) => e.type === 'image' && e.src === 'logo')).toBe(false);
      }
    });

    it('la portada lleva el banner, el collage y los teléfonos', () => {
      const els = t.pages.portada.els;
      expect(els.find((e) => e.type === 'text' && e.text === '{banner}')).toMatchObject({ y: 27.5, h: 8.2, color: 'bg', glow: 'a1', font: 'title' });
      expect(els.find((e) => e.type === 'image' && e.src === 'collage')).toMatchObject({ x: 14.9, y: 37.9, w: 78.8, h: 41 });
      expect(els.some((e) => e.type === 'text' && e.text === 'Domicilios')).toBe(true);
      expect(els.some((e) => e.type === 'text' && e.text === '{telefonos}')).toBe(true);
    });

    it('la portada de sección lleva el nombre con contorno, la introducción y el contacto', () => {
      const els = t.pages.seccion.els;
      expect(els.find((e) => e.type === 'text' && e.text === '{seccion}')).toMatchObject({ x: 4, y: 32.2, w: 92, h: 18, size: 88, color: 'bg', stroke: 'a1' });
      expect(els.find((e) => e.type === 'intro')).toMatchObject({ x: 14, y: 56, w: 72, h: 26 });
      expect(els.some((e) => e.type === 'text' && e.text === '{telefonos}')).toBe(true);
    });

    it('productos: título en mayúsculas negro, logo, bloque alternado a todo el ancho y pie', () => {
      const els = t.pages.productos.els;
      expect(t.pages.productos.bg).toMatchObject({ type: 'image', image: 'marble' });
      expect(els.find((e) => e.type === 'text')).toMatchObject({ text: 'Catálogo {seccion}', upper: true, color: '#111111', font: 'title' });
      expect(els.some((e) => e.type === 'image' && e.src === 'logo')).toBe(true);
      expect(els.find((e) => e.type === 'products')).toMatchObject({ layout: 'alternado', x: 0, y: 10.4, w: 100, h: 85.2, cardFill: 'bg', ring: 'a2', ringW: 3, priceBorder: 'a3', sold: 'sello' });
      expect(els.find((e) => e.type === 'footer')).toMatchObject({ fill: 'bg', line: 'a3' });
    });

    it('políticas: título, logo, bloque de políticas con chips bg/a1 y pie', () => {
      const els = t.pages.politicas.els;
      expect(els.find((e) => e.type === 'text')).toMatchObject({ text: 'Políticas de compra' });
      expect(els.find((e) => e.type === 'terms')).toMatchObject({ chipFill: 'bg', chipText: 'a1', boxFill: '#E8DFD0' });
      expect(els.some((e) => e.type === 'footer')).toBe(true);
    });
  });

  describe('bloque de productos: tamaño de la foto y nombre (feature 007)', () => {
    const productsOf = (id: (typeof BASE_IDS)[number]) =>
      baseTemplate(id).pages.productos.els.find((e) => e.type === 'products')!;

    it('Neón Noche trae el nombre separado, en neón (acento 1), sobre un rótulo oscuro y con resplandor', () => {
      expect(productsOf('neon')).toMatchObject({
        photoW: 100,
        photoH: 100,
        nameStyle: 'separado',
        nameColor: 'a1',
        nameFill: 'bg',
        nameGlow: true,
      });
    });

    it.each(['pop', 'kawaii', 'kraft'] as const)('%s conserva el nombre dentro de la burbuja', (id) => {
      expect(productsOf(id)).toMatchObject({
        photoW: 100,
        photoH: 100,
        nameStyle: 'burbuja',
        nameColor: 'a1',
        nameFill: 'transparent',
        nameGlow: false,
      });
    });

    it.each(BASE_IDS)('%s: la zona de productos de fábrica cumple el mínimo', (id) => {
      const el = productsOf(id);
      expect(el.w).toBeGreaterThanOrEqual(PRODUCTS_ZONE_MIN.w);
      expect(el.h).toBeGreaterThanOrEqual(PRODUCTS_ZONE_MIN.h);
    });
  });

  describe('normalizeProductsBlocks', () => {
    const NEW_KEYS = ['photoW', 'photoH', 'nameStyle', 'nameColor', 'nameFill', 'nameGlow'] as const;
    /** La plantilla como la dejó la feature 006: sin los seis campos nuevos. */
    const legacy = (id: (typeof BASE_IDS)[number]) => {
      const t = baseTemplate(id);
      for (const el of t.pages.productos.els) {
        if (el.type === 'products') for (const k of NEW_KEYS) delete (el as unknown as Record<string, unknown>)[k];
      }
      return t;
    };
    const blockOf = (t: ReturnType<typeof baseTemplate>) => t.pages.productos.els.find((e) => e.type === 'products')!;

    it('la plantilla neon recibe los valores de Neón Noche; cualquier otra, los de la burbuja', () => {
      expect(blockOf(normalizeProductsBlocks(legacy('neon')))).toMatchObject({
        photoW: 100,
        photoH: 100,
        nameStyle: 'separado',
        nameColor: 'a1',
        nameFill: 'bg',
        nameGlow: true,
      });
      for (const id of ['pop', 'kawaii', 'kraft'] as const) {
        expect(blockOf(normalizeProductsBlocks(legacy(id))), id).toMatchObject({
          photoW: 100,
          photoH: 100,
          nameStyle: 'burbuja',
          nameColor: 'a1',
          nameFill: 'transparent',
          nameGlow: false,
        });
      }
    });

    it('solo manda el id `neon`: una copia con otro id y base neon no se vuelve separada', () => {
      const t = { ...legacy('neon'), id: 'mi-neon' };
      expect(blockOf(normalizeProductsBlocks(t))).toMatchObject({ nameStyle: 'burbuja', nameFill: 'transparent', nameGlow: false });
    });

    it('con los seis campos presentes devuelve lo mismo (idempotente) y no pisa lo que la persona eligió', () => {
      const t = baseTemplate('pop');
      Object.assign(blockOf(t), { nameStyle: 'separado', nameColor: '#00FF66', photoW: 80 });
      const once = normalizeProductsBlocks(t);
      expect(once).toEqual(t);
      expect(normalizeProductsBlocks(once)).toEqual(once);
    });

    it('completa solo los campos que faltan', () => {
      const t = legacy('neon');
      Object.assign(blockOf(t), { nameColor: '#00FF66' });
      expect(blockOf(normalizeProductsBlocks(t))).toMatchObject({ nameColor: '#00FF66', nameStyle: 'separado', nameFill: 'bg' });
    });

    it('devuelve una copia: no modifica la plantilla recibida ni comparte referencias', () => {
      const t = legacy('neon');
      const out = normalizeProductsBlocks(t);
      expect(out).not.toBe(t);
      expect('nameStyle' in blockOf(t)).toBe(false);
      expect(out.pages.productos.els).not.toBe(t.pages.productos.els);
    });

    it('no toca los demás elementos ni las demás páginas', () => {
      const t = legacy('kraft');
      const out = normalizeProductsBlocks(t);
      expect(out.pages.portada).toEqual(t.pages.portada);
      expect(out.pages.politicas).toEqual(t.pages.politicas);
      const others = (x: typeof t) => x.pages.productos.els.filter((e) => e.type !== 'products');
      expect(others(out)).toEqual(others(t));
    });

    it('el resultado valida contra el esquema', () => {
      const r = workspaceSchema.safeParse({ templates: BASE_IDS.map((id) => normalizeProductsBlocks(legacy(id))), defaultId: 'neon' });
      expect(r.success, r.success ? '' : JSON.stringify(r.error.issues)).toBe(true);
    });
  });

  describe('baseTemplate', () => {
    it('devuelve una copia independiente', () => {
      const a = baseTemplate('pop');
      a.name = 'Cambiada';
      a.palette.bg = '#000000';
      a.pages.portada.els.length = 0;
      const b = baseTemplate('pop');
      expect(b.name).toBe('Pop crema');
      expect(b.palette.bg).toBe('#2A1258');
      expect(b.pages.portada.els.length).toBeGreaterThan(0);
      expect(BASE_TEMPLATES.find((t) => t.id === 'pop')!.palette.bg).toBe('#2A1258');
    });

    it('es determinista: dos llamadas dan el mismo documento, con los mismos ids', () => {
      expect(baseTemplate('kawaii')).toEqual(baseTemplate('kawaii'));
    });

    it('los ids de elemento son únicos dentro de cada página', () => {
      for (const id of BASE_IDS) {
        for (const page of PAGE_KEYS) {
          const ids = baseTemplate(id).pages[page].els.map((e) => e.id);
          expect(new Set(ids).size, `${id}/${page}`).toBe(ids.length);
        }
      }
    });
  });
});

describe('paletas sugeridas', () => {
  it('son cinco: Neón Noche, Pop crema, Kawaii, Kraft y Matcha', () => {
    expect(PALETTE_PRESETS.map((p) => p.name)).toEqual(['Neón Noche', 'Pop crema', 'Kawaii', 'Kraft', 'Matcha']);
  });

  it('cada una trae los seis colores en #RRGGBB', () => {
    for (const p of PALETTE_PRESETS) {
      expect(Object.keys(p.palette).sort()).toEqual(['a1', 'a2', 'a3', 'bg', 'ink', 'paper']);
      for (const v of Object.values(p.palette)) expect(v).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('coinciden con las paletas de las plantillas base', () => {
    expect(PALETTE_PRESETS[0]!.palette).toEqual(baseTemplate('neon').palette);
    expect(PALETTE_PRESETS[1]!.palette).toEqual(baseTemplate('pop').palette);
    expect(PALETTE_PRESETS[2]!.palette).toEqual(baseTemplate('kawaii').palette);
    expect(PALETTE_PRESETS[3]!.palette).toEqual(baseTemplate('kraft').palette);
    expect(PALETTE_PRESETS[4]!.palette).toEqual({ bg: '#1F3B2D', a1: '#8FCB5E', a2: '#F4E8C1', a3: '#E86F51', ink: '#1F3B2D', paper: '#F6F1E3' });
  });

  it('aplicar una no comparte referencias con el catálogo de paletas', () => {
    const copy = { ...PALETTE_PRESETS[0]!.palette };
    copy.bg = '#000000';
    expect(PALETTE_PRESETS[0]!.palette.bg).toBe('#11052C');
  });
});

describe('pares tipográficos', () => {
  it('son cinco, en el orden del mockup', () => {
    expect(FONT_PAIRS).toEqual([
      { title: 'fredoka', body: 'poppins' },
      { title: 'bungee', body: 'poppins' },
      { title: 'zen', body: 'zen' },
      { title: 'serif', body: 'grotesk' },
      { title: 'grotesk', body: 'grotesk' },
    ]);
  });
});

/** Base AsianPop (feature 010): lo medido en la página 3 de la base de Canva. */
describe('plantilla Base AsianPop', () => {
  const t = baseTemplate('base');
  const products = (): ProductsEl => t.pages.productos.els.find((e) => e.type === 'products') as ProductsEl;

  it('usa Poppins en todo y la paleta de la base, sin advertencias de contraste', () => {
    expect(t.fonts).toEqual({ title: 'poppins', body: 'poppins' });
    expect(paletteWarnings(t.palette)).toEqual([]);
  });

  it('el bloque de productos lleva las medidas y estilos de la base', () => {
    expect(products()).toMatchObject({
      layout: 'base',
      cardStyle: 'tarjeta',
      nameStyle: 'tarjeta',
      nameGlow: true,
      sold: 'diagonal',
      soldFill: 'a2',
      soldGlow: true,
      priceFill: '#1F021D',
      priceText: 'a1',
      priceGlow: true,
      bubbleFill: 'a3',
      bubbleShadow: true,
      descLh: 1.4,
    });
  });

  it('el título es «CATÁLOGO {seccion}» en Poppins 32 negrita, mayúsculas y centrado (FR-010, FR-013a)', () => {
    const title = t.pages.productos.els.find((e) => e.type === 'text' && e.text === 'CATÁLOGO {seccion}');
    expect(title).toMatchObject({ size: 32, weight: 700, upper: true, align: 'center', x: 24.05, y: 2.56, w: 51.95 });
  });

  it('el logo es cuadrado de 4,06 cm a 0,3 cm del borde superior y derecho', () => {
    const logo = t.pages.productos.els.find((e) => e.type === 'image' && e.src === 'logo')!;
    const cmW = (logo.w / 100) * 21;
    const cmH = (logo.h / 100) * 29.7;
    expect(cmW).toBeCloseTo(4.06, 1);
    expect(cmH).toBeCloseTo(4.06, 1);
    expect(logo.y / 100 * 29.7).toBeCloseTo(0.3, 0);
    expect(21 - ((logo.x + logo.w) / 100) * 21).toBeLessThan(0.4);
  });

  it('todos los textos usan el interlineado 1,4 de la base', () => {
    for (const page of PAGE_KEYS) {
      for (const el of t.pages[page].els) if (el.type === 'text') expect(el.lh, `${page}/${el.id}`).toBe(1.4);
    }
  });

  it('el interlineado por defecto de las demás plantillas no cambió (1,05)', () => {
    for (const id of ['neon', 'pop', 'kawaii', 'kraft'] as const) {
      for (const page of PAGE_KEYS) {
        for (const el of baseTemplate(id).pages[page].els) if (el.type === 'text') expect(el.lh).toBeUndefined();
      }
    }
  });

  it('las portadas no traen ilustraciones ni arte del negocio: solo el logo y el ícono propio', () => {
    for (const page of ['portada', 'seccion'] as const) {
      const sources = t.pages[page].els.flatMap((e) => (e.type === 'image' ? [e.src] : []));
      expect(sources.every((s) => s === 'logo' || s === 'chat')).toBe(true);
    }
  });
});
