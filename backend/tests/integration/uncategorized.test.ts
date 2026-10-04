import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
afterEach(async () => mock?.close());

const item = (id: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [`${mock.url}/img/ok.png`],
  ...over,
});

async function setup() {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }, { id: 'c2', name: 'SNACKS' }] });
  mock.setItems([item('1'), item('2', { category: null }), item('3', { category: null })]);
  const session = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
  await session.agent
    .put('/api/settings/alegra')
    .send({ email: 'tienda@example.com', apiToken: 'tok_valido' })
    .expect(200);
  return session;
}

describe('ítems sin categoría', () => {
  it('lista solo los ítems sin categoría', async () => {
    const { agent } = await setup();
    const res = await agent.get('/api/catalog/uncategorized').expect(200);
    expect(res.body.items.map((i: { itemId: string }) => i.itemId).sort()).toEqual(['2', '3']);
    expect(res.body.items[0].assignedSectionKey).toBeNull();
  });

  it('asignar una sección la guarda, se aplica al catálogo y no escribe en Alegra', async () => {
    const { agent } = await setup();
    await agent.put('/api/catalog/uncategorized/2').send({ sectionKey: 'alegra:c2' }).expect(204);
    const list = await agent.get('/api/catalog/uncategorized').expect(200);
    expect(list.body.items.find((i: { itemId: string }) => i.itemId === '2').assignedSectionKey).toBe('alegra:c2');

    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(prep.report.counts.included).toBe(2); // el 1 (RAMEN) y el 2 (SNACKS); el 3 sigue fuera
    expect(prep.report.omittedNoSection.map((o: { itemId: string }) => o.itemId)).toEqual(['3']);
    const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
    expect(payload.sections.map((s: { name: string }) => s.name)).toEqual(['RAMEN', 'SNACKS']);

    // Principio I: ninguna petición que no sea GET llegó a Alegra
    expect(mock.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('rechaza una sección inexistente', async () => {
    const { agent } = await setup();
    const res = await agent.put('/api/catalog/uncategorized/2').send({ sectionKey: 'alegra:nope' });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('invalid_section');
  });

  it('quitar la asignación vuelve a dejar el ítem sin sección', async () => {
    const { agent } = await setup();
    await agent.put('/api/catalog/uncategorized/2').send({ sectionKey: 'alegra:c2' }).expect(204);
    await agent.delete('/api/catalog/uncategorized/2').expect(204);
    const list = await agent.get('/api/catalog/uncategorized').expect(200);
    expect(list.body.items.every((i: { assignedSectionKey: string | null }) => i.assignedSectionKey === null)).toBe(true);
  });

  it('/sections devuelve las categorías de Alegra y respeta el orden guardado', async () => {
    const { agent } = await setup();
    const first = await agent.get('/api/sections').expect(200);
    expect(first.body.map((s: { key: string }) => s.key)).toEqual(['alegra:c1', 'alegra:c2']);
    await agent.put('/api/sections/order').send({ keys: ['alegra:c2', 'alegra:c1'] }).expect(204);
    const second = await agent.get('/api/sections').expect(200);
    expect(second.body.map((s: { key: string }) => s.key)).toEqual(['alegra:c2', 'alegra:c1']);
  });
});
