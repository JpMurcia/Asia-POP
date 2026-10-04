import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import type { CatalogPayload } from '../../src/catalog/types';
import { FakeRenderer, loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
afterEach(async () => mock?.close());

const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };

/** Foto con la forma real de Alegra: `{ id, name, url, favorite }`. */
const photo = (route: string, favorite: boolean, id = 1) => ({
  id,
  name: `foto-${id}.jpg`,
  url: `${mock.url}${route}?Expires=9999999999&Signature=firma-secreta&Key-Pair-Id=K1`,
  favorite,
});

const item = (id: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: 'desc',
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [photo('/img/generic.png', true)],
  ...over,
});

async function setup(items: () => AlegraItemRaw[]) {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
  mock.setItems(items());
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer: new FakeRenderer() });
  const session = await loggedInAgent(ctx);
  await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  return session;
}

type Agent = Awaited<ReturnType<typeof setup>>['agent'];

const prepare = async (agent: Agent) => (await agent.post('/api/catalog/prepare').send({}).expect(200)).body;
const payloadOf = async (agent: Agent, prepareId: string) =>
  (await agent.get(`/api/catalog/payload/${prepareId}`).expect(200)).body as CatalogPayload;
const imageOf = (payload: CatalogPayload, id: string): string | undefined =>
  payload.sections.flatMap((s) => s.pages.flat()).find((i) => i.id === id)?.imageUrl;

describe('preparar con las fotos tal como las entrega Alegra (tipo genérico, favorita)', () => {
  it('un producto con una foto servida como binary/octet-stream entra al catálogo', async () => {
    const { agent } = await setup(() => [item('1')]);
    const prep = await prepare(agent);
    expect(prep.report.counts).toMatchObject({ included: 1, omitted: 0 });
    expect(prep.report.omittedNoImage).toEqual([]);
    const url = imageOf(await payloadOf(agent, prep.prepareId), '1');
    expect(url).toMatch(/^\/media\/cache\/[0-9a-f]{40}\.png$/);
  });

  it('con varias fotos usa la favorita aunque no sea la primera, y su archivo es el correcto', async () => {
    const { agent } = await setup(() => [
      item('2', { images: [photo('/img/generic.png', false, 1), photo('/img/generic.jpg', true, 2)] }),
    ]);
    const prep = await prepare(agent);
    const url = imageOf(await payloadOf(agent, prep.prepareId), '2');
    expect(url).toMatch(/\.jpg$/);
    const res = await agent.get(url!).expect(200);
    const bytes = res.body as Buffer;
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  it('si la favorita no se puede descargar usa la siguiente foto del mismo producto', async () => {
    const { agent } = await setup(() => [
      item('3', { images: [photo('/img/forbidden', true, 1), photo('/img/generic.jpg', false, 2)] }),
    ]);
    const prep = await prepare(agent);
    expect(prep.report.omittedNoImage).toEqual([]);
    expect(imageOf(await payloadOf(agent, prep.prepareId), '3')).toMatch(/\.jpg$/);
  });

  it('sin fotos queda fuera del PDF y en omittedNoImage; los demás siguen incluidos', async () => {
    const { agent } = await setup(() => [item('1'), item('4', { images: [] }), item('5', { images: undefined })]);
    const prep = await prepare(agent);
    expect(prep.report.counts).toMatchObject({ included: 1, omitted: 2 });
    expect(prep.report.omittedNoImage.map((o: { id: string }) => o.id).sort()).toEqual(['4', '5']);
  });

  it('incluidos = productos con foto utilizable (mezcla de casos)', async () => {
    const { agent } = await setup(() => [
      item('1'),
      item('2', { images: [photo('/img/generic.jpg', true)] }),
      item('3', { images: [photo('/img/forbidden', true)] }),
      item('4', { images: [] }),
    ]);
    const prep = await prepare(agent);
    expect(prep.report.counts).toMatchObject({ included: 2, omitted: 2 });
  });

  it('Alegra es de solo lectura: todas las peticiones son GET y los ítems se piden con mode=advanced', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    await prepare(agent);
    const toAlegra = mock.requests.filter((r) => !r.path.startsWith('/img/'));
    expect(toAlegra.length).toBeGreaterThan(0);
    expect(toAlegra.every((r) => r.method === 'GET')).toBe(true);
    const itemCalls = toAlegra.filter((r) => r.path === '/items');
    expect(itemCalls.length).toBeGreaterThan(0);
    expect(itemCalls.every((r) => new URLSearchParams(r.search).get('mode') === 'advanced')).toBe(true);
    // No se usa el servicio de adjuntos ni el detalle de cada ítem
    expect(toAlegra.some((r) => /\/items\/[^/]+/.test(r.path))).toBe(false);
  });
});

describe('informe de fotos con fallos reales de descarga', () => {
  const failing = () => [
    item('1'),
    item('2', { images: [photo('/img/forbidden', true)] }),
    item('3', { images: [photo('/img/missing', true)] }),
    item('4', { images: [photo('/img/html', true)] }),
    item('5', { images: [photo('/img/svg', true)] }),
    item('6', { images: [photo('/img/error', true)] }),
    item('7', { images: [] }),
  ];

  it('cada producto con foto no obtenida trae su motivo; el que no tiene foto en Alegra no', async () => {
    const { agent } = await setup(failing);
    const { report } = await prepare(agent);
    const reasons = Object.fromEntries(report.photos.notObtained.map((p: { id: string; reason: string }) => [p.id, p.reason]));
    expect(reasons).toEqual({
      '2': 'unauthorized',
      '3': 'not_found',
      '4': 'not_image',
      '5': 'unsupported_format',
      '6': 'unavailable',
    });
    expect(report.photos).toMatchObject({ informed: 6, obtained: 1, allFailed: false });
    expect(report.photos.notObtained[0]).toEqual({ id: '2', name: 'Producto 2', reason: 'unauthorized' });
    // Todos los que quedan fuera siguen en omittedNoImage (la regla de omitir no cambia)
    expect(report.omittedNoImage.map((o: { id: string }) => o.id).sort()).toEqual(['2', '3', '4', '5', '6', '7']);
    expect(report.counts).toMatchObject({ included: 1, omitted: 6 });
  });

  it('si ninguna foto informada se puede descargar, allFailed es verdadero', async () => {
    const { agent } = await setup(() => [
      item('1', { images: [photo('/img/forbidden', true)] }),
      item('2', { images: [photo('/img/forbidden', true)] }),
      item('3', { images: [] }),
    ]);
    const { report } = await prepare(agent);
    expect(report.photos).toMatchObject({ informed: 2, obtained: 0, allFailed: true });
    expect(report.counts.included).toBe(0);
    expect(report.emptyCatalog).toBe(true);
  });

  it('sin ningún producto con foto informada no hay problema general', async () => {
    const { agent } = await setup(() => [item('1', { images: [] }), item('2', { images: [] })]);
    const { report } = await prepare(agent);
    expect(report.photos).toEqual({ informed: 0, obtained: 0, notObtained: [], allFailed: false });
  });

  it('la ruta de opciones recalcula sin volver a consultar Alegra y conserva los motivos', async () => {
    const { agent } = await setup(failing);
    const prep = await prepare(agent);
    const before = mock.requests.length;
    const res = await agent
      .put(`/api/catalog/prepare/${prep.prepareId}/options`)
      .send({ sectionKeys: ['alegra:c1'], hideSoldOut: false })
      .expect(200);
    expect(mock.requests.length).toBe(before);
    expect(res.body.report.photos).toEqual(prep.report.photos);
  });

  it('el informe solo incluye las fotos no obtenidas de las secciones seleccionadas', async () => {
    mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }, { id: 'c2', name: 'SNACKS' }] });
    mock.setItems([
      item('1'),
      item('2', { images: [photo('/img/forbidden', true)], category: { id: 'c2', name: 'SNACKS' } }),
    ]);
    const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer: new FakeRenderer() });
    const { agent } = await loggedInAgent(ctx);
    await agent.put('/api/settings/alegra').send(creds).expect(200);
    const prep = await prepare(agent);
    expect(prep.report.photos.notObtained.map((p: { id: string }) => p.id)).toEqual(['2']);
    const ramen = await agent
      .put(`/api/catalog/prepare/${prep.prepareId}/options`)
      .send({ sectionKeys: ['alegra:c1'], hideSoldOut: false })
      .expect(200);
    expect(ramen.body.report.photos.notObtained).toEqual([]);
    expect(ramen.body.report.photos).toMatchObject({ informed: 2, obtained: 1 });
  });

  it('ninguna respuesta de la API expone direcciones firmadas de fotos ni la URL de origen (principio III)', async () => {
    const { agent } = await setup(failing);
    const prep = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const options = await agent
      .put(`/api/catalog/prepare/${prep.body.prepareId}/options`)
      .send({ sectionKeys: ['alegra:c1'], hideSoldOut: false })
      .expect(200);
    const payload = await agent.get(`/api/catalog/payload/${prep.body.prepareId}`).expect(200);
    for (const body of [prep.text, options.text, payload.text]) {
      expect(body).not.toContain('Signature=');
      expect(body).not.toContain('Expires=');
      expect(body).not.toContain('Key-Pair-Id');
      expect(body).not.toContain(mock.url);
      expect(body).not.toContain('/img/');
    }
  });
});
