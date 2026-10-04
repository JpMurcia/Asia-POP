import { describe, expect, it } from 'vitest';
import type { NormalizedItem } from '../../src/alegra/alegra.mapper';
import { buildCatalog, type BuilderInput } from '../../src/catalog/catalog-builder';
import { baseTemplate } from '../../src/catalog/template-presets';

const config = { storeName: 'X', phone1: '1', phone2: '2', address: 'a', coverTitle: 'Catálogo guardado' };

const alegra = (id: string, cat: 'c1' | 'c2' | null, over: Partial<NormalizedItem> = {}): NormalizedItem => ({
  id,
  name: `Producto ${id}`,
  description: '',
  price: 9000,
  remoteImageUrl: 'https://x/a.jpg',
  soldOut: false,
  categoryId: cat,
  categoryName: cat === 'c1' ? 'RAMEN' : cat === 'c2' ? 'SNACKS' : null,
  type: 'simple',
  ...over,
});

function input(items: NormalizedItem[], over: Partial<BuilderInput> = {}): BuilderInput {
  return {
    config,
    terms: [{ title: 'T', body: 'b' }],
    categories: [
      { id: 'c1', name: 'RAMEN' },
      { id: 'c2', name: 'SNACKS' },
    ],
    items,
    localImages: new Map(items.map((i) => [i.id, `/media/cache/${i.id}.jpg`])),
    overrides: new Map(),
    sectionOrder: [],
    customSections: [
      { key: 'custom:r', name: 'REGALOS', products: [] },
      {
        key: 'custom:m',
        name: 'MOCHIS',
        products: [{ id: 'p-noimg', name: 'Mochi sin foto', description: '', imageUrl: null, price: 5000 }],
      },
    ],
    ...over,
  };
}

const bundle = (id: string, sectionKey: string, productIds: string[], over = {}) => ({
  id,
  sectionKey,
  name: `Combo ${id}`,
  description: '',
  imageUrl: `/media/uploads/${id}.png`,
  pricing: { type: 'discount' as const, percent: 10 },
  components: productIds.map((p) => ({ source: 'alegra' as const, productId: p, quantity: 1 })),
  ...over,
});

describe('opciones de generación del constructor', () => {
  it('sectionKeys excluye secciones del payload', () => {
    const items = [alegra('1', 'c1'), alegra('2', 'c2')];
    const r = buildCatalog(input(items, { sectionKeys: ['alegra:c2'] }));
    expect(r.payload.sections.map((s) => s.key)).toEqual(['alegra:c2']);
    expect(r.report.counts.included).toBe(1);
  });

  it('las claves desconocidas se ignoran', () => {
    const r = buildCatalog(input([alegra('1', 'c1')], { sectionKeys: ['alegra:c1', 'alegra:nope'] }));
    expect(r.payload.sections.map((s) => s.key)).toEqual(['alegra:c1']);
  });

  it('selección vacía: catálogo vacío, no se puede generar', () => {
    const r = buildCatalog(input([alegra('1', 'c1')], { sectionKeys: [] }));
    expect(r.payload.sections).toEqual([]);
    expect(r.report.emptyCatalog).toBe(true);
  });

  describe('informe filtrado por secciones incluidas', () => {
    it('omitidos por falta de imagen solo cuentan los de secciones incluidas', () => {
      const items = [alegra('1', 'c1'), alegra('2', 'c1'), alegra('3', 'c2'), alegra('4', 'c2')];
      const localImages = new Map<string, string | null>([
        ['1', '/m/1.jpg'],
        ['2', null], // sin imagen en RAMEN
        ['3', '/m/3.jpg'],
        ['4', null], // sin imagen en SNACKS
      ]);
      const r = buildCatalog(input(items, { localImages, sectionKeys: ['alegra:c1'] }));
      expect(r.report.omittedNoImage.map((o) => o.id)).toEqual(['2']);
      expect(r.report.counts.omitted).toBe(1);
    });

    it('un producto propio sin imagen en una sección desmarcada no se informa', () => {
      const r = buildCatalog(input([alegra('1', 'c1')], { sectionKeys: ['alegra:c1'] }));
      expect(r.report.omittedNoImage).toEqual([]);
      const all = buildCatalog(input([alegra('1', 'c1')]));
      expect(all.report.omittedNoImage).toEqual([{ source: 'custom', id: 'p-noimg', name: 'Mochi sin foto' }]);
    });

    it('un combo agotado en una sección desmarcada no exige decisión', () => {
      const items = [alegra('1', 'c1'), alegra('2', 'c1', { soldOut: true })];
      const bundles = [bundle('b1', 'custom:r', ['1', '2'])];
      const included = buildCatalog(input(items, { bundles }));
      expect(included.report.soldOutBundles.map((b) => b.bundleId)).toEqual(['b1']);
      const excluded = buildCatalog(input(items, { bundles, sectionKeys: ['alegra:c1'] }));
      expect(excluded.report.soldOutBundles).toEqual([]);
    });

    it('uncategorized y omittedNoSection siguen siendo globales', () => {
      const items = [alegra('1', 'c1'), alegra('9', null)];
      const r = buildCatalog(input(items, { sectionKeys: ['alegra:c1'] }));
      expect(r.report.uncategorized).toEqual([{ itemId: '9', name: 'Producto 9' }]);
      expect(r.report.omittedNoSection).toEqual([{ itemId: '9', name: 'Producto 9' }]);
      expect(r.report.counts.omitted).toBe(1);
    });

    it('el conteo de agotados solo cuenta secciones incluidas', () => {
      const items = [alegra('1', 'c1', { soldOut: true }), alegra('2', 'c2', { soldOut: true })];
      const r = buildCatalog(input(items, { sectionKeys: ['alegra:c1'] }));
      expect(r.report.counts.soldOut).toBe(1);
    });
  });

  describe('ocultar agotados y combos', () => {
    const items = [alegra('1', 'c1'), alegra('2', 'c1', { soldOut: true })];
    const bundles = [bundle('b1', 'custom:r', ['1', '2'])];

    it('con hideSoldOut el combo con un componente agotado se omite sin pedir decisión', () => {
      const r = buildCatalog(input(items, { bundles, hideSoldOut: true }));
      expect(r.report.soldOutBundles).toEqual([]);
      expect(r.payload.sections.find((s) => s.key === 'custom:r')).toBeUndefined();
      expect(r.payload.sections.flatMap((s) => s.pages.flat()).some((i) => i.kind === 'bundle')).toBe(false);
    });

    it('sin hideSoldOut se pide decisión y "omit" no lo incluye', () => {
      const asked = buildCatalog(input(items, { bundles }));
      expect(asked.report.soldOutBundles).toHaveLength(1);
      const omitted = buildCatalog(input(items, { bundles, decisions: { b1: 'omit' } }));
      expect(omitted.payload.sections.flatMap((s) => s.pages.flat()).some((i) => i.kind === 'bundle')).toBe(false);
    });

    it('un combo disponible no se oculta con hideSoldOut', () => {
      const r = buildCatalog(input(items, { bundles: [bundle('b2', 'custom:r', ['1'])], hideSoldOut: true }));
      expect(r.payload.sections.some((s) => s.key === 'custom:r')).toBe(true);
    });
  });

  describe('availableSections', () => {
    it('lista todas las secciones con contenido, antes de aplicar sectionKeys', () => {
      const items = [alegra('1', 'c1'), alegra('2', 'c1'), alegra('3', 'c2')];
      const r = buildCatalog(input(items, { sectionKeys: ['alegra:c2'] }));
      expect(r.availableSections).toEqual([
        { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 2 },
        { key: 'alegra:c2', name: 'SNACKS', source: 'alegra', items: 1 },
      ]);
    });

    it('respeta hideSoldOut: una sección con todo agotado deja de estar disponible', () => {
      const items = [alegra('1', 'c1', { soldOut: true }), alegra('3', 'c2')];
      const r = buildCatalog(input(items, { hideSoldOut: true }));
      expect(r.availableSections.map((s) => s.key)).toEqual(['alegra:c2']);
    });

    it('sigue el orden definido por el usuario', () => {
      const items = [alegra('1', 'c1'), alegra('3', 'c2')];
      const r = buildCatalog(input(items, { sectionOrder: ['alegra:c2', 'alegra:c1'] }));
      expect(r.availableSections.map((s) => s.key)).toEqual(['alegra:c2', 'alegra:c1']);
    });
  });

  describe('banner y plantilla', () => {
    it('bannerText reemplaza coverTitle solo en esa generación', () => {
      const r = buildCatalog(input([alegra('1', 'c1')], { bannerText: '  Oferta de octubre ' }));
      expect(r.payload.config.coverTitle).toBe('Oferta de octubre');
    });

    it('bannerText vacío usa el coverTitle guardado', () => {
      expect(buildCatalog(input([alegra('1', 'c1')], { bannerText: '   ' })).payload.config.coverTitle).toBe(
        'Catálogo guardado',
      );
      expect(buildCatalog(input([alegra('1', 'c1')])).payload.config.coverTitle).toBe('Catálogo guardado');
    });

    it('el payload lleva la plantilla indicada o Neón Noche de fábrica', () => {
      expect(buildCatalog(input([alegra('1', 'c1')])).payload.template).toEqual(baseTemplate('neon'));
      const template = { ...baseTemplate('kraft'), name: 'Mi Kraft' };
      expect(buildCatalog(input([alegra('1', 'c1')], { template })).payload.template).toEqual(template);
    });

    it('la plantilla no cambia el contenido: mismas secciones, páginas y productos con cualquier plantilla', () => {
      const items = [1, 2, 3, 4, 5].map((n) => alegra(String(n), 'c1'));
      const pagesOf = (r: ReturnType<typeof buildCatalog>) => r.payload.sections.map((s) => s.pages.map((p) => p.map((i) => i.id)));
      const base = buildCatalog(input(items));
      for (const id of ['neon', 'pop', 'kawaii', 'kraft'] as const) {
        const r = buildCatalog(input(items, { template: baseTemplate(id) }));
        expect(pagesOf(r)).toEqual(pagesOf(base));
        expect(r.report).toEqual(base.report);
      }
    });

    it('el payload ya no lleva el tema de 002', () => {
      expect(buildCatalog(input([alegra('1', 'c1')])).payload.config).not.toHaveProperty('theme');
    });
  });
});
