import { describe, expect, it } from 'vitest';
import type { NormalizedItem } from '../../src/alegra/alegra.mapper';
import { buildCatalog, type BuilderInput } from '../../src/catalog/catalog-builder';
import type { PhotoFailureReason } from '../../src/catalog/types';

const config = { storeName: 'ASIANPOP', phone1: '1', phone2: '2', address: 'x', coverTitle: 'Catálogo' };

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
  ...over,
});

describe('catalog-builder', () => {
  it('agrupa por categoría, formatea precio y pagina de a 3', () => {
    const items = ['1', '2', '3', '4'].map((id) => item(id));
    const { payload, report } = buildCatalog(input(items));
    expect(payload.sections).toHaveLength(1);
    expect(payload.sections[0]!.name).toBe('RAMEN');
    expect(payload.sections[0]!.pages.map((p) => p.length)).toEqual([3, 1]);
    expect(payload.sections[0]!.pages[0]![0]).toMatchObject({ priceLabel: '$9.000' });
    expect(report.counts.included).toBe(4);
  });

  it('omite categorías sin productos elegibles (sin portada)', () => {
    const { payload } = buildCatalog(input([item('1')]));
    expect(payload.sections.map((s) => s.key)).toEqual(['alegra:c1']);
  });

  it('omite ítems sin imagen y los lista en el informe', () => {
    const items = [item('1'), item('2')];
    const { payload, report } = buildCatalog(
      input(items, { localImages: new Map([['1', '/media/cache/1.jpg'], ['2', null]]) }),
    );
    expect(payload.sections[0]!.pages.flat().map((i) => i.id)).toEqual(['1']);
    expect(report.omittedNoImage).toEqual([{ source: 'alegra', id: '2', name: 'Producto 2' }]);
    expect(report.counts.omitted).toBe(1);
  });

  it('un ítem cuya descarga de imagen falló (sin entrada) también se omite', () => {
    const { report } = buildCatalog(input([item('1')], { localImages: new Map() }));
    expect(report.omittedNoImage).toHaveLength(1);
    expect(report.emptyCatalog).toBe(true);
  });

  it('marca AGOTADO y cuenta; con hideSoldOut los oculta', () => {
    const items = [item('1', { soldOut: true }), item('2')];
    const shown = buildCatalog(input(items));
    expect(shown.payload.sections[0]!.pages.flat().find((i) => i.id === '1')).toMatchObject({ soldOut: true });
    expect(shown.report.counts.soldOut).toBe(1);
    const hidden = buildCatalog(input(items, { hideSoldOut: true }));
    expect(hidden.payload.sections[0]!.pages.flat().map((i) => i.id)).toEqual(['2']);
  });

  it('ordena secciones según sectionOrder y el resto por nombre', () => {
    const items = [item('1'), item('2', { categoryId: 'c2', categoryName: 'SNACKS' })];
    const { payload } = buildCatalog(input(items, { sectionOrder: ['alegra:c2', 'alegra:c1'] }));
    expect(payload.sections.map((s) => s.name)).toEqual(['SNACKS', 'RAMEN']);
    const dflt = buildCatalog(input(items));
    expect(dflt.payload.sections.map((s) => s.name)).toEqual(['RAMEN', 'SNACKS']);
  });

  it('filtra por sectionKeys', () => {
    const items = [item('1'), item('2', { categoryId: 'c2', categoryName: 'SNACKS' })];
    const { payload } = buildCatalog(input(items, { sectionKeys: ['alegra:c2'] }));
    expect(payload.sections.map((s) => s.name)).toEqual(['SNACKS']);
  });

  it('ignora los padres de variantes', () => {
    const { payload } = buildCatalog(input([item('1', { type: 'variantParent' }), item('2')]));
    expect(payload.sections[0]!.pages.flat().map((i) => i.id)).toEqual(['2']);
  });

  it('crea la sección con el nombre del ítem si la categoría no vino en el listado', () => {
    const items = [item('1', { categoryId: 'x9', categoryName: 'NUEVA' })];
    const { payload } = buildCatalog(input(items));
    expect(payload.sections[0]!.name).toBe('NUEVA');
  });

  it('ítems sin categoría y sin override quedan fuera e informados', () => {
    const { payload, report } = buildCatalog(input([item('1', { categoryId: null, categoryName: null })]));
    expect(payload.sections).toHaveLength(0);
    expect(report.uncategorized).toHaveLength(1);
    expect(report.omittedNoSection).toHaveLength(1);
  });
});

describe('informe de fotos (report.photos)', () => {
  const noPhoto = { remoteImageUrl: null, imageUrls: [] as string[] };
  const photoReport = (items: NormalizedItem[], local: [string, string | null][], failures: [string, PhotoFailureReason][] = [], over: Partial<BuilderInput> = {}) =>
    buildCatalog(input(items, { localImages: new Map(local), photoFailures: new Map(failures), ...over })).report;

  it('separa los productos con foto obtenida, con foto no obtenida (con motivo) y sin foto en Alegra', () => {
    const items = [item('1'), item('2'), item('3', noPhoto)];
    const report = photoReport(items, [['1', '/media/cache/1.jpg'], ['2', null], ['3', null]], [['2', 'unauthorized']]);
    expect(report.photos).toEqual({
      informed: 2,
      obtained: 1,
      notObtained: [{ id: '2', name: 'Producto 2', reason: 'unauthorized' }],
      allFailed: false,
    });
  });

  it('omittedNoImage y counts.omitted no cambian: los de foto no obtenida siguen contando como omitidos', () => {
    const items = [item('1'), item('2'), item('3', noPhoto)];
    const report = photoReport(items, [['1', '/media/cache/1.jpg'], ['2', null], ['3', null]], [['2', 'timeout']]);
    expect(report.omittedNoImage).toEqual([
      { source: 'alegra', id: '2', name: 'Producto 2' },
      { source: 'alegra', id: '3', name: 'Producto 3' },
    ]);
    expect(report.counts).toMatchObject({ included: 1, omitted: 2 });
  });

  it('un producto sin direcciones de foto no entra en notObtained ni en informed', () => {
    const report = photoReport([item('1', noPhoto)], [['1', null]]);
    expect(report.photos).toEqual({ informed: 0, obtained: 0, notObtained: [], allFailed: false });
  });

  it('allFailed: hay fotos informadas y ninguna se obtuvo', () => {
    const items = [item('1'), item('2')];
    const report = photoReport(items, [['1', null], ['2', null]], [['1', 'unauthorized'], ['2', 'unauthorized']]);
    expect(report.photos.allFailed).toBe(true);
    expect(report.photos).toMatchObject({ informed: 2, obtained: 0 });
    expect(report.photos.notObtained.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('allFailed es falso si ningún producto trae foto o si alguna se obtuvo', () => {
    expect(photoReport([item('1', noPhoto)], [['1', null]]).photos.allFailed).toBe(false);
    expect(photoReport([item('1'), item('2')], [['1', '/media/cache/1.jpg'], ['2', null]], [['2', 'not_found']]).photos.allFailed).toBe(false);
  });

  it('notObtained respeta las secciones seleccionadas, pero allFailed se calcula sobre todos los productos', () => {
    const items = [item('1'), item('2', { categoryId: 'c2', categoryName: 'SNACKS' })];
    const local: [string, string | null][] = [['1', '/media/cache/1.jpg'], ['2', null]];
    const failures: [string, PhotoFailureReason][] = [['2', 'not_image']];
    const snacks = photoReport(items, local, failures, { sectionKeys: ['alegra:c2'] });
    expect(snacks.photos.notObtained.map((p) => p.id)).toEqual(['2']);
    expect(snacks.photos.allFailed).toBe(false); // el producto de RAMEN sí tiene foto

    const ramen = photoReport(items, local, failures, { sectionKeys: ['alegra:c1'] });
    expect(ramen.photos.notObtained).toEqual([]);
    expect(ramen.photos).toMatchObject({ informed: 2, obtained: 1 });
  });

  it('los padres de variantes no cuentan', () => {
    const items = [item('1', { type: 'variantParent' }), item('2')];
    const report = photoReport(items, [['1', null], ['2', '/media/cache/2.jpg']], [['1', 'not_found']]);
    expect(report.photos).toEqual({ informed: 1, obtained: 1, notObtained: [], allFailed: false });
  });

  it('sin photoFailures (como el panel de Inicio, que pasa las URLs remotas como locales) no hay fotos no obtenidas ni problema general', () => {
    const items = [item('1'), item('2')];
    const report = buildCatalog(input(items, { localImages: new Map(items.map((i) => [i.id, i.remoteImageUrl])) })).report;
    expect(report.photos).toEqual({ informed: 2, obtained: 2, notObtained: [], allFailed: false });
  });

  it('cuenta como informado un producto con imageUrls o solo con remoteImageUrl', () => {
    const items = [
      item('1', { remoteImageUrl: 'https://x.co/a.jpg', imageUrls: ['https://x.co/a.jpg', 'https://x.co/b.jpg'] }),
      item('2', { remoteImageUrl: 'https://x.co/c.jpg', imageUrls: undefined }),
    ];
    const report = photoReport(items, [['1', null], ['2', null]], [['1', 'timeout'], ['2', 'timeout']]);
    expect(report.photos).toMatchObject({ informed: 2, obtained: 0, allFailed: true });
  });

  it('un producto con foto obtenida no aparece en notObtained aunque haya un motivo guardado', () => {
    const report = photoReport([item('1')], [['1', '/media/cache/1.jpg']], [['1', 'timeout']]);
    expect(report.photos.notObtained).toEqual([]);
  });
});
