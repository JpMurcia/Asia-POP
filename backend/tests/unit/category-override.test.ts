import { describe, expect, it } from 'vitest';
import type { NormalizedItem } from '../../src/alegra/alegra.mapper';
import { buildCatalog } from '../../src/catalog/catalog-builder';
import { OverrideRepo } from '../../src/custom/override.repo';
import { openDatabase } from '../../src/db/database';

const config = { storeName: 'X', phone1: '1', phone2: '2', address: 'a', coverTitle: 'c' };
const noCat = (id: string): NormalizedItem => ({
  id,
  name: `Producto ${id}`,
  description: '',
  price: 5000,
  remoteImageUrl: 'https://x.co/a.jpg',
  soldOut: false,
  categoryId: null,
  categoryName: null,
  type: 'simple',
});
const base = (items: NormalizedItem[], overrides: Map<string, string>) => ({
  config,
  terms: [],
  categories: [{ id: 'c1', name: 'SNACKS' }],
  items,
  localImages: new Map(items.map((i) => [i.id, `/media/cache/${i.id}.jpg`])),
  overrides,
  sectionOrder: [],
});

describe('overrides de categoría', () => {
  it('un ítem sin categoría con override aparece en esa sección', () => {
    const { payload, report } = buildCatalog(base([noCat('1')], new Map([['1', 'alegra:c1']])));
    expect(payload.sections[0]!.name).toBe('SNACKS');
    expect(payload.sections[0]!.pages.flat().map((i) => i.id)).toEqual(['1']);
    // sigue figurando como "sin categoría" en Alegra, pero ya no se omite
    expect(report.uncategorized).toHaveLength(1);
    expect(report.omittedNoSection).toHaveLength(0);
  });

  it('sin override queda fuera y se informa', () => {
    const { payload, report } = buildCatalog(base([noCat('1')], new Map()));
    expect(payload.sections).toHaveLength(0);
    expect(report.omittedNoSection).toEqual([{ itemId: '1', name: 'Producto 1' }]);
  });

  it('un override que apunta a una sección inexistente se trata como sin sección', () => {
    const { report } = buildCatalog(base([noCat('1')], new Map([['1', 'custom:borrada']])));
    expect(report.omittedNoSection).toHaveLength(1);
  });

  it('el override no cambia la categoría de ítems que ya tienen una', () => {
    const item: NormalizedItem = { ...noCat('1'), categoryId: 'c1', categoryName: 'SNACKS' };
    const { report } = buildCatalog(base([item], new Map([['1', 'alegra:otra']])));
    expect(report.uncategorized).toHaveLength(0);
  });

  it('el repositorio guarda, reemplaza, lee y elimina', () => {
    const repo = new OverrideRepo(openDatabase(':memory:'));
    repo.set('1', 'alegra:c1');
    repo.set('1', 'alegra:c2');
    expect(repo.get('1')).toBe('alegra:c2');
    expect([...repo.all().entries()]).toEqual([['1', 'alegra:c2']]);
    repo.remove('1');
    expect(repo.get('1')).toBeNull();
  });
});
