import sharp from 'sharp';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import type { ProductsEl, Template, WorkspaceState } from '../../src/catalog/template';
import { baseTemplate } from '../../src/catalog/template-presets';
import type { CatalogPayload } from '../../src/catalog/types';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { FakeRenderer, loggedInAgent, testConfig, testContext, waitForAlegraData } from '../helpers';

type Agent = ReturnType<typeof request.agent>;

let mock: AlegraMock;
afterEach(async () => mock?.close());

const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };
const CARD_URL = /^\/media\/cards\/[0-9a-f]{40}\.jpg$/;

const item = (id: string, route: string | null, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: 'desc',
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: route ? [{ id: Number(id), name: `foto-${id}`, url: `${mock.url}${route}?i=${id}`, favorite: true }] : [],
  ...over,
});

async function setup(items: AlegraItemRaw[] | null = null) {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
  mock.setItems(items ?? [item('1', '/img/heavy.png'), item('2', '/img/light.jpg'), item('3', '/img/alpha.png'), item('4', null)]);
  const renderer = new FakeRenderer();
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer });
  const session = await loggedInAgent(ctx);
  await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  await waitForAlegraData(session.agent);
  return { ...session, renderer };
}

/** Guarda una plantilla `tcard`: la de Neón Noche con el bloque de productos en foto-tarjeta. */
async function saveCardTemplate(agent: Agent, over: Partial<ProductsEl> = {}) {
  const ws = (await agent.get('/api/settings/templates').expect(200)).body as WorkspaceState;
  const t: Template = { ...structuredClone(baseTemplate('neon')), id: 'tcard', name: 'Con tarjeta' };
  t.pages.productos.els = t.pages.productos.els.map((el) =>
    el.type === 'products' ? ({ ...el, cardStyle: 'tarjeta', nameStyle: 'tarjeta', ...over } as ProductsEl) : el,
  );
  await agent
    .put('/api/settings/templates')
    .send({ templates: [...ws.templates, t], defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision })
    .expect(200);
}

const prepare = async (agent: Agent, body: object = {}) => (await agent.post('/api/catalog/prepare').send(body).expect(200)).body;
const payload = async (agent: Agent, id: string, query = ''): Promise<CatalogPayload> =>
  (await agent.get(`/api/catalog/payload/${id}${query}`).expect(200)).body;
const items = (p: CatalogPayload) => p.sections.flatMap((s) => s.pages.flat());
const binary = async (agent: Agent, url: string): Promise<Buffer> =>
  (
    await agent
      .get(url)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200)
  ).body as Buffer;

describe('foto-tarjeta en el payload', () => {
  it('con cardStyle tarjeta cada producto con foto llega con su tarjeta JPEG del tamaño de su recuadro', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    expect(prep.report.counts.included).toBe(3); // el producto sin foto queda fuera, como siempre
    const got = items(await payload(agent, prep.prepareId));
    expect(got).toHaveLength(3);
    for (const i of got) expect(i.imageUrl, i.name).toMatch(CARD_URL);
    const meta = await sharp(await binary(agent, got[0]!.imageUrl)).metadata();
    expect(meta.format).toBe('jpeg');
    // El recuadro de la foto de Neón Noche a 150 ppp: la misma proporción que el recuadro de la plantilla
    expect(meta.width! / meta.height!).toBeCloseTo(0.29 * 595.28 / ((0.27 / 0.852) * 0.852 * 841.89), 1);
  });

  it('es estable: pedir el payload dos veces da las mismas tarjetas (mismos nombres, mismos bytes)', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    const a = items(await payload(agent, prep.prepareId)).map((i) => i.imageUrl);
    const b = items(await payload(agent, prep.prepareId)).map((i) => i.imageUrl);
    expect(a).toEqual(b);
    expect((await binary(agent, a[0]!)).equals(await binary(agent, b[0]!))).toBe(true);
  });

  it('con una plantilla sin tarjeta el payload es el de siempre: las fotos de /media/cache (FR-022)', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    for (const i of items(await payload(agent, prep.prepareId))) expect(i.imageUrl).toMatch(/^\/media\/cache\//);
  });

  it('?quality=optimized no vuelve a reducir las tarjetas', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    const plain = items(await payload(agent, prep.prepareId)).map((i) => i.imageUrl);
    const optimized = items(await payload(agent, prep.prepareId, '?quality=optimized')).map((i) => i.imageUrl);
    expect(optimized).toEqual(plain);
  });

  it('el modo cambia la tarjeta: marco y sin-fondo dan direcciones distintas', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const marco = await prepare(agent, { templateId: 'tcard', photoBackdrop: 'marco' });
    const sin = await prepare(agent, { templateId: 'tcard', photoBackdrop: 'sin-fondo' });
    expect(marco.options.photoBackdrop).toBe('marco');
    expect(sin.options.photoBackdrop).toBe('sin-fondo');
    const a = items(await payload(agent, marco.prepareId)).map((i) => i.imageUrl);
    const b = items(await payload(agent, sin.prepareId)).map((i) => i.imageUrl);
    expect(a).not.toEqual(b);
  });

  it('un photoBackdrop desconocido se rechaza', async () => {
    const { agent } = await setup();
    await agent.post('/api/catalog/prepare').send({ photoBackdrop: 'neon' }).expect(422);
  });
});

describe('/media/cards', () => {
  it('solo sirve nombres <sha1>.jpg que existen; cualquier otro responde 404', async () => {
    const { agent } = await setup();
    for (const name of ['abc.jpg', '..%2Fsecreto.jpg', 'a'.repeat(40) + '.png', '0'.repeat(40) + '.jpg', '.', '..']) {
      await agent.get(`/media/cards/${name}`).expect(404);
    }
  });

  it('exige sesión', async () => {
    const { ctx } = await setup();
    await request(await (await import('../../src/app')).createApp(ctx)).get('/media/cards/' + '0'.repeat(40) + '.jpg').expect(401);
  });
});

describe('POST /catalog/card-preview', () => {
  it('devuelve la tarjeta del primer producto con foto en el modo pedido', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    const res = await agent.post('/api/catalog/card-preview').send({ prepareId: prep.prepareId, backdrop: 'marco' }).expect(200);
    expect(res.body).toMatchObject({ used: 'marco', fellBack: false, reason: null });
    expect(res.body.url).toMatch(CARD_URL);
    expect(typeof res.body.itemName).toBe('string');
    expect((await binary(agent, res.body.url)).length).toBeGreaterThan(1000);
  });

  it('con sin-fondo informa el modo realmente usado (los PNG de ruido no se pueden separar: cae al marco)', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    const res = await agent.post('/api/catalog/card-preview').send({ prepareId: prep.prepareId, backdrop: 'sin-fondo' }).expect(200);
    expect(['marco', 'sin-fondo']).toContain(res.body.used);
    expect(res.body.fellBack).toBe(res.body.used === 'marco');
    if (res.body.fellBack) expect(typeof res.body.reason).toBe('string');
  });

  it('una preparación vencida responde 410; sin productos con foto, 404; un modo desconocido, 422', async () => {
    const { agent } = await setup();
    await agent.post('/api/catalog/card-preview').send({ prepareId: 'no-existe', backdrop: 'marco' }).expect(410);
    const prep = await prepare(agent);
    await agent.post('/api/catalog/card-preview').send({ prepareId: prep.prepareId, backdrop: 'raro' }).expect(422);
    await agent.post('/api/catalog/card-preview').send({ prepareId: prep.prepareId, backdrop: 'marco', itemId: 'zzz' }).expect(404);
  });
});

describe('generación con foto-tarjeta', () => {
  async function waitDone(agent: Agent) {
    for (let i = 0; i < 200; i++) {
      const res = await agent.get('/api/catalog/jobs/current');
      if (res.body.status === 'done' || res.body.status === 'failed') return res.body;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('el trabajo no terminó');
  }

  it('genera con la plantilla de tarjeta y, sin nada que informar, no trae backdropFallbacks', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, photoBackdrop: 'marco' }).expect(202);
    const job = await waitDone(agent);
    expect(job.status).toBe('done');
    expect(job.backdropFallbacks).toBeUndefined();
  });

  it('informa los productos cuya foto cayó al modo seguro al pedir sin-fondo', async () => {
    const { agent } = await setup();
    await saveCardTemplate(agent);
    const prep = await prepare(agent, { templateId: 'tcard' });
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, photoBackdrop: 'sin-fondo' }).expect(202);
    const job = await waitDone(agent);
    expect(job.status).toBe('done');
    // Las fotos de prueba son ruido de colores: ninguna tiene fondo liso, así que todas caen al marco y se informan
    expect(job.backdropFallbacks).toBeDefined();
    expect(job.backdropFallbacks.length).toBeGreaterThan(0);
    for (const f of job.backdropFallbacks) expect(typeof f.item).toBe('string');
  });
});
