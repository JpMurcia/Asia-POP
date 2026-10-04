import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import type { PanelSummary } from '../../src/catalog/types';
import { loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
afterEach(async () => mock?.close());

const TOKEN = 'tok_valido';
const creds = { email: 'tienda@example.com', apiToken: TOKEN };

const item = (id: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [`${mock.url}/img/ok.png`],
  ...over,
});

/** RAMEN: 3 productos (1 agotado) + 1 sin categoría. */
async function setup(configured = true) {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
  mock.setItems([
    item('1'),
    item('2', { inventory: { availableQuantity: 0, trackInventory: true } }),
    item('3'),
    item('4', { category: null }),
  ]);
  const session = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
  if (configured) await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  return session;
}

const summary = async (agent: Awaited<ReturnType<typeof setup>>['agent'], query = '') =>
  (await agent.get(`/api/panel/summary${query}`).expect(200)).body as PanelSummary;

const alegraCalls = () => mock.requests.filter((r) => r.path === '/items' || r.path === '/item-categories').length;

describe('GET /api/panel/summary', () => {
  it('exige sesión', async () => {
    const { app } = await setup();
    await request(app).get('/api/panel/summary').expect(401);
  });

  it('sin conexión configurada: not_configured y sin datos de Alegra', async () => {
    const { agent } = await setup(false);
    const s = await summary(agent);
    expect(s.alegra.status).toBe('not_configured');
    expect(s.stats).toBeNull();
    expect(s.sections).toBeNull();
    expect(s.lastCatalog).toBeNull();
  });

  it('con Alegra: estado ok, indicadores y secciones', async () => {
    const { agent } = await setup();
    const s = await summary(agent);
    expect(s.alegra).toMatchObject({ status: 'ok', email: 'tienda@example.com' });
    expect(s.stats).toEqual({
      products: 4,
      soldOut: 1,
      uncategorized: 1,
      // portada + portada RAMEN + 1 página (3 productos) + políticas
      estimatedPages: 4,
    });
    expect(s.sections).toEqual([{ key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 3, soldOut: 1 }]);
  });

  it('cachea la parte de Alegra 60 s; ?refresh=1 vuelve a consultar', async () => {
    const { agent } = await setup();
    await summary(agent);
    const after = alegraCalls();
    expect(after).toBeGreaterThan(0);
    await summary(agent);
    expect(alegraCalls()).toBe(after); // desde caché
    await summary(agent, '?refresh=1');
    expect(alegraCalls()).toBeGreaterThan(after);
  });

  describe('syncedAt (FR-034)', () => {
    it('con Alegra disponible trae el instante de la lectura, en ISO 8601', async () => {
      const before = Date.now();
      const { agent } = await setup();
      const s = await summary(agent);
      const at = Date.parse(s.alegra.syncedAt!);
      expect(s.alegra.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(at).toBeGreaterThanOrEqual(before - 1000);
      expect(at).toBeLessThanOrEqual(Date.now() + 1000);
    });

    it('es estable mientras dura la caché: no cambia entre lecturas', async () => {
      const { agent } = await setup();
      const first = (await summary(agent)).alegra.syncedAt;
      await new Promise((r) => setTimeout(r, 30));
      expect((await summary(agent)).alegra.syncedAt).toBe(first);
    });

    it('?refresh=1 vuelve a leer y lo actualiza', async () => {
      const { agent } = await setup();
      const first = (await summary(agent)).alegra.syncedAt!;
      await new Promise((r) => setTimeout(r, 30));
      const second = (await summary(agent, '?refresh=1')).alegra.syncedAt!;
      expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
    });

    it('sin conexión configurada no existe', async () => {
      const { agent } = await setup(false);
      expect((await summary(agent)).alegra).not.toHaveProperty('syncedAt');
    });

    it('si Alegra no responde no existe (no hay lectura que mostrar)', async () => {
      const session = await setup();
      await mock.close();
      const s = await summary(session.agent, '?refresh=1');
      expect(s.alegra.status).toBe('unreachable');
      expect(s.alegra).not.toHaveProperty('syncedAt');
      mock = await startAlegraMock();
    });
  });

  it('asignar una sección a un ítem sin categoría invalida la caché y baja el contador', async () => {
    const { agent } = await setup();
    expect((await summary(agent)).stats?.uncategorized).toBe(1);
    await agent.put('/api/catalog/uncategorized/4').send({ sectionKey: 'alegra:c1' }).expect(204);
    const s = await summary(agent); // sin ?refresh: la escritura ya invalidó la caché
    expect(s.stats?.uncategorized).toBe(0);
    expect(s.stats?.estimatedPages).toBe(5); // RAMEN pasa a 4 productos = 2 páginas
  });

  it('crear una sección propia invalida la caché', async () => {
    const { agent } = await setup();
    await summary(agent);
    const before = alegraCalls();
    await agent.post('/api/sections/custom').send({ name: 'MOCHIS' }).expect(201);
    await summary(agent);
    expect(alegraCalls()).toBeGreaterThan(before);
  });

  it('Alegra caído: status unreachable, indicadores en null y el último catálogo sigue disponible', async () => {
    const session = await setup();
    session.ctx.history.add(Buffer.from('%PDF-1.4'), 5, 1, { pages: 12 });
    await mock.close();
    const s = await summary(session.agent, '?refresh=1');
    expect(s.alegra.status).toBe('unreachable');
    expect(s.alegra.message).toBeTruthy();
    expect(s.stats).toBeNull();
    expect(s.sections).toBeNull();
    expect(s.lastCatalog).toMatchObject({ includedCount: 5, omittedCount: 1, pages: 12 });
    mock = await startAlegraMock(); // para que afterEach tenga algo que cerrar
  });

  it('lastCatalog no se cachea: aparece de inmediato', async () => {
    const { agent, ctx } = await setup();
    expect((await summary(agent)).lastCatalog).toBeNull();
    ctx.history.add(Buffer.from('%PDF-1.4'), 3, 0, { pages: 9 });
    expect((await summary(agent)).lastCatalog).toMatchObject({ includedCount: 3, pages: 9 });
  });

  it('los catálogos de 001 sin páginas guardadas no traen `pages`', async () => {
    const { agent, ctx } = await setup();
    ctx.history.add(Buffer.from('%PDF-1.4'), 3, 0, { filters: [] });
    expect((await summary(agent)).lastCatalog?.pages).toBeUndefined();
  });

  it('nunca expone el token de Alegra', async () => {
    const { agent } = await setup();
    const res = await agent.get('/api/panel/summary').expect(200);
    expect(JSON.stringify(res.body)).not.toContain(TOKEN);
  });
});
