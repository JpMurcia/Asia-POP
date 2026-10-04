import { describe, expect, it } from 'vitest';
import type { NormalizedItem } from '../../src/alegra/alegra.mapper';
import { buildCatalog, type BuilderInput } from '../../src/catalog/catalog-builder';
import { computeStructure } from '../../src/catalog/structure';

const config = { storeName: 'X', phone1: '1', phone2: '2', address: 'a', coverTitle: 'c' };

const alegra = (id: string, cat: string, over: Partial<NormalizedItem> = {}): NormalizedItem => ({
  id,
  name: `Producto ${id}`,
  description: '',
  price: 9000,
  remoteImageUrl: 'https://x/a.jpg',
  soldOut: false,
  categoryId: cat,
  categoryName: cat.toUpperCase(),
  type: 'simple',
  ...over,
});

/** `n` productos en la categoría `cat`. */
const many = (cat: string, n: number, start = 1) =>
  Array.from({ length: n }, (_, i) => alegra(`${cat}-${start + i}`, cat));

function build(items: NormalizedItem[], over: Partial<BuilderInput> = {}) {
  return buildCatalog({
    config,
    terms: [{ title: 'T', body: 'b' }],
    categories: [...new Set(items.map((i) => i.categoryId!))].map((id) => ({ id, name: id.toUpperCase() })),
    items,
    localImages: new Map(items.map((i) => [i.id, `/media/cache/${i.id}.jpg`])),
    overrides: new Map(),
    sectionOrder: [],
    ...over,
  });
}

describe('computeStructure', () => {
  it.each([
    [1, 1],
    [3, 1],
    [4, 2],
    [7, 3],
  ])('una sección con %i productos ocupa %i páginas de producto', (n, pages) => {
    const s = computeStructure(build(many('a', n)).payload);
    expect(s.productPages).toBe(pages);
    expect(s.sections).toEqual([{ key: 'alegra:a', name: 'A', source: 'alegra', items: n, pages }]);
  });

  it('suma portada general, una portada por sección, páginas de producto y políticas', () => {
    const items = [...many('a', 4), ...many('b', 1)];
    const s = computeStructure(build(items).payload);
    expect(s).toMatchObject({
      coverPages: 1,
      sectionCoverPages: 2,
      productPages: 3,
      termsPages: 1,
      totalPages: 1 + 2 + 3 + 1,
      nothingToGenerate: false,
    });
  });

  it('sin secciones (0 productos) no hay nada que generar y todo queda en cero', () => {
    const s = computeStructure(build([]).payload);
    expect(s).toEqual({
      coverPages: 0,
      sectionCoverPages: 0,
      productPages: 0,
      termsPages: 0,
      ownItems: 0,
      totalPages: 0,
      nothingToGenerate: true,
      sections: [],
    });
  });

  it('una selección vacía deja la estructura en cero aunque haya productos', () => {
    const s = computeStructure(build(many('a', 5), { sectionKeys: [] }).payload);
    expect(s.nothingToGenerate).toBe(true);
    expect(s.totalPages).toBe(0);
  });

  it('las secciones excluidas no cuentan', () => {
    const items = [...many('a', 4), ...many('b', 3)];
    const all = computeStructure(build(items).payload);
    const only = computeStructure(build(items, { sectionKeys: ['alegra:b'] }).payload);
    expect(all.totalPages).toBe(1 + 2 + 3 + 1);
    expect(only).toMatchObject({ sectionCoverPages: 1, productPages: 1, totalPages: 1 + 1 + 1 + 1 });
  });

  it('ocultar agotados reduce páginas', () => {
    const items = [alegra('1', 'a'), alegra('2', 'a', { soldOut: true }), alegra('3', 'a'), alegra('4', 'a', { soldOut: true })];
    expect(computeStructure(build(items).payload).productPages).toBe(2);
    expect(computeStructure(build(items, { hideSoldOut: true }).payload).productPages).toBe(1);
  });

  it('sin políticas no hay página de políticas', () => {
    const s = computeStructure(build(many('a', 2), { terms: [] }).payload);
    expect(s.termsPages).toBe(0);
    expect(s.totalPages).toBe(1 + 1 + 1);
  });

  it('cuenta productos propios y combos como contenido propio', () => {
    const items = many('a', 1);
    const r = build(items, {
      customSections: [
        {
          key: 'custom:m',
          name: 'MOCHIS',
          products: [
            { id: 'p1', name: 'Mochi', description: '', imageUrl: '/u/p1.png', price: 5000 },
            { id: 'p2', name: 'Caja', description: '', imageUrl: '/u/p2.png', price: 8000 },
          ],
        },
      ],
      bundles: [
        {
          id: 'b1',
          sectionKey: 'custom:m',
          name: 'Combo',
          description: '',
          imageUrl: '/u/b1.png',
          pricing: { type: 'fixed', price: 10000 },
          components: [{ source: 'alegra', productId: 'a-1', quantity: 1 }],
        },
      ],
    });
    const s = computeStructure(r.payload);
    expect(s.ownItems).toBe(3);
    expect(s.sections.find((x) => x.key === 'custom:m')).toMatchObject({ items: 3, pages: 1 });
  });
});
