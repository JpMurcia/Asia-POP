import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
afterEach(async () => mock?.close());

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const item = (id: string, name: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name,
  status: 'active',
  price: 10000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [`${mock.url}/img/ok.png`],
  ...over,
});

async function setup() {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
  mock.setItems([
    item('1', 'Shin'),
    item('2', 'Champong', { inventory: { availableQuantity: 0, trackInventory: true } }),
  ]);
  const session = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
  await session.agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'tok_valido' }).expect(200);
  const section = (await session.agent.post('/api/sections/custom').send({ name: 'REGALOS' }).expect(201)).body;
  return { ...session, section };
}

type Agent = Awaited<ReturnType<typeof setup>>['agent'];
const makeBundle = (agent: Agent, sectionId: string, components: unknown[], pricing: unknown, name = 'Combo regalo') =>
  agent.post('/api/bundles').send({ sectionId, name, description: 'Un regalo', pricing, components });

describe('combos', () => {
  it('CRUD: crea con descuento, calcula el precio y reemplaza componentes al editar', async () => {
    const { agent, section } = await setup();
    const res = await makeBundle(
      agent,
      section.id,
      [{ source: 'alegra', productId: '1', quantity: 2 }],
      { type: 'discount', percent: 10 },
    ).expect(201);
    expect(res.body.computedPrice).toBe(18000);
    expect(res.body.components[0]).toMatchObject({ name: 'Shin', unitPrice: 10000, quantity: 2, soldOut: false });

    const upd = await agent
      .put(`/api/bundles/${res.body.id}`)
      .send({
        sectionId: section.id,
        name: 'Combo fijo',
        pricing: { type: 'fixed', price: 15000 },
        components: [{ source: 'alegra', productId: '1', quantity: 1 }, { source: 'alegra', productId: '2', quantity: 1 }],
      })
      .expect(200);
    expect(upd.body.computedPrice).toBe(15000);
    expect(upd.body.components).toHaveLength(2);
    expect(upd.body.components[1].soldOut).toBe(true);

    const list = await agent.get('/api/bundles').expect(200);
    expect(list.body).toHaveLength(1);
    await agent.delete(`/api/bundles/${res.body.id}`).expect(204);
    await agent.delete(`/api/bundles/${res.body.id}`).expect(404);
  });

  it('valida: sin componentes, descuento inválido, sección o producto propio inexistentes', async () => {
    const { agent, section } = await setup();
    await makeBundle(agent, section.id, [], { type: 'fixed', price: 1 }).expect(422);
    await makeBundle(agent, section.id, [{ source: 'alegra', productId: '1', quantity: 1 }], { type: 'discount', percent: 150 }).expect(422);
    const noSection = await makeBundle(agent, 'nope', [{ source: 'alegra', productId: '1', quantity: 1 }], { type: 'fixed', price: 1 });
    expect(noSection.body.error).toBe('invalid_section');
    const noProduct = await makeBundle(agent, section.id, [{ source: 'custom', productId: 'nope', quantity: 1 }], { type: 'fixed', price: 1 });
    expect(noProduct.body.error).toBe('invalid_component');
  });

  it('bloquea eliminar un producto propio que forma parte de un combo', async () => {
    const { agent, section } = await setup();
    const prod = (await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Mochi', price: 8000 })).body;
    const bundle = (await makeBundle(agent, section.id, [{ source: 'custom', productId: prod.id, quantity: 1 }], { type: 'fixed', price: 1000 })).body;
    const del = await agent.delete(`/api/custom-products/${prod.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error).toBe('used_in_bundle');
    await agent.delete(`/api/bundles/${bundle.id}`).expect(204);
    await agent.delete(`/api/custom-products/${prod.id}`).expect(204);
  });

  it('opciones de componentes: Alegra en vivo + productos propios', async () => {
    const { agent, section } = await setup();
    await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Mochi', price: 8000 });
    const opts = (await agent.get('/api/bundles/component-options').expect(200)).body;
    expect(opts.alegra.map((a: { name: string }) => a.name).sort()).toEqual(['Champong', 'Shin']);
    expect(opts.custom.map((c: { name: string }) => c.name)).toEqual(['Mochi']);
    expect(opts.alegraAvailable).toBe(true);
  });

  it('cada opción de Alegra trae si está agotada: el aviso de «Combo no disponible» se arma antes de guardar', async () => {
    const { agent, section } = await setup();
    await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Mochi', price: 8000 }).expect(201);
    const opts = (await agent.get('/api/bundles/component-options').expect(200)).body as {
      alegra: { name: string; soldOut: boolean }[];
      custom: { name: string; soldOut: boolean }[];
    };
    expect(opts.alegra.map((a) => [a.name, a.soldOut]).sort()).toEqual([['Champong', true], ['Shin', false]]);
    // un producto propio nunca está agotado (principio II)
    expect(opts.custom.map((c) => [c.name, c.soldOut])).toEqual([['Mochi', false]]);
  });

  it('cada opción trae su precio unitario: el desglose del combo (FR-032) lo calcula en pantalla antes de guardar', async () => {
    const { agent, section } = await setup();
    await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Mochi', price: 8000 }).expect(201);
    // un producto propio sin precio propio, con opciones: su precio unitario es el de la primera opción
    await agent
      .post('/api/custom-products')
      .send({ sectionId: section.id, name: 'Caja', price: null, options: [{ label: 'x6', price: 30000, maxFlavors: 6 }], flavors: ['FRESA'] })
      .expect(201);
    const opts = (await agent.get('/api/bundles/component-options').expect(200)).body as {
      alegra: { name: string; price: number }[];
      custom: { name: string; price: number }[];
    };
    expect(opts.alegra.map((a) => [a.name, a.price]).sort()).toEqual([['Champong', 10000], ['Shin', 10000]]);
    expect(opts.custom.map((c) => [c.name, c.price]).sort()).toEqual([['Caja', 30000], ['Mochi', 8000]]);
    for (const o of [...opts.alegra, ...opts.custom]) expect(typeof o.price).toBe('number');
  });
});

describe('generación con combos agotados', () => {
  async function prepared() {
    const s = await setup();
    const bundle = (
      await makeBundle(s.agent, s.section.id, [{ source: 'alegra', productId: '2', quantity: 1 }], { type: 'discount', percent: 10 })
    ).body;
    await s.agent.put(`/api/bundles/${bundle.id}/image`).attach('image', PNG, 'b.png').expect(200);
    const { body: prep } = await s.agent.post('/api/catalog/prepare').send({}).expect(200);
    return { ...s, bundle, prep };
  }

  it('prepare alerta del combo agotado', async () => {
    const { prep, bundle } = await prepared();
    expect(prep.report.soldOutBundles).toEqual([
      { bundleId: bundle.id, name: 'Combo regalo', soldOutComponents: ['Champong'] },
    ]);
  });

  it('generate sin decisión devuelve 422 bundle_decision_required con los combos pendientes', async () => {
    const { agent, prep, bundle } = await prepared();
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('bundle_decision_required');
    expect(res.body.details[0].bundleId).toBe(bundle.id);
  });

  it('"keep" genera el catálogo con el combo sellado; "omit" lo excluye', async () => {
    const { agent, prep, bundle } = await prepared();
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, bundleDecisions: { [bundle.id]: 'keep' } }).expect(202);
    let payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`)).body;
    const kept = payload.sections.find((s: { name: string }) => s.name === 'REGALOS');
    expect(kept.pages[0][0]).toMatchObject({ kind: 'bundle', soldOut: true });
    for (let i = 0; i < 50; i++) {
      if ((await agent.get('/api/catalog/jobs/current')).body.status === 'done') break;
      await new Promise((r) => setTimeout(r, 20));
    }

    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, bundleDecisions: { [bundle.id]: 'omit' } }).expect(202);
    payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`)).body;
    expect(payload.sections.find((s: { name: string }) => s.name === 'REGALOS')).toBeUndefined();
  });

  it('la alerta reaparece en cada preparación mientras el componente siga agotado', async () => {
    const { agent } = await prepared();
    const again = (await agent.post('/api/catalog/prepare').send({}).expect(200)).body;
    expect(again.report.soldOutBundles).toHaveLength(1);
  });
});
