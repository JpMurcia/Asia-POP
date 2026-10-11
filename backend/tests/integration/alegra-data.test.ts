import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { ConnectionRepo } from '../../src/alegra/connection.repo';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { loggedInAgent, refreshAlegraData, testConfig, testContext, waitForAlegraData } from '../helpers';

const mocks: AlegraMock[] = [];
afterEach(async () => {
  while (mocks.length) await mocks.pop()!.close();
});

const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };

const item = (mock: AlegraMock, id: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: 'desc',
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [{ id: Number(id), name: 'foto.jpg', url: `${mock.url}/img/ok.png?Signature=firma-${id}`, favorite: true }],
  ...over,
});

async function start(opts: { delayMs?: number; items?: (m: AlegraMock) => AlegraItemRaw[] } = {}) {
  const mock = await startAlegraMock({
    categories: [
      { id: 'c1', name: 'RAMEN' },
      { id: 'c2', name: 'SNACKS' },
    ],
    delayMs: opts.delayMs,
  });
  mocks.push(mock);
  mock.setItems(opts.items ? opts.items(mock) : [item(mock, '1'), item(mock, '2', { category: null }), item(mock, '3', { type: 'variantParent' })]);
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }) });
  const session = await loggedInAgent(ctx);
  return { mock, ...session };
}

type Session = Awaited<ReturnType<typeof start>>;

/** Conexión guardada y primera descarga terminada. */
async function connected(opts: Parameters<typeof start>[0] = {}): Promise<Session> {
  const s = await start(opts);
  await s.agent.put('/api/settings/alegra').send(creds).expect(200);
  const st = await waitForAlegraData(s.agent);
  expect(st.state).toBe('ready');
  return s;
}

const count = (mock: AlegraMock, path: string) => mock.requests.filter((r) => r.path === path).length;
const READS = ['/api/catalog/articles', '/api/catalog/uncategorized', '/api/bundles', '/api/bundles/component-options', '/api/sections'];

describe('GET /api/alegra/data', () => {
  it('sin conexión configurada responde 200 con state «none» (no es un error)', async () => {
    const { agent } = await start();
    const res = await agent.get('/api/alegra/data').expect(200);
    expect(res.body).toEqual({ state: 'none', syncedAt: null, articles: null, categories: null, progress: null, lastError: null });
  });

  it('guardar la conexión descarga una sola vez, en segundo plano, y deja el estado «ready» con las cifras', async () => {
    const { agent, mock } = await start();
    const put = await agent.put('/api/settings/alegra').send(creds).expect(200);
    expect(put.body).toMatchObject({ email: 'tienda@example.com', isConfigured: true });
    expect(put.body.data).toBeDefined();
    const st = await waitForAlegraData(agent);
    expect(st).toMatchObject({ state: 'ready', articles: 2, categories: 2, progress: null, lastError: null });
    expect(typeof st.syncedAt).toBe('string');
    // Una descarga completa: una página de categorías y una de artículos (más la validación de /company)
    expect(count(mock, '/item-categories')).toBe(1);
    expect(count(mock, '/items')).toBe(1);
  });

  it('nunca consulta a Alegra, ni siquiera mientras descarga: responde al instante con el avance', async () => {
    const { agent } = await start({ delayMs: 150 });
    await agent.put('/api/settings/alegra').send(creds).expect(200);
    const mid = (await agent.get('/api/alegra/data').expect(200)).body;
    expect(mid.state).toBe('syncing');
    expect(mid.syncedAt).toBeNull();
    expect(mid.progress).toMatchObject({ received: expect.any(Number) });
    const done = await waitForAlegraData(agent);
    expect(done.state).toBe('ready');
  });
});

describe('las pantallas leen la copia y no consultan a Alegra (SC-005)', () => {
  it.each(READS)('%s con copia vigente deja mock.requests sin cambios', async (path) => {
    const { agent, mock } = await connected();
    const before = mock.requests.length;
    await agent.get(path).expect(200);
    expect(mock.requests.length).toBe(before);
  });

  it('abrirlas varias veces seguidas tampoco consulta, y lo que devuelven viene de la copia', async () => {
    const { agent, mock } = await connected();
    const before = mock.requests.length;
    for (let i = 0; i < 3; i++) for (const path of READS) await agent.get(path).expect(200);
    expect(mock.requests.length).toBe(before);
    const articles = (await agent.get('/api/catalog/articles')).body.items as { itemId: string; name: string }[];
    expect(articles.map((a) => a.itemId).sort()).toEqual(['1', '2']); // el padre de variantes no se lista
    const sections = (await agent.get('/api/sections')).body as { key: string; name: string }[];
    expect(sections.map((s) => s.key)).toEqual(expect.arrayContaining(['alegra:c1', 'alegra:c2']));
    const uncategorized = (await agent.get('/api/catalog/uncategorized')).body.items as { itemId: string }[];
    expect(uncategorized.map((u) => u.itemId)).toEqual(['2']);
    expect((await agent.get('/api/bundles/component-options')).body.alegraAvailable).toBe(true);
  });

  it('lo local (omitir, asignar sección) se ve al instante, sin tocar la copia ni consultar', async () => {
    const { agent, mock } = await connected();
    const before = mock.requests.length;
    await agent.put('/api/catalog/omitted/1').expect(204);
    await agent.put('/api/catalog/uncategorized/2').send({ sectionKey: 'alegra:c2' }).expect(204);
    const articles = (await agent.get('/api/catalog/articles')).body.items as { itemId: string; omitted: boolean; sectionKey: string | null }[];
    expect(articles.find((a) => a.itemId === '1')!.omitted).toBe(true);
    expect(articles.find((a) => a.itemId === '2')!.sectionKey).toBe('alegra:c2');
    expect(mock.requests.length).toBe(before);
  });

  it('sin copia (borrada), la primera lectura descarga y las siguientes no', async () => {
    const { agent, mock, ctx } = await connected();
    ctx.db.prepare('DELETE FROM alegra_snapshot').run();
    expect((await agent.get('/api/alegra/data')).body.state).toBe('none');
    const before = mock.requests.length;
    await agent.get('/api/catalog/articles').expect(200);
    const afterFirst = mock.requests.length;
    expect(afterFirst).toBeGreaterThan(before);
    for (const path of READS) await agent.get(path).expect(200);
    expect(mock.requests.length).toBe(afterFirst);
    expect((await agent.get('/api/alegra/data')).body.state).toBe('ready');
  });

  it('sin copia y con Alegra rechazando las credenciales, responde el error de siempre (422 alegra_rejected)', async () => {
    const { agent, ctx } = await start();
    new ConnectionRepo(ctx.db, ctx.config).save('tienda@example.com', 'token-malo', new Date().toISOString());
    const res = await agent.get('/api/catalog/articles').expect(422);
    expect(res.body.error).toBe('alegra_rejected');
    expect((await agent.get('/api/alegra/data')).body.state).toBe('none');
  });

  it('sin copia y sin conexión configurada, las lecturas responden 422 alegra_not_configured', async () => {
    const { agent } = await start();
    expect((await agent.get('/api/catalog/articles').expect(422)).body.error).toBe('alegra_not_configured');
    expect((await agent.get('/api/catalog/uncategorized').expect(422)).body.error).toBe('alegra_not_configured');
  });

  it('bundles y component-options: sin copia y con la descarga fallando siguen siendo «mejor esfuerzo»', async () => {
    const { agent, ctx } = await start();
    new ConnectionRepo(ctx.db, ctx.config).save('tienda@example.com', 'token-malo', new Date().toISOString());
    const options = (await agent.get('/api/bundles/component-options').expect(200)).body;
    expect(options.alegraAvailable).toBe(false);
    expect(options.alegra).toEqual([]);
    await agent.get('/api/bundles').expect(200);
  });
});

describe('POST /api/alegra/data/refresh', () => {
  it('responde 202 con «syncing» y, al terminar, se ve el cambio hecho en Alegra', async () => {
    const { agent, mock } = await connected();
    mock.setItems([item(mock, '1', { price: 12000 }), item(mock, '4', { name: 'Nuevo' })]);
    // antes de actualizar, se sigue viendo lo guardado
    expect(((await agent.get('/api/catalog/articles')).body.items as { price: number }[]).map((i) => i.price)).toEqual([9000, 9000]);
    const res = await agent.post('/api/alegra/data/refresh').expect(202);
    expect(res.body.state).toBe('syncing');
    const st = await waitForAlegraData(agent);
    expect(st).toMatchObject({ state: 'ready', articles: 2, lastError: null });
    const items = (await agent.get('/api/catalog/articles')).body.items as { itemId: string; price: number }[];
    expect(items.map((i) => [i.itemId, i.price]).sort()).toEqual([['1', 12000], ['4', 9000]]);
  });

  it('sin conexión configurada responde 422 alegra_not_configured', async () => {
    const { agent } = await start();
    expect((await agent.post('/api/alegra/data/refresh').expect(422)).body.error).toBe('alegra_not_configured');
  });

  it('una segunda llamada mientras descarga no inicia otra: una sola ronda de peticiones', async () => {
    const { agent, mock } = await connected({ delayMs: 120 });
    const before = count(mock, '/items');
    const [a, b] = await Promise.all([agent.post('/api/alegra/data/refresh'), agent.post('/api/alegra/data/refresh')]);
    expect(a.status).toBe(202);
    expect(b.status).toBe(202);
    expect(b.body.state).toBe('syncing');
    await waitForAlegraData(agent);
    expect(count(mock, '/items') - before).toBe(1);
  });

  it('si Alegra falla durante la actualización, la copia sigue intacta y el estado trae lastError', async () => {
    const { agent, mock } = await connected();
    const first = (await agent.get('/api/alegra/data')).body;
    await mock.close();
    mocks.splice(mocks.indexOf(mock), 1);
    await agent.post('/api/alegra/data/refresh').expect(202);
    const st = await waitForAlegraData(agent);
    expect(st.state).toBe('ready');
    expect(st.syncedAt).toBe(first.syncedAt);
    expect(st.lastError).toMatchObject({ message: expect.stringMatching(/conectar con Alegra/) });
    expect(typeof st.lastError?.at).toBe('string');
    // las lecturas siguen mostrando la copia anterior
    const articles = (await agent.get('/api/catalog/articles').expect(200)).body.items as unknown[];
    expect(articles).toHaveLength(2);
  });

  it('refreshAlegraData pide la actualización y espera a que termine', async () => {
    const { agent, mock } = await connected();
    mock.setItems([item(mock, '1', { price: 7000 })]);
    const st = await refreshAlegraData(agent);
    expect(st).toMatchObject({ state: 'ready', articles: 1 });
    expect(((await agent.get('/api/catalog/articles')).body.items as { price: number }[])[0]!.price).toBe(7000);
  });
});

describe('cambio de cuenta y guardado de la conexión (FR-019)', () => {
  it('guardar la misma cuenta con copia no descarga', async () => {
    const { agent, mock } = await connected();
    const before = mock.requests.length;
    await agent.put('/api/settings/alegra').send(creds).expect(200);
    await waitForAlegraData(agent);
    // solo la validación de /company, ninguna descarga de artículos ni categorías
    expect(mock.requests.slice(before).filter((r) => r.path !== '/company')).toEqual([]);
  });

  it('guardar otra cuenta descarta la copia y descarga la de la cuenta nueva', async () => {
    const { agent, mock, ctx } = await connected();
    const other = await startAlegraMock({ email: 'otra@example.com', token: 'tok_otra', categories: [{ id: 'k1', name: 'BEBIDAS' }] });
    mocks.push(other);
    other.setItems([item(other, '77', { category: { id: 'k1', name: 'BEBIDAS' } })]);
    ctx.config.alegraBaseUrl = other.url;
    await agent.put('/api/settings/alegra').send({ email: 'otra@example.com', apiToken: 'tok_otra' }).expect(200);
    const st = await waitForAlegraData(agent);
    expect(st).toMatchObject({ state: 'ready', articles: 1, categories: 1 });
    const articles = (await agent.get('/api/catalog/articles').expect(200)).body.items as { itemId: string }[];
    expect(articles.map((a) => a.itemId)).toEqual(['77']);
    // los datos de la cuenta anterior ya no están
    expect(count(mock, '/items')).toBe(1);
  });

  it('guardar credenciales inválidas conserva las credenciales y la copia', async () => {
    const { agent, mock } = await connected();
    const before = (await agent.get('/api/alegra/data')).body;
    const res = await agent.put('/api/settings/alegra').send({ email: 'otra@example.com', apiToken: 'tok_malo' }).expect(422);
    expect(res.body.error).toBe('alegra_rejected');
    expect((await agent.get('/api/settings/alegra')).body.email).toBe('tienda@example.com');
    const after = (await agent.get('/api/alegra/data')).body;
    expect(after).toEqual(before);
    expect(after.state).toBe('ready');
    expect(count(mock, '/items')).toBe(1);
  });
});

describe('preparar el catálogo renueva la copia (FR-017, principio II)', () => {
  it('prepare descarga en vivo y deja esa descarga como la copia: las pantallas ya muestran el precio nuevo sin descargar otra vez', async () => {
    const { agent, mock } = await connected();
    mock.setItems([item(mock, '1', { price: 15000 }), item(mock, '2', { category: null, price: 8000 })]);
    await agent.post('/api/catalog/prepare').send({}).expect(200);
    const afterPrepare = mock.requests.length;
    const articles = (await agent.get('/api/catalog/articles').expect(200)).body.items as { itemId: string; price: number }[];
    expect(articles.map((a) => [a.itemId, a.price]).sort()).toEqual([['1', 15000], ['2', 8000]]);
    expect(mock.requests.length).toBe(afterPrepare);
    expect((await agent.get('/api/alegra/data')).body.lastError).toBeNull();
  });

  it('si prepare falla por Alegra, la copia anterior no cambia y no hay informe', async () => {
    const { agent, mock } = await connected();
    const before = (await agent.get('/api/alegra/data')).body;
    await mock.close();
    mocks.splice(mocks.indexOf(mock), 1);
    const res = await agent.post('/api/catalog/prepare').send({}).expect(502);
    expect(res.body.error).toBe('alegra_unreachable');
    expect((await agent.get('/api/alegra/data')).body.syncedAt).toBe(before.syncedAt);
    const articles = (await agent.get('/api/catalog/articles').expect(200)).body.items as unknown[];
    expect(articles).toHaveLength(2);
  });

  it('el catálogo siempre sale de datos recién descargados: prepare consulta a Alegra aunque haya copia', async () => {
    const { agent, mock } = await connected();
    const before = count(mock, '/items');
    await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(count(mock, '/items')).toBe(before + 1);
  });
});

describe('Alegra solo se lee y no se filtran credenciales ni direcciones de fotos', () => {
  it('toda petición a Alegra durante las descargas es GET', async () => {
    const { agent, mock } = await connected();
    await refreshAlegraData(agent);
    await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(mock.requests.length).toBeGreaterThan(0);
    expect(mock.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('las respuestas no llevan el token ni direcciones de fotos', async () => {
    const { agent, mock } = await connected();
    const bodies = [
      JSON.stringify((await agent.get('/api/alegra/data')).body),
      JSON.stringify((await agent.post('/api/alegra/data/refresh')).body),
      JSON.stringify((await agent.get('/api/catalog/articles')).body),
      JSON.stringify((await agent.get('/api/catalog/uncategorized')).body),
      JSON.stringify((await agent.get('/api/sections')).body),
    ];
    await waitForAlegraData(agent);
    for (const body of bodies) {
      expect(body).not.toContain('tok_valido');
      expect(body).not.toContain(mock.url);
      expect(body).not.toMatch(/Signature|https?:\/\//);
    }
  });

  it('la copia en la base de datos no guarda direcciones de fotos ni credenciales', async () => {
    const { ctx } = await connected();
    const row = ctx.db.prepare('SELECT items_json, categories_json, account_email FROM alegra_snapshot').get() as Record<string, string>;
    expect(`${row.items_json}${row.categories_json}`).not.toMatch(/https?:|Signature|firma-|tok_valido/);
    expect(row.account_email).toBe('tienda@example.com');
  });
});
