import { describe, expect, it } from 'vitest';
import type { NormalizedItem } from '../../src/alegra/alegra.mapper';
import { buildCatalog, type BuilderInput } from '../../src/catalog/catalog-builder';

const config = { storeName: 'X', phone1: '1', phone2: '2', address: 'a', coverTitle: 'c' };
const alegra = (id: string, name: string, price: number, soldOut = false): NormalizedItem => ({
  id,
  name,
  description: '',
  price,
  remoteImageUrl: 'https://x/a.jpg',
  soldOut,
  categoryId: 'c1',
  categoryName: 'RAMEN',
  type: 'simple',
});

function input(over: Partial<BuilderInput> = {}): BuilderInput {
  const items = [alegra('1', 'Shin', 9000), alegra('2', 'Champong', 9000, true), alegra('3', 'Kimchi', 12000)];
  return {
    config,
    terms: [],
    categories: [{ id: 'c1', name: 'RAMEN' }],
    items,
    localImages: new Map(items.map((i) => [i.id, `/media/cache/${i.id}.jpg`])),
    overrides: new Map(),
    sectionOrder: [],
    customSections: [{ key: 'custom:r', name: 'REGALOS', products: [] }],
    ...over,
  };
}

const bundle = (id: string, productIds: string[], over = {}) => ({
  id,
  sectionKey: 'custom:r',
  name: `Combo ${id}`,
  description: 'Regalo',
  imageUrl: `/media/uploads/${id}.png`,
  pricing: { type: 'discount' as const, percent: 10 },
  components: productIds.map((p) => ({ source: 'alegra' as const, productId: p, quantity: 1 })),
  ...over,
});

const regalos = (r: ReturnType<typeof buildCatalog>) => r.payload.sections.find((s) => s.name === 'REGALOS');

describe('combos con componentes agotados (FR-025/026)', () => {
  it('un combo con todo disponible sale normal, con precio con descuento', () => {
    const r = buildCatalog(input({ bundles: [bundle('b1', ['1', '3'])] }));
    const item = regalos(r)!.pages[0]![0]!;
    expect(item).toMatchObject({ kind: 'bundle', soldOut: false, priceLabel: '$18.900' });
    expect(r.report.soldOutBundles).toEqual([]);
    // Solo cuenta el producto suelto agotado (Champong); el combo no suma
    expect(r.report.counts.soldOut).toBe(1);
  });

  it('con un componente agotado se alerta y, sin decisión, se muestra provisionalmente con sello', () => {
    const r = buildCatalog(input({ bundles: [bundle('b1', ['1', '2'])] }));
    expect(r.report.soldOutBundles).toEqual([
      { bundleId: 'b1', name: 'Combo b1', soldOutComponents: ['Champong'] },
    ]);
    expect(regalos(r)!.pages[0]![0]).toMatchObject({ kind: 'bundle', soldOut: true });
  });

  it('decisión "keep": se mantiene con sello AGOTADO y cuenta como agotado', () => {
    const r = buildCatalog(input({ bundles: [bundle('b1', ['1', '2'])], decisions: { b1: 'keep' } }));
    expect(regalos(r)!.pages[0]![0]).toMatchObject({ soldOut: true });
    expect(r.report.counts.soldOut).toBe(2); // Champong suelto + el combo
  });

  it('decisión "omit": no aparece en el catálogo (y la sección vacía no genera portada)', () => {
    const r = buildCatalog(input({ bundles: [bundle('b1', ['1', '2'])], decisions: { b1: 'omit' } }));
    expect(regalos(r)).toBeUndefined();
    expect(r.report.counts.included).toBe(3); // Shin, Champong y Kimchi: sin el combo
  });

  it('un componente de Alegra que ya no está activo o fue eliminado cuenta como no disponible', () => {
    const r = buildCatalog(input({ bundles: [bundle('b1', ['1', '999'])] }));
    expect(r.report.soldOutBundles[0]!.soldOutComponents).toEqual(['Producto no disponible']);
    expect(regalos(r)!.pages[0]![0]).toMatchObject({ soldOut: true });
  });

  it('un combo sin imagen se omite y se informa; no pide decisión aunque tenga agotados', () => {
    const r = buildCatalog(input({ bundles: [bundle('b1', ['2'], { imageUrl: null })] }));
    expect(regalos(r)).toBeUndefined();
    expect(r.report.omittedNoImage).toEqual([{ source: 'bundle', id: 'b1', name: 'Combo b1' }]);
    expect(r.report.soldOutBundles).toEqual([]);
  });

  it('componentes propios: nunca agotados; precio tomado del producto o de su primera opción', () => {
    const r = buildCatalog(
      input({
        customSections: [
          {
            key: 'custom:r',
            name: 'REGALOS',
            products: [
              { id: 'p1', name: 'Mochi', description: '', imageUrl: '/media/uploads/p1.png', price: null, options: [{ label: 'x6', price: 30000 }] },
            ],
          },
        ],
        bundles: [
          bundle('b1', [], {
            pricing: { type: 'discount', percent: 10 },
            components: [{ source: 'custom', productId: 'p1', quantity: 1 }],
          }),
        ],
      }),
    );
    expect(regalos(r)!.pages[0]!.find((i) => i.kind === 'bundle')).toMatchObject({ priceLabel: '$27.000', soldOut: false });
  });

  it('precio fijo: se muestra el fijo aunque haya componentes agotados', () => {
    const r = buildCatalog(
      input({ bundles: [bundle('b1', ['1', '2'], { pricing: { type: 'fixed', price: 15000 } })], decisions: { b1: 'keep' } }),
    );
    expect(regalos(r)!.pages[0]![0]).toMatchObject({ priceLabel: '$15.000' });
  });

  it('lista los componentes con cantidad en la tarjeta', () => {
    const r = buildCatalog(
      input({
        bundles: [
          bundle('b1', [], { components: [{ source: 'alegra', productId: '1', quantity: 2 }, { source: 'alegra', productId: '3', quantity: 1 }] }),
        ],
      }),
    );
    const item = regalos(r)!.pages[0]![0]!;
    expect(item.kind === 'bundle' && item.components).toEqual([
      { name: 'Shin', quantity: 2 },
      { name: 'Kimchi', quantity: 1 },
    ]);
  });
});
