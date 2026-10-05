import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { FakeRenderer, loggedInAgent, SEED, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import request from 'supertest';

/**
 * Feature 006: omitir artículos de Alegra del catálogo. Rutas, persistencia y efecto en el catálogo
 * (cada historia agrega sus casos a este archivo).
 */

let mock: AlegraMock;
afterEach(async () => mock?.close());

const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };

const item = (id: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: 'desc',
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [`${mock.url}/img/ok.png`],
  ...over,
});

async function setup(items: (m: AlegraMock) => AlegraItemRaw[], opts: { configured?: boolean } = {}) {
  mock = await startAlegraMock({
    categories: [
      { id: 'c1', name: 'RAMEN' },
      { id: 'c2', name: 'SNACKS' },
    ],
  });
  mock.setItems(items(mock));
  const config = testConfig({ alegraBaseUrl: mock.url });
  const renderer = new FakeRenderer();
  const ctx = testContext({ config, renderer });
  const session = await loggedInAgent(ctx);
  if (opts.configured !== false) await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  return { ...session, config, renderer };
}

type Row = {
  itemId: string;
  name: string;
  sectionKey: string | null;
  sectionName: string | null;
  price: number;
  soldOut: boolean;
  omitted: boolean;
  bundles?: string[];
};
const articles = async (agent: Awaited<ReturnType<typeof setup>>['agent']) =>
  (await agent.get('/api/catalog/articles').expect(200)).body.items as Row[];

const omittedRows = (ctx: Awaited<ReturnType<typeof setup>>['ctx']) =>
  (ctx.db.prepare('SELECT alegra_item_id FROM omitted_item').all() as { alegra_item_id: string }[]).map(
    (r) => r.alegra_item_id,
  );

describe('GET /api/catalog/articles', () => {
  it('lista los artículos activos sin los padres de variantes, ordenados por nombre sin distinguir tildes', async () => {
    const { agent } = await setup(() => [
      item('1', { name: 'Zeta' }),
      item('2', { name: 'alfa' }),
      item('3', { name: 'Álamo' }),
      item('4', { name: 'Padre', type: 'variantParent' }),
    ]);
    const rows = await articles(agent);
    expect(rows.map((r) => r.name)).toEqual(['Álamo', 'alfa', 'Zeta']);
    expect(rows[0]).toEqual({
      itemId: '3',
      name: 'Álamo',
      sectionKey: 'alegra:c1',
      sectionName: 'RAMEN',
      price: 9000,
      soldOut: false,
      omitted: false,
      bundles: [],
    });
  });

  it('marca los agotados y toma el precio de Alegra', async () => {
    const { agent } = await setup(() => [
      item('1', { price: 15000, inventory: { availableQuantity: 0, trackInventory: true } }),
    ]);
    const [row] = await articles(agent);
    expect(row).toMatchObject({ price: 15000, soldOut: true });
  });

  it('un artículo sin categoría no trae sección, y con una asignación trae la sección asignada', async () => {
    const { agent } = await setup(() => [item('1', { category: null }), item('2', { category: null })]);
    let rows = await articles(agent);
    expect(rows.every((r) => r.sectionKey === null && r.sectionName === null)).toBe(true);

    await agent.put('/api/catalog/uncategorized/2').send({ sectionKey: 'alegra:c2' }).expect(204);
    rows = await articles(agent);
    expect(rows.find((r) => r.itemId === '2')).toMatchObject({ sectionKey: 'alegra:c2', sectionName: 'SNACKS' });
    expect(rows.find((r) => r.itemId === '1')).toMatchObject({ sectionKey: null, sectionName: null });
  });

  it('sin conexión configurada responde 422 alegra_not_configured', async () => {
    const { agent } = await setup(() => [item('1')], { configured: false });
    const res = await agent.get('/api/catalog/articles').expect(422);
    expect(res.body.error).toBe('alegra_not_configured');
  });

  it('con Alegra caído responde 502 y no toca la lista guardada (FR-015)', async () => {
    const { agent, ctx } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/1').expect(204);
    await mock.close();
    const res = await agent.get('/api/catalog/articles');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('alegra_unreachable');
    expect(omittedRows(ctx)).toEqual(['1']);
  });
});

describe('PUT / DELETE /api/catalog/omitted/:itemId', () => {
  it('omitir marca el artículo y es idempotente', async () => {
    const { agent, ctx } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/1').expect(204);
    await agent.put('/api/catalog/omitted/1').expect(204);
    expect((await articles(agent)).map((r) => [r.itemId, r.omitted])).toEqual([
      ['1', true],
      ['2', false],
    ]);
    expect(omittedRows(ctx)).toEqual(['1']);
  });

  it('volver a incluir lo desmarca; incluir uno que no estaba omitido no falla', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/1').expect(204);
    await agent.delete('/api/catalog/omitted/1').expect(204);
    await agent.delete('/api/catalog/omitted/2').expect(204);
    expect((await articles(agent)).every((r) => !r.omitted)).toBe(true);
  });

  it('rechaza un identificador de más de 64 caracteres con 422 invalid_item', async () => {
    const { agent, ctx } = await setup(() => [item('1')]);
    const long = 'x'.repeat(65);
    for (const method of ['put', 'delete'] as const) {
      const res = await agent[method](`/api/catalog/omitted/${long}`);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('invalid_item');
    }
    expect(omittedRows(ctx)).toEqual([]);
  });

  it('omitir e incluir no generan ninguna petición a Alegra (principio I)', async () => {
    const { agent } = await setup(() => [item('1')]);
    const before = mock.requests.length;
    await agent.put('/api/catalog/omitted/1').expect(204);
    await agent.delete('/api/catalog/omitted/1').expect(204);
    expect(mock.requests.length).toBe(before);
  });

  it('la lista vive en la base de datos: otra instancia de la aplicación la ve (FR-004)', async () => {
    const { agent, ctx, config } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/2').expect(204);

    // Otra aplicación sobre la misma base, con sesiones nuevas: como tras reiniciar el servidor
    const second = request.agent(createApp(testContext({ config, db: ctx.db })));
    await second.post('/api/auth/login').send(SEED).expect(204);
    const rows = (await second.get('/api/catalog/articles').expect(200)).body.items as Row[];
    expect(rows.find((r) => r.itemId === '2')?.omitted).toBe(true);
  });
});

describe('el catálogo no trae los artículos omitidos', () => {
  it('prepare y el payload (vista previa y PDF) excluyen a los omitidos y el resto queda igual', async () => {
    const { agent } = await setup(() => [item('1'), item('2'), item('3'), item('4'), item('5')]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    await agent.put('/api/catalog/omitted/4').expect(204);

    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(prep.report.counts.included).toBe(3);
    const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
    const ids = payload.sections.flatMap((s: { pages: { id: string }[][] }) => s.pages.flat().map((i) => i.id));
    expect(ids.sort()).toEqual(['1', '3', '5']);
    // Con los 3 que quedan, la sección cabe en una sola página de productos (antes eran 2)
    expect(prep.structure.productPages).toBe(1);
  });

  it('generar usa ese mismo payload y todo lo que se pide a Alegra es GET', async () => {
    const { agent, renderer } = await setup(() => [item('1'), item('2'), item('3')]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    for (let i = 0; i < 100 && (await agent.get('/api/catalog/jobs/current')).body.status !== 'done'; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(renderer.calls).toHaveLength(1);
    expect(renderer.calls[0]!.url).toContain(`/print/${prep.prepareId}`);
    const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
    const ids = payload.sections.flatMap((s: { pages: { id: string }[][] }) => s.pages.flat().map((i) => i.id));
    expect(ids.sort()).toEqual(['1', '3']);
    expect(mock.requests.every((r) => r.method === 'GET')).toBe(true);
  });
});

describe('revisión y generación con la lista de omitidos (US2)', () => {
  const CHANGED = 'Cambiaste los artículos omitidos después de preparar. Vuelve a preparar el catálogo para aplicar el cambio.';

  const payloadIds = async (agent: Awaited<ReturnType<typeof setup>>['agent'], prepareId: string) => {
    const payload = (await agent.get(`/api/catalog/payload/${prepareId}`).expect(200)).body;
    return (payload.sections as { pages: { id: string }[][] }[]).flatMap((s) => s.pages.flat().map((i) => i.id)).sort();
  };

  it('prepare informa los omitidos por nombre, aparte de los omitidos por falta de foto (FR-008)', async () => {
    const { agent } = await setup(() => [
      item('1', { name: 'Visible' }),
      item('2', { name: 'Té verde' }),
      item('3', { name: 'Sin foto', images: [] }),
    ]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(body.report.omittedByChoice).toEqual([{ itemId: '2', name: 'Té verde' }]);
    // «omitted» sigue significando sin foto o sin sección: el omitido por decisión no suma
    expect(body.report.counts).toEqual({ included: 1, omitted: 1, soldOut: 0 });
    expect(body.report.omittedNoImage.map((o: { id: string }) => o.id)).toEqual(['3']);
  });

  it('sin omitidos, el informe trae una lista vacía', async () => {
    const { agent } = await setup(() => [item('1')]);
    const { body } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(body.report.omittedByChoice).toEqual([]);
  });

  it('generate con la lista sin cambios responde 202', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
  });

  it('si se omite otro artículo después de preparar, generate responde 409 y no crea nada (FR-012)', async () => {
    const { agent, renderer } = await setup(() => [item('1'), item('2'), item('3')]);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.put('/api/catalog/omitted/3').expect(204);

    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: 'omitted_changed', message: CHANGED });
    expect((await agent.get('/api/catalog/jobs/current').expect(200)).body.status).toBe('idle');
    expect(renderer.calls).toHaveLength(0);
    expect((await agent.get('/api/catalog/history').expect(200)).body).toEqual([]);
  });

  it('volver a incluir un artículo después de preparar también da 409', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.delete('/api/catalog/omitted/2').expect(204);
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('omitted_changed');
  });

  it('omitir y volver a incluir lo mismo deja la lista como estaba y se puede generar', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.put('/api/catalog/omitted/2').expect(204);
    await agent.delete('/api/catalog/omitted/2').expect(204);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
  });

  it('volver a preparar después del cambio permite generar, y el PDF coincide con la nueva lista', async () => {
    const { agent, renderer } = await setup(() => [item('1'), item('2'), item('3')]);
    await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.put('/api/catalog/omitted/3').expect(204);

    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(prep.report.omittedByChoice.map((o: { itemId: string }) => o.itemId)).toEqual(['3']);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    for (let i = 0; i < 100 && (await agent.get('/api/catalog/jobs/current')).body.status !== 'done'; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(renderer.calls).toHaveLength(1);
    expect(await payloadIds(agent, prep.prepareId)).toEqual(['1', '2']);
  });

  it('un prepareId desconocido sigue dando 410, antes que el 409', async () => {
    const { agent } = await setup(() => [item('1')]);
    await agent.put('/api/catalog/omitted/1').expect(204);
    const res = await agent.post('/api/catalog/generate').send({ prepareId: 'no-existe' });
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('prepare_expired');
  });

  it('cambiar las opciones de una preparación conserva la lista con la que se preparó (instantánea)', async () => {
    const { agent } = await setup(() => [item('1'), item('2'), item('3')]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.put('/api/catalog/omitted/3').expect(204);

    const res = await agent
      .put(`/api/catalog/prepare/${prep.prepareId}/options`)
      .send({ hideSoldOut: false })
      .expect(200);
    expect(res.body.report.omittedByChoice.map((o: { itemId: string }) => o.itemId)).toEqual(['2']);
    expect(await payloadIds(agent, prep.prepareId)).toEqual(['1', '3']);
  });

  it('un artículo que se vuelve a incluir aparece en el siguiente catálogo preparado (SC-006)', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const first = (await agent.post('/api/catalog/prepare').send({}).expect(200)).body;
    expect(await payloadIds(agent, first.prepareId)).toEqual(['1']);

    await agent.delete('/api/catalog/omitted/2').expect(204);
    const second = (await agent.post('/api/catalog/prepare').send({}).expect(200)).body;
    expect(await payloadIds(agent, second.prepareId)).toEqual(['1', '2']);
    expect(second.report.omittedByChoice).toEqual([]);
  });
});

describe('coherencia con las demás reglas (US3)', () => {
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  type Agent = Awaited<ReturnType<typeof setup>>['agent'];

  /** Sección propia REGALOS y un combo (con imagen) con los componentes de Alegra indicados. */
  async function makeBundle(agent: Agent, sectionId: string, name: string, productIds: string[]) {
    const bundle = (
      await agent
        .post('/api/bundles')
        .send({
          sectionId,
          name,
          description: 'Un regalo',
          pricing: { type: 'discount', percent: 10 },
          components: productIds.map((productId) => ({ source: 'alegra', productId, quantity: 1 })),
        })
        .expect(201)
    ).body;
    await agent.put(`/api/bundles/${bundle.id}/image`).attach('image', PNG, 'b.png').expect(200);
    return bundle as { id: string };
  }
  const newSection = async (agent: Agent) =>
    (await agent.post('/api/sections/custom').send({ name: 'REGALOS' }).expect(201)).body as { id: string };

  it('GET /catalog/articles trae los nombres de los combos que usan cada artículo, sin repetir y ordenados', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    const section = await newSection(agent);
    await makeBundle(agent, section.id, 'Combo B', ['1']);
    await makeBundle(agent, section.id, 'Combo A', ['1', '1']);

    const rows = await articles(agent);
    expect(rows.find((r) => r.itemId === '1')?.bundles).toEqual(['Combo A', 'Combo B']);
    expect(rows.find((r) => r.itemId === '2')?.bundles).toEqual([]);
  });

  it('GET /catalog/uncategorized marca los omitidos y conserva su sección asignada', async () => {
    const { agent } = await setup(() => [item('1', { category: null }), item('2', { category: null })]);
    await agent.put('/api/catalog/uncategorized/1').send({ sectionKey: 'alegra:c2' }).expect(204);
    await agent.put('/api/catalog/omitted/1').expect(204);

    const res = await agent.get('/api/catalog/uncategorized').expect(200);
    const byId = Object.fromEntries(res.body.items.map((i: { itemId: string }) => [i.itemId, i]));
    expect(byId['1']).toMatchObject({ omitted: true, assignedSectionKey: 'alegra:c2' });
    expect(byId['2']).toMatchObject({ omitted: false, assignedSectionKey: null });
  });

  it('un omitido sin categoría no se informa como pendiente en la revisión', async () => {
    const { agent } = await setup(() => [item('1'), item('2', { category: null })]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(body.report.uncategorized).toEqual([]);
    expect(body.report.omittedNoSection).toEqual([]);
    expect(body.report.omittedByChoice.map((o: { itemId: string }) => o.itemId)).toEqual(['2']);
  });

  it('prepare no pide la foto de un omitido, pero sí las de los demás', async () => {
    const { agent } = await setup((m) => [
      item('1', { images: [`${m.url}/img/ok.png?i=1`] }),
      item('2', { images: [`${m.url}/img/ok.png?i=2`] }),
      item('3', { images: [`${m.url}/img/ok.png?i=3`] }),
    ]);
    await agent.put('/api/catalog/omitted/2').expect(204);
    await agent.post('/api/catalog/prepare').send({}).expect(200);

    const asked = mock.requests.filter((r) => r.path === '/img/ok.png').map((r) => r.search);
    expect(asked.sort()).toEqual(['?i=1', '?i=3']);
  });

  it('un omitido cuya foto falla no aparece como foto no obtenida ni dispara el aviso de problema general', async () => {
    const { agent } = await setup((m) => [
      item('1', { images: [`${m.url}/img/falla.png`] }),
      item('2', { images: [`${m.url}/img/falla.png?i=2`] }),
    ]);
    await agent.put('/api/catalog/omitted/1').expect(204);
    await agent.put('/api/catalog/omitted/2').expect(204);
    const { body } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(body.report.photos).toMatchObject({ informed: 0, notObtained: [], allFailed: false });
    expect(body.report.omittedNoImage).toEqual([]);
    expect(mock.requests.some((r) => r.path === '/img/falla.png')).toBe(false);
  });

  it('un combo cuyo componente se omite sigue en el payload con los mismos componentes y precio (FR-011)', async () => {
    const { agent } = await setup(() => [item('1'), item('2')]);
    const section = await newSection(agent);
    await makeBundle(agent, section.id, 'Combo regalo', ['1']);

    const find = async () => {
      const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
      const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
      const regalos = (payload.sections as { name: string; pages: { kind: string }[][] }[]).find((s) => s.name === 'REGALOS');
      return { prep, bundle: regalos?.pages.flat().find((i) => i.kind === 'bundle') };
    };

    const before = await find();
    await agent.put('/api/catalog/omitted/1').expect(204);
    const after = await find();

    expect(after.bundle).toBeTruthy();
    expect(after.bundle).toEqual(before.bundle);
    expect(after.bundle).toMatchObject({ priceLabel: '$8.100', soldOut: false, components: [{ name: 'Producto 1', quantity: 1 }] });
    expect(after.prep.report.soldOutBundles).toEqual([]);
  });
});
