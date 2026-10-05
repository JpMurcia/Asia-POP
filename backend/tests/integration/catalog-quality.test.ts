import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import type { CatalogPayload } from '../../src/catalog/types';
import { withPhotoVariants } from '../../src/pdf/photo-variants';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { heavyPng } from '../fixtures/photos';
import { FakeRenderer, loggedInAgent, testConfig, testContext } from '../helpers';

type Agent = ReturnType<typeof request.agent>;

let mock: AlegraMock;
afterEach(async () => mock?.close());

const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };

/** Producto de Alegra con la foto de la ruta indicada, con la forma real: `{ id, name, url, favorite }`. */
const photoItem = (id: string, route: string, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: 'desc',
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  // `?i=` distinto por producto: cada uno tiene su propio archivo en el caché
  images: [{ id: Number(id), name: `foto-${id}`, url: `${mock.url}${route}?i=${id}`, favorite: true }],
  ...over,
});

const ITEMS = (): AlegraItemRaw[] => [
  photoItem('1', '/img/heavy.png'),
  photoItem('2', '/img/heavy.jpg'),
  photoItem('3', '/img/alpha.png'),
  photoItem('4', '/img/tiny.png'),
  photoItem('5', '/img/light.jpg'),
  photoItem('6', '/img/broken.jpg'),
];

const imagesOf = (p: CatalogPayload): Record<string, string> =>
  Object.fromEntries(p.sections.flatMap((s) => s.pages.flat()).map((i) => [i.id, i.imageUrl]));

/** El payload sin las direcciones de las fotos: lo demás debe ser idéntico entre calidades (FR-005). */
const withoutImages = (p: CatalogPayload) => ({
  ...p,
  sections: p.sections.map((s) => ({ ...s, pages: s.pages.map((pg) => pg.map((i) => ({ ...i, imageUrl: '' }))) })),
});

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

/** Mientras «renderiza» pide, con la sesión, lo mismo que pediría el navegador de la generación. */
class InspectingRenderer extends FakeRenderer {
  agent?: Agent;
  inspected?: { plain: CatalogPayload; optimized: CatalogPayload; bytes: Map<string, Buffer> };

  override async render(url: string, sessionId: string): Promise<Buffer> {
    if (this.agent && url.includes('quality=optimized')) {
      const id = /\/print\/([^?]+)/.exec(url)![1]!;
      const optimized = (await this.agent.get(`/api/catalog/payload/${id}?quality=optimized`).expect(200)).body as CatalogPayload;
      const plain = (await this.agent.get(`/api/catalog/payload/${id}`).expect(200)).body as CatalogPayload;
      const bytes = new Map<string, Buffer>();
      for (const u of Object.values(imagesOf(optimized))) {
        if (u.startsWith('/media/pdf/')) bytes.set(u, await binary(this.agent, u));
      }
      this.inspected = { plain, optimized, bytes };
    }
    return super.render(url, sessionId);
  }
}

async function setup(items: (() => AlegraItemRaw[]) | null = ITEMS) {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
  if (items) mock.setItems(items());
  const renderer = new InspectingRenderer();
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer });
  const session = await loggedInAgent(ctx);
  renderer.agent = session.agent;
  await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  return { ...session, renderer };
}

async function waitFor(agent: Agent, status: string) {
  for (let i = 0; i < 200; i++) {
    const res = await agent.get('/api/catalog/jobs/current');
    if (res.body.status === status) return res.body;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`el trabajo no llegó a ${status}`);
}

const photosDir = (ctx: { config: { dataDir: string } }) => path.join(ctx.config.dataDir, 'pdf-photos');
const leftovers = (ctx: { config: { dataDir: string } }): string[] =>
  fs.existsSync(photosDir(ctx)) ? fs.readdirSync(photosDir(ctx)) : [];

describe('calidad del PDF: Optimizada', () => {
  it('por defecto reduce las fotos y el navegador de la generación las recibe con ?quality=optimized (FR-002, FR-005)', async () => {
    const { agent, ctx, renderer } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    expect(prep.report.counts.included).toBe(6);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202); // sin `quality`
    await waitFor(agent, 'done');

    expect(renderer.calls[0]!.url).toContain(`/print/${prep.prepareId}?quality=optimized`);
    const { plain, optimized, bytes } = renderer.inspected!;
    const before = imagesOf(plain);
    const after = imagesOf(optimized);
    const cacheDir = path.join(ctx.config.dataDir, 'image-cache');

    // Sin el parámetro: las direcciones originales de siempre
    for (const url of Object.values(before)) expect(url).toMatch(/^\/media\/cache\//);

    // Las fotos pesadas se reducen: copia más liviana que el archivo original
    for (const id of ['1', '2']) {
      expect(after[id]).toMatch(/^\/media\/pdf\/[^/]+\/[\w.-]+\.jpg$/);
      const original = fs.statSync(path.join(cacheDir, path.basename(before[id]!))).size;
      expect(bytes.get(after[id]!)!.length).toBeLessThan(original / 3);
    }

    // La que tiene transparencia real sigue siendo PNG con su transparencia (FR-006)
    expect(after['3']).toMatch(/\.png$/);
    const { data } = await sharp(bytes.get(after['3']!)!).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);

    // Todo lo demás del payload es idéntico (FR-005)
    expect(withoutImages(optimized)).toEqual(withoutImages(plain));
  });

  it('las fotos que no se pueden reducir conservan su dirección y la generación no se detiene (FR-007, FR-008)', async () => {
    const { agent, renderer } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    const job = await waitFor(agent, 'done');
    expect(job.catalogId).toBeTruthy();
    const { plain, optimized } = renderer.inspected!;
    for (const id of ['4', '5', '6']) {
      // diminuta, ya liviana y dañada
      expect(imagesOf(optimized)[id]).toBe(imagesOf(plain)[id]);
    }
  });

  it('al terminar no quedan copias en disco ni en la preparación', async () => {
    const { agent, ctx } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitFor(agent, 'done');
    expect(leftovers(ctx)).toEqual([]);
    expect(ctx.prepares.get(prep.prepareId)!.variants).toBeUndefined();
    // Y el payload sin generación en curso vuelve a ser el de siempre, aunque se pida ?quality=optimized
    const after = (await agent.get(`/api/catalog/payload/${prep.prepareId}?quality=optimized`).expect(200)).body as CatalogPayload;
    for (const url of Object.values(imagesOf(after))) expect(url).toMatch(/^\/media\/cache\//);
  });

  it('si el renderizado falla también se borran las copias, y no hay entrada de historial', async () => {
    const { agent, ctx, renderer } = await setup();
    renderer.fail = true;
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    const job = await waitFor(agent, 'failed');
    expect(job.error).toBeTruthy();
    expect(leftovers(ctx)).toEqual([]);
    expect(ctx.prepares.get(prep.prepareId)!.variants).toBeUndefined();
    expect((await agent.get('/api/catalog/history').expect(200)).body).toEqual([]);
  });

  it('una foto del caché borrada antes de generar se omite sin lanzar: no hay copia y el resto se reduce', async () => {
    const { agent, ctx, renderer } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const plainPayload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body as CatalogPayload;
    const original = imagesOf(plainPayload)['1']!;
    fs.rmSync(path.join(ctx.config.dataDir, 'image-cache', path.basename(original)));
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitFor(agent, 'done'); // la guardia contra fotos rotas es del navegador real (pdf-render.test.ts)
    const { optimized } = renderer.inspected!;
    expect(imagesOf(optimized)['1']).toBe(original);
    expect(imagesOf(optimized)['2']).toMatch(/^\/media\/pdf\//);
  });

  it('también reduce la imagen subida de un producto propio', async () => {
    const { agent, renderer } = await setup(() => []);
    const section = (await agent.post('/api/sections/custom').send({ name: 'MOCHIS' }).expect(201)).body;
    const product = (await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Mochi', price: 8000 }).expect(201)).body;
    await agent.put(`/api/custom-products/${product.id}/image`).attach('image', await heavyPng(), 'mochi.png').expect(200);

    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitFor(agent, 'done');
    const { plain, optimized, bytes } = renderer.inspected!;
    const before = imagesOf(plain)[product.id]!;
    const after = imagesOf(optimized)[product.id]!;
    expect(before).toMatch(/^\/media\/uploads\//);
    expect(after).toMatch(/^\/media\/pdf\/.+\.jpg$/);
    expect(bytes.get(after)!.length).toBeLessThan((await heavyPng()).length / 3);
  });
});

describe('calidad del PDF: validación y rutas', () => {
  it('una calidad desconocida se rechaza con 422 validation_error', async () => {
    const { agent } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, quality: 'ultra' }).expect(422);
    expect(res.body.error).toBe('validation_error');
    expect((await agent.get('/api/catalog/jobs/current')).body.status).toBe('idle');
  });

  it('/media/pdf exige sesión, nombres seguros y que la copia exista', async () => {
    const { app, agent } = await setup();
    await request(app).get('/media/pdf/run1/abc.jpg').expect(401);
    const bad = await agent.get('/media/pdf/run1/a%20b.jpg').expect(400);
    expect(bad.body.error).toBe('invalid_file');
    await agent.get('/media/pdf/run%201/abc.jpg').expect(400);
    const missing = await agent.get('/media/pdf/run1/abc.jpg').expect(404);
    expect(missing.body.error).toBe('not_found');
  });

  it('ninguna respuesta lleva direcciones firmadas ni la URL de origen, y a Alegra solo se le hacen GET (principios I y III)', async () => {
    const { agent, renderer } = await setup();
    const bodies: string[] = [];
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    bodies.push(JSON.stringify(prep));
    const gen = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    bodies.push(JSON.stringify(gen.body));
    bodies.push(JSON.stringify(await waitFor(agent, 'done')));
    bodies.push(JSON.stringify(renderer.inspected));
    for (const body of bodies) {
      expect(body).not.toContain('Signature=');
      expect(body).not.toContain('Expires=');
      expect(body).not.toContain(mock.url);
    }
    const toAlegra = mock.requests.filter((r) => !r.path.startsWith('/img/'));
    expect(toAlegra.length).toBeGreaterThan(0);
    expect(toAlegra.every((r) => r.method === 'GET')).toBe(true);
  });
});

describe('tamaño y calidad del catálogo generado (FR-011)', () => {
  const generate = async (agent: Agent, prepareId: string, quality?: string) => {
    await agent.post('/api/catalog/generate').send({ prepareId, ...(quality ? { quality } : {}) }).expect(202);
    return waitFor(agent, 'done');
  };

  it('el trabajo terminado informa el tamaño real del PDF y la calidad pedida', async () => {
    const { agent } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const job = await generate(agent, prep.prepareId, 'original');
    const pdf = await binary(agent, `/api/catalog/history/${job.catalogId}/pdf`);
    expect(job.sizeBytes).toBe(pdf.length);
    expect(job.sizeBytes).toBeGreaterThan(0);
    expect(job.quality).toBe('original');
  });

  it('sin indicar la calidad el trabajo informa Optimizada', async () => {
    const { agent } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const job = await generate(agent, prep.prepareId);
    expect(job.quality).toBe('optimized');
    expect(typeof job.sizeBytes).toBe('number');
  });

  it('el historial informa el tamaño de cada catálogo y lo omite si el archivo ya no existe', async () => {
    const { agent, ctx } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const first = await generate(agent, prep.prepareId, 'optimized');
    const second = await generate(agent, prep.prepareId, 'original');

    const list = (await agent.get('/api/catalog/history').expect(200)).body as { id: string; sizeBytes?: number }[];
    expect(list).toHaveLength(2);
    for (const entry of list) expect(entry.sizeBytes).toBe(fs.statSync(ctx.history.filePath(entry.id)!).size);

    fs.rmSync(ctx.history.filePath(first.catalogId)!);
    const after = (await agent.get('/api/catalog/history').expect(200)).body as { id: string; sizeBytes?: number }[];
    expect(after.find((e) => e.id === first.catalogId)).not.toHaveProperty('sizeBytes');
    expect(after.find((e) => e.id === second.catalogId)!.sizeBytes).toBeGreaterThan(0);
  });

  it('la calidad usada se guarda en params_json junto a las páginas', async () => {
    const { agent, ctx } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    const job = await generate(agent, prep.prepareId, 'original');
    const row = ctx.db.prepare('SELECT params_json FROM generated_catalog WHERE id = ?').get(job.catalogId) as { params_json: string };
    expect(JSON.parse(row.params_json)).toMatchObject({ quality: 'original', pages: expect.any(Number) });
  });

  it('una generación fallida no informa tamaño ni calidad', async () => {
    const { agent, renderer } = await setup();
    renderer.fail = true;
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    const job = await waitFor(agent, 'failed');
    expect(job).not.toHaveProperty('sizeBytes');
    expect(job).not.toHaveProperty('quality');
  });
});

describe('calidad del PDF: Original (FR-009) y lo que no cambia entre calidades (FR-005)', () => {
  it('Original no prepara copias, no agrega ?quality a la vista de impresión y el trabajo informa Original', async () => {
    const { agent, ctx, renderer } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, quality: 'original' }).expect(202);
    const job = await waitFor(agent, 'done');

    expect(job.quality).toBe('original');
    expect(renderer.calls[0]!.url).toMatch(new RegExp(`/print/${prep.prepareId}$`)); // sin parámetros
    expect(renderer.inspected).toBeUndefined(); // el optimizador no corrió: nadie pidió copias
    expect(fs.existsSync(photosDir(ctx))).toBe(false); // ni siquiera se creó la carpeta temporal
  });

  it('después de generar en Original, pedir ?quality=optimized devuelve las fotos originales', async () => {
    const { agent } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, quality: 'original' }).expect(202);
    await waitFor(agent, 'done');
    const plain = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body as CatalogPayload;
    const asked = (await agent.get(`/api/catalog/payload/${prep.prepareId}?quality=optimized`).expect(200)).body as CatalogPayload;
    expect(asked).toEqual(plain);
  });

  it('el payload de Optimizada es idéntico al de Original salvo las direcciones de las fotos, y volviendo a ponerlas es el mismo', async () => {
    const { agent, renderer } = await setup();
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, quality: 'optimized' }).expect(202);
    await waitFor(agent, 'done');
    const { plain, optimized } = renderer.inspected!;

    const before = imagesOf(plain);
    const after = imagesOf(optimized);
    expect(Object.values(after).some((url) => url.startsWith('/media/pdf/'))).toBe(true); // sí hubo copias
    const inverse = new Map(Object.keys(after).map((id) => [after[id]!, before[id]!] as const));
    expect(withPhotoVariants(optimized, inverse)).toEqual(plain);
  });

  it('con fotos que el optimizador rechaza (diminuta, ya liviana, dañada) Optimizada produce lo mismo que Original', async () => {
    const { agent, ctx, renderer } = await setup(() => [
      photoItem('4', '/img/tiny.png'),
      photoItem('5', '/img/light.jpg'),
      photoItem('6', '/img/broken.jpg'),
    ]);
    const { body: prep } = await agent.post('/api/catalog/prepare').send({}).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, quality: 'optimized' }).expect(202);
    await waitFor(agent, 'done');

    // No hubo copias: la vista de impresión se abre sin parámetro, igual que en Original
    expect(renderer.calls[0]!.url).not.toContain('quality');
    expect(renderer.inspected).toBeUndefined();
    expect(leftovers(ctx)).toEqual([]);
    const plain = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body as CatalogPayload;
    const asked = (await agent.get(`/api/catalog/payload/${prep.prepareId}?quality=optimized`).expect(200)).body as CatalogPayload;
    expect(asked).toEqual(plain);
  });
});
