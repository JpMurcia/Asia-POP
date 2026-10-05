import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../src/catalog/template-presets';
import type { CatalogItem, CatalogPayload } from '../../src/catalog/types';
import { collectPhotoUrls, withPhotoVariants, type PhotoVariants } from '../../src/pdf/photo-variants';

const alegra = (id: string, imageUrl: string, over: Partial<CatalogItem> = {}): CatalogItem =>
  ({ kind: 'alegra', id, name: `Producto ${id}`, description: 'desc', priceLabel: '$9.000', imageUrl, soldOut: false, ...over }) as CatalogItem;

const custom = (id: string, imageUrl: string): CatalogItem => ({
  kind: 'custom',
  id,
  name: `Propio ${id}`,
  description: 'caja',
  imageUrl,
  priceLabel: '$30.000',
  options: [{ label: 'Caja de 6', priceLabel: '$30.000', maxFlavors: 3 }],
  flavors: ['Fresa', 'Té verde'],
});

const bundle = (id: string, imageUrl: string): CatalogItem => ({
  kind: 'bundle',
  id,
  name: `Combo ${id}`,
  description: 'regalo',
  imageUrl,
  priceLabel: '$40.000',
  components: [{ name: 'Champong', quantity: 1 }],
  soldOut: true,
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

const payload = (): CatalogPayload =>
  ({
    config: { coverTitle: 'Catálogo de productos' },
    template: baseTemplate('neon'),
    sections: [
      {
        key: 'alegra:c1',
        name: 'RAMEN',
        source: 'alegra',
        pages: [
          [alegra('1', '/media/cache/aaa.png'), alegra('2', '/media/cache/bbb.jpg', { soldOut: true }), alegra('3', '/media/cache/aaa.png')],
          [alegra('4', '/media/cache/ccc.webp')],
        ],
      },
      {
        key: 'custom:s1',
        name: 'MOCHIS',
        source: 'custom',
        introText: 'Postre japonés',
        pages: [[custom('9', '/media/uploads/u-1.png'), bundle('b1', '/media/uploads/u-2.jpg')]],
      },
    ],
    terms: [{ title: 'Pedidos', body: 'Bajo pedido' }],
    generatedAt: '2026-10-04T12:00:00.000Z',
  }) as unknown as CatalogPayload;

describe('collectPhotoUrls', () => {
  it('devuelve sin repetir las direcciones locales de las fotos de todas las secciones y páginas', () => {
    expect(collectPhotoUrls(payload()).sort()).toEqual([
      '/media/cache/aaa.png',
      '/media/cache/bbb.jpg',
      '/media/cache/ccc.webp',
      '/media/uploads/u-1.png',
      '/media/uploads/u-2.jpg',
    ]);
  });

  it('ignora lo que no es una foto local: vacías, remotas, data: y recursos de la aplicación', () => {
    const p = payload();
    p.sections[0]!.pages = [
      [alegra('1', ''), alegra('2', 'https://cdn.example.com/a.png'), alegra('3', 'data:image/png;base64,AAAA')],
      [alegra('4', '/assets/placeholder.png'), alegra('5', '/media/pdf/run/x.jpg'), alegra('6', '/media/cache/ok.png')],
    ];
    p.sections[1]!.pages = [];
    expect(collectPhotoUrls(p)).toEqual(['/media/cache/ok.png']);
  });

  it('un payload sin secciones no tiene fotos', () => {
    expect(collectPhotoUrls({ ...payload(), sections: [] })).toEqual([]);
  });
});

describe('withPhotoVariants', () => {
  const variants: PhotoVariants = new Map([
    ['/media/cache/aaa.png', '/media/pdf/run1/1111.jpg'],
    ['/media/uploads/u-1.png', '/media/pdf/run1/2222.png'],
    ['/media/uploads/u-2.jpg', '/media/pdf/run1/3333.jpg'],
  ]);

  it('reemplaza solo las imageUrl que tienen copia, en los tres tipos de ítem, y deja las demás igual', () => {
    const out = withPhotoVariants(payload(), variants);
    const urls = out.sections.flatMap((s) => s.pages.flat()).map((i) => [i.id, i.imageUrl]);
    expect(urls).toEqual([
      ['1', '/media/pdf/run1/1111.jpg'],
      ['2', '/media/cache/bbb.jpg'], // sin copia: conserva su dirección
      ['3', '/media/pdf/run1/1111.jpg'], // la misma foto en otro producto
      ['4', '/media/cache/ccc.webp'],
      ['9', '/media/pdf/run1/2222.png'],
      ['b1', '/media/pdf/run1/3333.jpg'],
    ]);
  });

  it('no muta el payload recibido', () => {
    const frozen = deepFreeze(payload());
    expect(() => withPhotoVariants(frozen, variants)).not.toThrow();
    expect(collectPhotoUrls(frozen)).toContain('/media/cache/aaa.png');
  });

  it('todo lo demás queda idéntico (FR-005): plantilla, textos, precios, agotados, componentes, opciones y términos', () => {
    const original = payload();
    const out = withPhotoVariants(original, variants);
    // Volver a poner las direcciones originales debe dar exactamente el payload de partida
    const inverse = new Map([...variants].map(([from, to]) => [to, from]));
    expect(withPhotoVariants(out, inverse)).toEqual(original);
    expect(out.template).toEqual(original.template);
    expect(out.terms).toEqual(original.terms);
    expect(out.generatedAt).toBe(original.generatedAt);
    expect(out.sections.map((s) => [s.key, s.name, s.source, s.introText])).toEqual(
      original.sections.map((s) => [s.key, s.name, s.source, s.introText]),
    );
    const flat = out.sections.flatMap((s) => s.pages.flat());
    expect(flat.find((i) => i.id === '2')).toMatchObject({ soldOut: true, priceLabel: '$9.000' });
    expect(flat.find((i) => i.id === '9')).toMatchObject({ flavors: ['Fresa', 'Té verde'], options: [{ label: 'Caja de 6' }] });
    expect(flat.find((i) => i.id === 'b1')).toMatchObject({ components: [{ name: 'Champong', quantity: 1 }], soldOut: true });
  });

  it('con un mapa vacío devuelve un payload igual al original', () => {
    const original = payload();
    expect(withPhotoVariants(original, new Map())).toEqual(original);
  });
});
