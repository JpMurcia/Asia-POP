import { describe, expect, it } from 'vitest';
import { workspaceSchema, templateSchema } from '../../src/catalog/template.schema';

const base = { rot: 0, opacity: 1, visible: true, locked: false };
const text = (id: string, over: Record<string, unknown> = {}) => ({
  ...base,
  id,
  type: 'text',
  text: 'Hola',
  font: 'title',
  size: 40,
  weight: 700,
  color: 'ink',
  stroke: 'none',
  strokeW: 0,
  glow: 'none',
  align: 'center',
  upper: false,
  ls: 0,
  x: 10,
  y: 10,
  w: 80,
  h: 10,
  ...over,
});
const auto = { rot: 0, opacity: 1, visible: true, locked: true };
const intro = (id = 'intro') => ({ ...auto, id, type: 'intro', boxFill: '#E8DFD0', textColor: '#1C1126', radius: 22, x: 14, y: 56, w: 72, h: 26 });
const products = (over: Record<string, unknown> = {}, id = 'products') => ({
  ...auto,
  id,
  type: 'products',
  layout: 'alternado',
  cardFill: 'bg',
  ring: 'a2',
  ringW: 4,
  cardRadius: 16,
  bubbleFill: '#E8DFD0',
  bubbleRadius: 20,
  textColor: '#1C1126',
  priceFill: 'bg',
  priceBorder: 'a3',
  priceText: '#FFFFFF',
  priceShape: 'pill',
  sold: 'sello',
  soldFill: 'a1',
  x: 0,
  y: 10.4,
  w: 100,
  h: 85.2,
  ...over,
});
const terms = (id = 'terms') => ({ ...auto, id, type: 'terms', chipFill: 'bg', chipText: 'a1', boxFill: '#E8DFD0', textColor: '#1C1126', x: 7, y: 15, w: 86, h: 79.6 });
const footer = (id = 'footer') => ({ ...auto, id, type: 'footer', content: '{telefonos} · {direccion}', fill: 'bg', line: 'a3', bw: 2, textColor: '#FFFFFF', x: 0, y: 96.8, w: 100, h: 3.2 });

const bg = { type: 'image', image: 'marble', color: 'paper', color2: 'a1' };

type PageKey = 'portada' | 'seccion' | 'productos' | 'politicas';
interface Loose {
  id: string;
  name: string;
  base: string;
  version: number;
  palette: Record<string, string>;
  fonts: Record<string, string>;
  pages: Record<PageKey, { bg: unknown; els: unknown[] }>;
}

function template(id = 'neon', over: Record<string, unknown> = {}): Loose {
  return {
    id,
    name: 'Neón Noche',
    base: 'neon',
    version: 1,
    palette: { bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' },
    fonts: { title: 'fredoka', body: 'poppins' },
    pages: {
      portada: { bg, els: [text('t1')] },
      seccion: { bg, els: [intro()] },
      productos: { bg, els: [products(), footer()] },
      politicas: { bg, els: [terms(), footer('f2')] },
    },
    ...over,
  };
}

const doc = (templates = [template()], defaultId = 'neon') => ({ templates, defaultId });
const withPages = (patch: (p: Loose['pages']) => void) => {
  const t = template();
  patch(t.pages);
  return doc([t]);
};

/** Rutas de los errores de una validación fallida. */
function paths(input: unknown): string[] {
  const r = workspaceSchema.safeParse(input);
  if (r.success) return [];
  return r.error.issues.map((i) => i.path.join('.'));
}
const messages = (input: unknown): string[] => {
  const r = workspaceSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe('esquema de plantillas', () => {
  it('un documento válido pasa', () => {
    expect(workspaceSchema.safeParse(doc()).success).toBe(true);
    expect(templateSchema.safeParse(template()).success).toBe(true);
  });

  it('normaliza los colores #RRGGBB a mayúsculas y recorta el nombre', () => {
    const t = template('neon', { name: '  Mi plantilla  ' });
    t.pages.portada.els = [text('t1', { color: '#aabbcc' })];
    const r = workspaceSchema.parse(doc([t]));
    expect(r.templates[0]!.name).toBe('Mi plantilla');
    expect((r.templates[0]!.pages.portada.els[0] as { color: string }).color).toBe('#AABBCC');
  });

  describe('colores', () => {
    it('acepta clave de paleta, #RRGGBB, none y transparent', () => {
      for (const color of ['bg', 'a1', 'a2', 'a3', 'ink', 'paper', '#12ab34', 'none', 'transparent']) {
        const t = template();
        t.pages.portada.els = [text('t1', { color })];
        expect(workspaceSchema.safeParse(doc([t])).success, color).toBe(true);
      }
    });

    it.each(['rosa', '#FFF', '#GG0000', '#1234567', 'rgb(1,2,3)', ''])('rechaza el ColorRef inválido %j y señala el campo', (color) => {
      const t = template();
      t.pages.portada.els = [text('t1', { color })];
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.els.0.color');
    });

    it('rechaza un color de paleta que no es #RRGGBB', () => {
      const t = template();
      t.palette.bg = 'azul';
      expect(paths(doc([t]))).toContain('templates.0.palette.bg');
      t.palette.bg = '#11052C';
      t.palette.a1 = '#FF0';
      expect(paths(doc([t]))).toContain('templates.0.palette.a1');
    });

    it('el fondo de página valida sus colores y su imagen', () => {
      const t = template();
      t.pages.portada.bg = { type: 'gradient', image: 'marble', color: 'rosa', color2: 'a1' };
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.bg.color');
      t.pages.portada.bg = { type: 'image', image: 'logo', color: 'bg', color2: 'a1' } as never;
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.bg.image');
    });
  });

  describe('rangos numéricos', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['size', { size: 7 }],
      ['size', { size: 141 }],
      ['strokeW', { strokeW: 9 }],
      ['ls', { ls: 13 }],
      ['ls', { ls: -3 }],
      ['rot', { rot: 181 }],
      ['rot', { rot: -181 }],
      ['opacity', { opacity: 1.5 }],
      ['opacity', { opacity: -0.1 }],
      ['w', { w: 2.9 }],
      ['h', { h: 0.2 }],
      ['weight', { weight: 500 }],
    ];
    it.each(cases)('rechaza %s fuera de rango', (field, over) => {
      const t = template();
      t.pages.portada.els = [text('t1', over)];
      expect(paths(doc([t]))).toContain(`templates.0.pages.portada.els.0.${field}`);
    });

    it('acepta los extremos válidos', () => {
      const t = template();
      t.pages.portada.els = [text('t1', { size: 8, strokeW: 8, ls: -2, rot: -180, opacity: 0, w: 3, h: 0.3 }), text('t2', { size: 140, ls: 12, rot: 180, opacity: 1 })];
      expect(workspaceSchema.safeParse(doc([t])).success).toBe(true);
    });

    it('rechaza NaN e infinitos', () => {
      const t = template();
      t.pages.portada.els = [text('t1', { x: Number.NaN })];
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.els.0.x');
      t.pages.portada.els = [text('t1', { w: Infinity })];
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.els.0.w');
    });

    it('señala el campo del bloque de productos que se sale de rango', () => {
      const t = template();
      t.pages.productos.els = [products({ ringW: 11 }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.ringW');
      t.pages.productos.els = [products({ cardRadius: 81 }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.cardRadius');
      t.pages.productos.els = [products({ bubbleRadius: 41 }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.bubbleRadius');
    });

    it('valida los rangos de insignia, forma, imagen, introducción y pie', () => {
      const t = template();
      const shape = { ...base, id: 's', type: 'shape', kind: 'rect', fill: 'a1', border: 'none', bw: 0, radius: 12, glow: 'none', x: 0, y: 0, w: 10, h: 10 };
      const image = { ...base, id: 'i', type: 'image', src: 'logo', fit: 'contain', radius: 0, x: 0, y: 0, w: 10, h: 10 };
      const badge = { ...base, id: 'b', type: 'badge', text: 'NUEVO', fill: 'a1', color: '#FFFFFF', font: 'title', size: 16, x: 0, y: 0, w: 10, h: 5 };
      t.pages.portada.els = [{ ...shape, bw: 13 }, { ...shape, id: 's2', radius: 81 }, { ...image, radius: 301 }, { ...badge, size: 49 }];
      const got = paths(doc([t]));
      expect(got).toContain('templates.0.pages.portada.els.0.bw');
      expect(got).toContain('templates.0.pages.portada.els.1.radius');
      expect(got).toContain('templates.0.pages.portada.els.2.radius');
      expect(got).toContain('templates.0.pages.portada.els.3.size');
      const t2 = template();
      t2.pages.seccion.els = [{ ...intro(), radius: 61 }];
      expect(paths(doc([t2]))).toContain('templates.0.pages.seccion.els.0.radius');
      const t3 = template();
      t3.pages.productos.els = [products(), { ...footer(), bw: 7 }];
      expect(paths(doc([t3]))).toContain('templates.0.pages.productos.els.1.bw');
    });

    it('la imagen acepta los ajustes contener, cubrir y estirar', () => {
      const image = { ...base, id: 'i', type: 'image', src: 'frame', radius: 0, x: 0, y: 0, w: 10, h: 10 };
      for (const fit of ['contain', 'cover', 'fill']) {
        const t = template();
        t.pages.portada.els = [{ ...image, fit }];
        expect(workspaceSchema.safeParse(doc([t])).success, fit).toBe(true);
      }
      const bad = template();
      bad.pages.portada.els = [{ ...image, fit: 'zoom' }];
      expect(paths(doc([bad]))).toContain('templates.0.pages.portada.els.0.fit');
    });

    it('rechaza valores de enumeración desconocidos', () => {
      const t = template();
      t.pages.productos.els = [products({ layout: 'mosaico' }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.layout');
      t.pages.productos.els = [products({ sold: 'tachado' }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.sold');
      t.pages.productos.els = [products({ priceShape: 'estrella' }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.priceShape');
      const t2 = template();
      t2.pages.portada.els = [text('t1', { font: 'comic' })];
      expect(paths(doc([t2]))).toContain('templates.0.pages.portada.els.0.font');
    });

    it('rechaza un tipo de elemento desconocido', () => {
      const t = template();
      t.pages.portada.els = [{ ...base, id: 'x', type: 'video' } as never];
      expect(paths(doc([t])).some((p) => p.startsWith('templates.0.pages.portada.els.0'))).toBe(true);
    });
  });

  describe('bloques automáticos', () => {
    it('exige un bloque de introducción en la portada de sección', () => {
      const d = withPages((p) => (p.seccion.els = []));
      expect(paths(d)).toContain('templates.0.pages.seccion.els');
    });

    it('exige un bloque de productos y un pie en Productos, y uno de políticas y un pie en Políticas', () => {
      expect(paths(withPages((p) => (p.productos.els = [footer()])))).toContain('templates.0.pages.productos.els');
      expect(paths(withPages((p) => (p.productos.els = [products()])))).toContain('templates.0.pages.productos.els');
      expect(paths(withPages((p) => (p.politicas.els = [terms()])))).toContain('templates.0.pages.politicas.els');
      expect(paths(withPages((p) => (p.politicas.els = [footer()])))).toContain('templates.0.pages.politicas.els');
    });

    it('rechaza un bloque automático repetido en una página', () => {
      const d = withPages((p) => (p.productos.els = [products({}, 'p1'), products({}, 'p2'), footer()]));
      expect(paths(d)).toContain('templates.0.pages.productos.els');
      expect(messages(d).join(' ')).toMatch(/solo puede haber/i);
    });

    it('rechaza un bloque automático en una página equivocada', () => {
      expect(paths(withPages((p) => (p.portada.els = [text('t1'), footer('f0')])))).toContain('templates.0.pages.portada.els');
      expect(paths(withPages((p) => (p.seccion.els = [intro(), products({}, 'pp')])))).toContain('templates.0.pages.seccion.els');
      expect(paths(withPages((p) => (p.productos.els = [products(), footer(), terms('tt')])))).toContain('templates.0.pages.productos.els');
    });

    it('un bloque automático no puede estar oculto ni girado', () => {
      const t = template();
      t.pages.productos.els = [products({ visible: false }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.visible');
      t.pages.productos.els = [products({ rot: 10 }), footer()];
      expect(paths(doc([t]))).toContain('templates.0.pages.productos.els.0.rot');
    });

    it('un bloque automático sí puede estar desbloqueado', () => {
      const t = template();
      t.pages.productos.els = [products({ locked: false }), footer()];
      expect(workspaceSchema.safeParse(doc([t])).success).toBe(true);
    });

    it('una página puede quedar sin elementos libres', () => {
      const d = withPages((p) => (p.portada.els = []));
      expect(workspaceSchema.safeParse(d).success).toBe(true);
    });
  });

  describe('límites', () => {
    it('rechaza un nombre vacío o de más de 60 caracteres', () => {
      expect(paths(doc([template('neon', { name: '   ' })]))).toContain('templates.0.name');
      expect(paths(doc([template('neon', { name: 'x'.repeat(61) })]))).toContain('templates.0.name');
      expect(workspaceSchema.safeParse(doc([template('neon', { name: 'x'.repeat(60) })])).success).toBe(true);
    });

    it('acepta hasta 30 plantillas y rechaza 31', () => {
      const many = (n: number) => Array.from({ length: n }, (_, i) => template(`t${i}`));
      expect(workspaceSchema.safeParse(doc(many(30), 't0')).success).toBe(true);
      expect(paths(doc(many(31), 't0'))).toContain('templates');
    });

    it('acepta hasta 60 elementos por página y rechaza 61', () => {
      const t = template();
      t.pages.portada.els = Array.from({ length: 60 }, (_, i) => text(`e${i}`));
      expect(workspaceSchema.safeParse(doc([t])).success).toBe(true);
      t.pages.portada.els = Array.from({ length: 61 }, (_, i) => text(`e${i}`));
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.els');
    });

    it('rechaza un texto de más de 500 caracteres', () => {
      const t = template();
      t.pages.portada.els = [text('t1', { text: 'x'.repeat(501) })];
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.els.0.text');
      const t2 = template();
      t2.pages.productos.els = [products(), { ...footer(), content: 'x'.repeat(501) }];
      expect(paths(doc([t2]))).toContain('templates.0.pages.productos.els.1.content');
    });

    it('rechaza los ids de elemento repetidos dentro de una página (no entre páginas)', () => {
      const t = template();
      t.pages.portada.els = [text('t1'), text('t1')];
      expect(paths(doc([t]))).toContain('templates.0.pages.portada.els');
      const t2 = template();
      t2.pages.portada.els = [text('same')];
      t2.pages.productos.els = [products({}, 'same'), footer()];
      expect(workspaceSchema.safeParse(doc([t2])).success).toBe(true);
    });

    it('rechaza ids de plantilla repetidos', () => {
      expect(paths(doc([template('a'), template('a')], 'a'))).toContain('templates');
    });
  });

  describe('plantilla predeterminada y conjunto', () => {
    it('la predeterminada debe existir entre las plantillas', () => {
      expect(paths(doc([template('a')], 'otra'))).toContain('defaultId');
    });

    it('debe haber al menos una plantilla', () => {
      expect(paths(doc([], 'neon'))).toContain('templates');
    });

    it('un estilo base desconocido o una versión distinta se rechazan', () => {
      expect(paths(doc([template('neon', { base: 'retro' })]))).toContain('templates.0.base');
      expect(paths(doc([template('neon', { version: 2 })]))).toContain('templates.0.version');
    });

    it('los mensajes de error están en español', () => {
      const t = template('neon', { name: '' });
      expect(messages(doc([t])).join(' ')).toMatch(/nombre/i);
    });
  });
});
