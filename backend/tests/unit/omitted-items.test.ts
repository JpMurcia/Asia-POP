import { describe, expect, it } from 'vitest';
import type { NormalizedItem } from '../../src/alegra/alegra.mapper';
import { buildCatalog, type BuilderInput } from '../../src/catalog/catalog-builder';

/**
 * Feature 006: artículos de Alegra omitidos por la persona. La regla vive solo en `buildCatalog`:
 * un omitido no entra a ninguna sección ni genera ningún aviso.
 */

const config = { storeName: 'ASIANPOP', phone1: '1', phone2: '2', address: 'x', coverTitle: 'Catálogo' };
const GENERATED_AT = '2026-10-05T12:00:00.000Z';

const item = (id: string, over: Partial<NormalizedItem> = {}): NormalizedItem => ({
  id,
  name: `Producto ${id}`,
  description: '',
  price: 9000,
  remoteImageUrl: 'https://x.co/a.jpg',
  soldOut: false,
  categoryId: 'c1',
  categoryName: 'RAMEN',
  type: 'simple',
  ...over,
});

const input = (items: NormalizedItem[], over: Partial<BuilderInput> = {}): BuilderInput => ({
  config,
  terms: [],
  categories: [
    { id: 'c1', name: 'RAMEN' },
    { id: 'c2', name: 'SNACKS' },
    { id: 'c3', name: 'VACIA' },
  ],
  items,
  localImages: new Map(items.map((i) => [i.id, `/media/cache/${i.id}.jpg`])),
  overrides: new Map(),
  sectionOrder: [],
  generatedAt: GENERATED_AT,
  ...over,
});

const ids = (r: ReturnType<typeof buildCatalog>, section = 0) =>
  r.payload.sections[section]!.pages.flat().map((i) => i.id);

describe('artículos omitidos: la regla del constructor (US1)', () => {
  it('un omitido no aparece en su sección y el resto se reagrupa (FR-005)', () => {
    const items = ['1', '2', '3', '4', '5'].map((id) => item(id));
    const r = buildCatalog(input(items, { omittedIds: new Set(['2', '4']) }));
    expect(ids(r)).toEqual(['1', '3', '5']);
    expect(r.payload.sections[0]!.pages).toHaveLength(1);
    expect(r.report.counts.included).toBe(3);
  });

  it('las páginas se reagrupan de a 3 al omitir un artículo', () => {
    const items = ['1', '2', '3', '4'].map((id) => item(id));
    expect(buildCatalog(input(items)).payload.sections[0]!.pages.map((p) => p.length)).toEqual([3, 1]);
    const r = buildCatalog(input(items, { omittedIds: new Set(['4']) }));
    expect(r.payload.sections[0]!.pages.map((p) => p.length)).toEqual([3]);
  });

  it('un omitido agotado tampoco sale, ni con la indicación AGOTADO', () => {
    const items = [item('1'), item('2', { soldOut: true })];
    const r = buildCatalog(input(items, { omittedIds: new Set(['2']) }));
    expect(ids(r)).toEqual(['1']);
    expect(r.payload.sections[0]!.pages.flat().some((i) => i.kind === 'alegra' && i.soldOut)).toBe(false);
  });

  it('una sección cuyos artículos se omiten todos desaparece, sin portada (FR-013)', () => {
    const items = [item('1'), item('2', { categoryId: 'c2', categoryName: 'SNACKS' })];
    const r = buildCatalog(input(items, { omittedIds: new Set(['2']) }));
    expect(r.payload.sections.map((s) => s.key)).toEqual(['alegra:c1']);
    expect(r.availableSections.map((s) => s.key)).toEqual(['alegra:c1']);
  });

  it('si se omiten todos los artículos el catálogo queda vacío', () => {
    const items = [item('1'), item('2')];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1', '2']) }));
    expect(r.payload.sections).toEqual([]);
    expect(r.availableSections).toEqual([]);
    expect(r.report.emptyCatalog).toBe(true);
  });

  it('un sectionKeys que apunta a una sección que quedó vacía se ignora sin error', () => {
    const items = [item('1'), item('2', { categoryId: 'c2', categoryName: 'SNACKS' })];
    const r = buildCatalog(input(items, { omittedIds: new Set(['2']), sectionKeys: ['alegra:c1', 'alegra:c2'] }));
    expect(r.payload.sections.map((s) => s.key)).toEqual(['alegra:c1']);
  });

  it('con la lista vacía el catálogo es idéntico al de hoy (FR-014)', () => {
    const items = [
      item('1'),
      item('2', { soldOut: true }),
      item('3', { categoryId: null, categoryName: null }),
      item('4', { categoryId: 'c2', categoryName: 'SNACKS' }),
    ];
    const without = buildCatalog(input(items));
    expect(buildCatalog(input(items, { omittedIds: new Set() }))).toEqual(without);
    // Identificadores que no corresponden a ningún artículo (por ejemplo, ya inactivos en Alegra) tampoco cambian nada
    expect(buildCatalog(input(items, { omittedIds: new Set(['999', 'abc']) }))).toEqual(without);
  });

  it('la omisión sigue al identificador y no al nombre, precio o categoría (FR-006)', () => {
    const before = [item('1', { name: 'Ramen picante' }), item('2')];
    const after = [
      item('1', { name: 'Ramen muy picante', price: 12000, categoryId: 'c2', categoryName: 'SNACKS' }),
      item('2'),
    ];
    const omittedIds = new Set(['1']);
    expect(ids(buildCatalog(input(before, { omittedIds })))).toEqual(['2']);
    const r = buildCatalog(input(after, { omittedIds }));
    expect(r.payload.sections.map((s) => s.key)).toEqual(['alegra:c1']);
    expect(ids(r)).toEqual(['2']);
  });

  it('otro artículo con el mismo nombre pero distinto identificador sí aparece', () => {
    const items = [item('1', { name: 'Ramen' }), item('2', { name: 'Ramen' })];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1']) }));
    expect(ids(r)).toEqual(['2']);
  });

  it('un padre de variantes en la lista no cambia nada', () => {
    const items = [item('1', { type: 'variantParent' }), item('2')];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1']) }));
    expect(r).toEqual(buildCatalog(input(items)));
  });
});

describe('artículos omitidos: el informe de revisión (US2)', () => {
  it('lista los omitidos activos con su nombre, ordenados por nombre sin distinguir tildes (FR-008)', () => {
    const items = [
      item('1', { name: 'Zeta' }),
      item('2', { name: 'Álamo' }),
      item('3', { name: 'alfa' }),
      item('4', { name: 'Visible' }),
    ];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1', '2', '3']) }));
    expect(r.report.omittedByChoice).toEqual([
      { itemId: '2', name: 'Álamo' },
      { itemId: '3', name: 'alfa' },
      { itemId: '1', name: 'Zeta' },
    ]);
  });

  it('es una lista vacía cuando no hay omitidos', () => {
    const r = buildCatalog(input([item('1')]));
    expect(r.report.omittedByChoice).toEqual([]);
  });

  it('incluye a un omitido que no está en las secciones elegidas (SC-004: es el número que la persona marcó)', () => {
    const items = [item('1'), item('2', { categoryId: 'c2', categoryName: 'SNACKS' })];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1']), sectionKeys: ['alegra:c2'] }));
    expect(r.report.omittedByChoice.map((o) => o.itemId)).toEqual(['1']);
    expect(ids(r)).toEqual(['2']);
  });

  it('incluye a un omitido sin categoría ni sección asignada', () => {
    const items = [item('1', { categoryId: null, categoryName: null }), item('2')];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1']) }));
    expect(r.report.omittedByChoice.map((o) => o.itemId)).toEqual(['1']);
  });

  it('ignora identificadores que no corresponden a ningún artículo activo y a los padres de variantes', () => {
    const items = [item('1', { type: 'variantParent' }), item('2')];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1', '999']) }));
    expect(r.report.omittedByChoice).toEqual([]);
  });

  it('counts.omitted conserva su significado: los omitidos por decisión no suman, los que no tienen foto sí', () => {
    const items = [item('1'), item('2'), item('3')];
    const r = buildCatalog(
      input(items, {
        omittedIds: new Set(['2']),
        localImages: new Map([
          ['1', '/media/cache/1.jpg'],
          ['2', '/media/cache/2.jpg'],
          ['3', null],
        ]),
      }),
    );
    expect(r.report.counts).toEqual({ included: 1, omitted: 1, soldOut: 0 });
    expect(r.report.omittedByChoice).toHaveLength(1);
  });
});

describe('artículos omitidos: coherencia con las demás reglas (US3)', () => {
  const noCategory = { categoryId: null, categoryName: null };

  it('un omitido sin categoría no cuenta como pendiente: ni uncategorized ni omittedNoSection (FR-009)', () => {
    const r = buildCatalog(input([item('1', noCategory), item('2')], { omittedIds: new Set(['1']) }));
    expect(r.report.uncategorized).toEqual([]);
    expect(r.report.omittedNoSection).toEqual([]);
    expect(r.report.counts.omitted).toBe(0);
  });

  it('un omitido sin categoría con una sección asignada tampoco', () => {
    const r = buildCatalog(
      input([item('1', noCategory)], { omittedIds: new Set(['1']), overrides: new Map([['1', 'alegra:c2']]) }),
    );
    expect(r.report.uncategorized).toEqual([]);
    expect(r.report.omittedNoSection).toEqual([]);
    expect(r.payload.sections).toEqual([]);
  });

  it('un omitido sin foto no se informa como sin imagen ni como foto no obtenida', () => {
    const items = [item('1'), item('2')];
    const r = buildCatalog(
      input(items, {
        omittedIds: new Set(['2']),
        localImages: new Map([['1', '/media/cache/1.jpg']]),
        photoFailures: new Map([['2', 'unauthorized']]),
      }),
    );
    expect(r.report.omittedNoImage).toEqual([]);
    expect(r.report.photos.notObtained).toEqual([]);
    expect(r.report.counts.omitted).toBe(0);
  });

  it('los omitidos no cuentan como fotos informadas: no se dispara «no se pudo obtener ninguna foto»', () => {
    const items = [item('1'), item('2')];
    const base = { localImages: new Map<string, string | null>(), photoFailures: new Map([['1', 'timeout' as const], ['2', 'timeout' as const]]) };
    // Control: sin omitir, ninguna de las dos fotos se obtuvo
    expect(buildCatalog(input(items, base)).report.photos.allFailed).toBe(true);
    // Omitiéndolas, ya no hay fotos informadas y no hay ningún problema general que avisar
    const r = buildCatalog(input(items, { ...base, omittedIds: new Set(['1', '2']) }));
    expect(r.report.photos).toEqual({ informed: 0, obtained: 0, notObtained: [], allFailed: false });
  });

  it('un omitido agotado no suma a counts.soldOut', () => {
    const items = [item('1', { soldOut: true }), item('2', { soldOut: true })];
    const r = buildCatalog(input(items, { omittedIds: new Set(['1']) }));
    expect(r.report.counts.soldOut).toBe(1);
  });

  it('ocultar agotados no cambia lo que ya estaba omitido', () => {
    const items = [item('1', { soldOut: true }), item('2')];
    const r = buildCatalog(input(items, { omittedIds: new Set(['2']), hideSoldOut: true }));
    expect(r.payload.sections).toEqual([]);
    expect(r.report.omittedByChoice.map((o) => o.itemId)).toEqual(['2']);
  });
});

describe('artículos omitidos: los combos no cambian (FR-011)', () => {
  const alegra = (id: string, name: string, price: number, soldOut = false): NormalizedItem =>
    item(id, { name, price, soldOut });
  const items = () => [alegra('1', 'Shin', 9000), alegra('2', 'Champong', 9000, true), alegra('3', 'Kimchi', 12000)];
  const bundle = (productIds: string[]) => ({
    id: 'b1',
    sectionKey: 'custom:r',
    name: 'Combo b1',
    description: 'Regalo',
    imageUrl: '/media/uploads/b1.png',
    pricing: { type: 'discount' as const, percent: 10 },
    components: productIds.map((p) => ({ source: 'alegra' as const, productId: p, quantity: 1 })),
  });
  const withBundle = (productIds: string[], over: Partial<BuilderInput> = {}) =>
    buildCatalog(
      input(items(), {
        customSections: [{ key: 'custom:r', name: 'REGALOS', products: [] }],
        bundles: [bundle(productIds)],
        ...over,
      }),
    );
  const bundleItem = (r: ReturnType<typeof buildCatalog>) =>
    r.payload.sections.find((s) => s.key === 'custom:r')!.pages.flat()[0]!;

  it('un componente disponible que se omite deja el combo exactamente igual y sin alerta nueva', () => {
    const before = withBundle(['1', '3']);
    const after = withBundle(['1', '3'], { omittedIds: new Set(['1']) });
    expect(bundleItem(after)).toEqual(bundleItem(before));
    expect(bundleItem(after)).toMatchObject({ kind: 'bundle', soldOut: false, priceLabel: '$18.900' });
    expect(after.report.soldOutBundles).toEqual([]);
    // El artículo omitido sigue fuera de su propia sección
    expect(after.payload.sections.find((s) => s.key === 'alegra:c1')!.pages.flat().map((i) => i.id)).toEqual(['2', '3']);
  });

  it('un componente agotado en Alegra mantiene su alerta aunque se omita: omitir no cambia el stock', () => {
    const before = withBundle(['1', '2']);
    const after = withBundle(['1', '2'], { omittedIds: new Set(['2']) });
    expect(before.report.soldOutBundles).toHaveLength(1);
    expect(after.report.soldOutBundles).toEqual(before.report.soldOutBundles);
    expect(bundleItem(after)).toEqual(bundleItem(before));
  });

  it('un componente que ya no existe en Alegra sigue siendo «Producto no disponible»', () => {
    const before = withBundle(['1', '999']);
    const after = withBundle(['1', '999'], { omittedIds: new Set(['1']) });
    expect(bundleItem(after)).toEqual(bundleItem(before));
    expect(after.report.soldOutBundles).toEqual(before.report.soldOutBundles);
  });
});
