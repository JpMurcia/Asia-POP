import { describe, expect, it } from 'vitest';
import { buildCatalog, type BuilderInput } from '../../src/catalog/catalog-builder';
import { productSchema } from '../../src/custom/custom-product.repo';

const config = { storeName: 'X', phone1: '1', phone2: '2', address: 'a', coverTitle: 'c' };

const input = (over: Partial<BuilderInput>): BuilderInput => ({
  config,
  terms: [],
  categories: [],
  items: [],
  localImages: new Map(),
  overrides: new Map(),
  sectionOrder: [],
  ...over,
});

describe('validación de productos propios', () => {
  const base = { sectionId: 's1', name: 'Caja de mochis', description: '' };

  it('acepta un precio fijo', () => {
    expect(productSchema.safeParse({ ...base, price: 8000 }).success).toBe(true);
  });
  it('acepta solo opciones con precio', () => {
    const r = productSchema.safeParse({ ...base, options: [{ label: 'Caja x 6 UND', price: 30000, maxFlavors: 2 }] });
    expect(r.success).toBe(true);
  });
  it('rechaza si no hay ni precio ni opciones', () => {
    expect(productSchema.safeParse(base).success).toBe(false);
    expect(productSchema.safeParse({ ...base, options: [] }).success).toBe(false);
  });
  it('rechaza precios negativos o decimales y nombres vacíos', () => {
    expect(productSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, price: 10.5 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, name: '  ', price: 1 }).success).toBe(false);
  });
  it('maxFlavors debe ser entero positivo', () => {
    const r = productSchema.safeParse({ ...base, options: [{ label: 'x', price: 1, maxFlavors: 0 }] });
    expect(r.success).toBe(false);
  });
});

describe('secciones propias en el catálogo', () => {
  const mochis = (products: NonNullable<BuilderInput['customSections']>[number]['products']) =>
    input({
      customSections: [{ key: 'custom:m1', name: 'MOCHIS', introText: '¿Qué es el mochi?', products }],
    });

  it('incluye productos con opciones, sabores y precios formateados, sin sello AGOTADO', () => {
    const { payload } = buildCatalog(
      mochis([
        {
          id: 'p1',
          name: 'Caja de mochis',
          description: 'Rellenos de crema',
          imageUrl: '/media/uploads/a.png',
          price: null,
          options: [
            { label: 'Caja x 6 UND', price: 30000, maxFlavors: 2 },
            { label: 'Caja x 12 UND', price: 50000, maxFlavors: 4 },
          ],
          flavors: ['FRESA', 'MANGO'],
        },
      ]),
    );
    const section = payload.sections[0]!;
    expect(section).toMatchObject({ name: 'MOCHIS', source: 'custom', introText: '¿Qué es el mochi?' });
    const item = section.pages[0]![0]!;
    expect(item.kind).toBe('custom');
    expect(item).not.toHaveProperty('soldOut');
    if (item.kind === 'custom') {
      expect(item.options).toEqual([
        { label: 'Caja x 6 UND', priceLabel: '$30.000', maxFlavors: 2 },
        { label: 'Caja x 12 UND', priceLabel: '$50.000', maxFlavors: 4 },
      ]);
      expect(item.flavors).toEqual(['FRESA', 'MANGO']);
    }
  });

  it('mantiene el orden definido por el usuario (no alfabético)', () => {
    const p = (id: string, name: string) => ({
      id,
      name,
      description: '',
      imageUrl: `/media/uploads/${id}.png`,
      price: 1000,
    });
    const { payload } = buildCatalog(mochis([p('1', 'Zeta'), p('2', 'Alfa')]));
    expect(payload.sections[0]!.pages[0]!.map((i) => i.name)).toEqual(['Zeta', 'Alfa']);
  });

  it('omite productos propios sin imagen y los informa', () => {
    const { payload, report } = buildCatalog(
      mochis([
        { id: '1', name: 'Con imagen', description: '', imageUrl: '/media/uploads/1.png', price: 1000 },
        { id: '2', name: 'Sin imagen', description: '', imageUrl: null, price: 1000 },
      ]),
    );
    expect(payload.sections[0]!.pages.flat().map((i) => i.id)).toEqual(['1']);
    expect(report.omittedNoImage).toEqual([{ source: 'custom', id: '2', name: 'Sin imagen' }]);
    expect(report.counts.omitted).toBe(1);
  });

  it('una sección propia sin productos elegibles no genera portada', () => {
    const { payload } = buildCatalog(mochis([]));
    expect(payload.sections).toHaveLength(0);
  });

  it('respeta el orden global de secciones junto con las de Alegra', () => {
    const { payload } = buildCatalog(
      input({
        categories: [{ id: 'c1', name: 'RAMEN' }],
        items: [
          {
            id: 'a',
            name: 'Ramen A',
            description: '',
            price: 9000,
            remoteImageUrl: 'https://x/a.jpg',
            soldOut: false,
            categoryId: 'c1',
            categoryName: 'RAMEN',
            type: 'simple',
          },
        ],
        localImages: new Map([['a', '/media/cache/a.jpg']]),
        customSections: [
          {
            key: 'custom:m1',
            name: 'MOCHIS',
            products: [{ id: 'p', name: 'P', description: '', imageUrl: '/media/uploads/p.png', price: 1 }],
          },
        ],
        sectionOrder: ['custom:m1', 'alegra:c1'],
      }),
    );
    expect(payload.sections.map((s) => s.name)).toEqual(['MOCHIS', 'RAMEN']);
  });

  it('un ítem de Alegra sin categoría puede asignarse a una sección propia', () => {
    const { payload } = buildCatalog(
      input({
        items: [
          {
            id: 'x',
            name: 'Suelto',
            description: '',
            price: 800,
            remoteImageUrl: 'https://x/x.jpg',
            soldOut: false,
            categoryId: null,
            categoryName: null,
            type: 'simple',
          },
        ],
        localImages: new Map([['x', '/media/cache/x.jpg']]),
        overrides: new Map([['x', 'custom:m1']]),
        customSections: [{ key: 'custom:m1', name: 'REGALOS', products: [] }],
      }),
    );
    expect(payload.sections.map((s) => s.name)).toEqual(['REGALOS']);
    expect(payload.sections[0]!.pages[0]![0]).toMatchObject({ kind: 'alegra', id: 'x' });
  });
});
