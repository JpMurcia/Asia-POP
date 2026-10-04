import { describe, expect, it } from 'vitest';
import {
  BASE_TEMPLATES,
  FONT_PAIRS,
  PALETTE_PRESETS,
  baseTemplate,
} from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import {
  BASE_IDS,
  PAGE_KEYS,
  REQUIRED_BLOCKS,
  TOKEN_NAMES,
  isAutoBlock,
  paletteWarnings,
  type PageElement,
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
} as const;

const allEls = (id: (typeof BASE_IDS)[number]): { page: string; el: PageElement }[] =>
  PAGE_KEYS.flatMap((page) => baseTemplate(id).pages[page].els.map((el) => ({ page, el })));

describe('plantillas base', () => {
  it('son cuatro, en este orden, con los nombres del mockup', () => {
    expect(BASE_TEMPLATES.map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft']);
    expect(BASE_TEMPLATES.map((t) => t.base)).toEqual(['neon', 'pop', 'kawaii', 'kraft']);
    expect(BASE_TEMPLATES.map((t) => t.name)).toEqual(['Neón Noche', 'Pop crema', 'Kawaii pastel', 'Kraft minimal']);
  });

  it('las cuatro validan contra el esquema de plantillas', () => {
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
