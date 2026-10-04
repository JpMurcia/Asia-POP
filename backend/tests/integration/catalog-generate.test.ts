import fs from 'node:fs';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { FakeRenderer, loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

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

async function setup(items: (m: AlegraMock) => AlegraItemRaw[], renderer = new FakeRenderer()) {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }, { id: 'c2', name: 'SNACKS' }] });
  mock.setItems(items(mock));
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer });
  const session = await loggedInAgent(ctx);
  await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  return { ...session, renderer };
}

async function waitFor(agent: Awaited<ReturnType<typeof loggedInAgent>>['agent'], status: string) {
  for (let i = 0; i < 100; i++) {
    const res = await agent.get('/api/catalog/jobs/current');
    if (res.body.status === status) return res.body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`el trabajo no llegó a ${status}`);
}

describe('prepare / generate', () => {
  it('prepare devuelve el informe y no genera PDF', async () => {
    const { agent, renderer } = await setup(() => [
      item('1'),
      item('2', { inventory: { availableQuantity: 0, trackInventory: true } }),
      item('3', { images: [] }),
      item('4', { images: [`${mock.url}/img/falla.png`] }),
      item('5', { category: null }),
    ]);
    const res = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(res.body.prepareId).toBeTruthy();
    expect(res.body.report.counts).toEqual({ included: 2, omitted: 3, soldOut: 1 });
    expect(res.body.report.omittedNoImage.map((o: { id: string }) => o.id).sort()).toEqual(['3', '4']);
    expect(res.body.report.uncategorized.map((u: { itemId: string }) => u.itemId)).toEqual(['5']);
    expect(renderer.calls).toHaveLength(0);
    const idle = await agent.get('/api/catalog/jobs/current').expect(200);
    expect(idle.body.status).toBe('idle');
  });

  it('prepare sin conexión configurada devuelve 422', async () => {
    const { agent } = await loggedInAgent(testContext());
    const res = await agent.post('/api/catalog/prepare').send({}).expect(422);
    expect(res.body.error).toBe('alegra_not_configured');
  });

  it('generate crea el PDF, lo guarda en el historial y se puede descargar', async () => {
    const { agent, renderer } = await setup(() => [item('1')]);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({});
    const gen = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(gen.body.jobId).toBeTruthy();
    const job = await waitFor(agent, 'done');
    expect(job.catalogId).toBeTruthy();
    expect(renderer.calls[0]!.url).toContain(`/print/${prep.prepareId}`);

    const hist = await agent.get('/api/catalog/history').expect(200);
    expect(hist.body).toHaveLength(1);
    expect(hist.body[0]).toMatchObject({ includedCount: 1, omittedCount: 0 });
    const pdf = await agent.get(`/api/catalog/history/${job.catalogId}/pdf`).expect(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect(pdf.headers['content-disposition']).toMatch(/attachment; filename="catalogo-\d{4}-\d{2}-\d{2}-\d{4}\.pdf"/);
  });

  it('el navegador usa una sesión temporal que se destruye al terminar', async () => {
    const { agent, renderer, ctx } = await setup(() => [item('1')]);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({});
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitFor(agent, 'done');
    expect(ctx.sessions.isValid(renderer.calls[0]!.sessionId)).toBe(false);
  });

  it('una segunda generación mientras hay una activa recibe 409', async () => {
    const renderer = new FakeRenderer();
    renderer.delayMs = 300;
    const { agent } = await setup(() => [item('1')], renderer);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({});
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    const second = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('job_in_progress');
    const prepAgain = await agent.post('/api/catalog/prepare').send({});
    expect(prepAgain.status).toBe(409);
    await waitFor(agent, 'done');
  });

  it('prepareId inexistente o expirado devuelve 410', async () => {
    const { agent } = await setup(() => [item('1')]);
    const res = await agent.post('/api/catalog/generate').send({ prepareId: 'no-existe' });
    expect(res.status).toBe(410);
  });

  it('catálogo vacío devuelve 422 empty_catalog', async () => {
    const { agent } = await setup(() => [item('1', { images: [] })]);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({});
    expect(prep.report.emptyCatalog).toBe(true);
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('empty_catalog');
  });

  it('si el renderizado falla no hay PDF parcial: el trabajo queda failed y el historial vacío', async () => {
    const renderer = new FakeRenderer();
    renderer.fail = true;
    const { agent } = await setup(() => [item('1')], renderer);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({});
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    const job = await waitFor(agent, 'failed');
    expect(job.error).toMatch(/fallo de renderizado/);
    expect((await agent.get('/api/catalog/history')).body).toEqual([]);
  });

  it('si Alegra falla al preparar no queda trabajo activo y se informa 502', async () => {
    const { agent } = await setup(() => [item('1')]);
    await mock.close();
    const res = await agent.post('/api/catalog/prepare').send({});
    expect(res.status).toBe(502);
    expect((await agent.get('/api/catalog/jobs/current')).body.status).toBe('idle');
    mock = await startAlegraMock(); // para que afterEach cierre algo válido
  });

  it('hideSoldOut oculta los agotados', async () => {
    const { agent } = await setup(() => [
      item('1'),
      item('2', { inventory: { availableQuantity: 0, trackInventory: true } }),
    ]);
    const res = await agent.post('/api/catalog/prepare').send({ hideSoldOut: true }).expect(200);
    expect(res.body.report.counts).toMatchObject({ included: 1, soldOut: 0 });
  });

  it('el payload de la vista previa respeta máx. 3 por página y /media sirve imágenes', async () => {
    const { agent, ctx, app } = await setup(() => ['1', '2', '3', '4'].map((id) => item(id)));
    const { body: prep } = await agent.post('/api/catalog/prepare').send({});
    const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
    expect(payload.sections[0].pages.map((p: unknown[]) => p.length)).toEqual([3, 1]);
    const url: string = payload.sections[0].pages[0][0].imageUrl;
    expect(url).toMatch(/^\/media\/cache\//);
    await agent.get(url).expect(200);
    expect(fs.existsSync(ctx.config.dataDir)).toBe(true);
    // sin sesión no se sirve
    await request(app).get(url).expect(401);
  });

  it('rechaza nombres de archivo inválidos en /media', async () => {
    const { agent } = await setup(() => [item('1')]);
    await agent.get('/media/cache/..%2Fapp.db').expect(400);
  });
});
