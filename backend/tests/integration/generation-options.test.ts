import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PDFParse } from 'pdf-parse';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { ROOT_DIR } from '../../src/config/env';
import { PrepareStore } from '../../src/catalog/prepare-store';
import { PuppeteerRenderer } from '../../src/pdf/pdf.service';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { FakeRenderer, loggedInAgent, SEED, testConfig, testContext } from '../helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };

let mock: AlegraMock;
/** Simulados abiertos por `setup()`; el bloque del PDF real gestiona el suyo. */
const opened: AlegraMock[] = [];
afterEach(async () => {
  await Promise.all(opened.splice(0).map((m) => m.close()));
});

const item = (id: string, cat: 'c1' | 'c2', over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: `desc ${id}`,
  status: 'active',
  price: 9000,
  category: { id: cat, name: cat === 'c1' ? 'RAMEN' : 'SNACKS' },
  images: [`${mock.url}/img/ok.png`],
  ...over,
});

const soldOut = { inventory: { availableQuantity: 0, trackInventory: true } };

/** RAMEN: 4 productos (1 agotado); SNACKS: 1; REGALOS (propia): un combo con un componente agotado. */
async function setup(renderer = new FakeRenderer()) {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }, { id: 'c2', name: 'SNACKS' }] });
  opened.push(mock);
  mock.setItems([
    item('1', 'c1'),
    item('2', 'c1', soldOut),
    item('3', 'c1'),
    item('4', 'c1'),
    item('5', 'c2'),
  ]);
  const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer });
  const session = await loggedInAgent(ctx);
  const { agent } = session;
  await agent.put('/api/settings/alegra').send(creds).expect(200);
  const section = (await agent.post('/api/sections/custom').send({ name: 'REGALOS' }).expect(201)).body;
  const bundle = (
    await agent
      .post('/api/bundles')
      .send({
        sectionId: section.id,
        name: 'Combo regalo',
        description: 'Un regalo',
        pricing: { type: 'discount', percent: 10 },
        components: [
          { source: 'alegra', productId: '1', quantity: 1 },
          { source: 'alegra', productId: '2', quantity: 1 },
        ],
      })
      .expect(201)
  ).body;
  await agent.put(`/api/bundles/${bundle.id}/image`).attach('image', PNG, 'b.png').expect(200);
  return { ...session, renderer, section, bundle, regalos: `custom:${section.id}` };
}

type Agent = Awaited<ReturnType<typeof setup>>['agent'];
const prepare = async (agent: Agent, body: object = {}) => (await agent.post('/api/catalog/prepare').send(body).expect(200)).body;
const putOptions = (agent: Agent, id: string, body: object) => agent.put(`/api/catalog/prepare/${id}/options`).send(body);

async function waitFor(agent: Agent, status: string) {
  for (let i = 0; i < 100; i++) {
    const res = await agent.get('/api/catalog/jobs/current');
    if (res.body.status === status) return res.body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`el trabajo no llegó a ${status}`);
}

describe('opciones de generación (API)', () => {
  it('prepare devuelve estructura, secciones disponibles y opciones', async () => {
    const { agent } = await setup();
    const body = await prepare(agent);
    expect(body.options).toEqual({ hideSoldOut: false });
    expect(body.availableSections.map((s: { key: string }) => s.key)).toContain('alegra:c1');
    expect(body.availableSections.find((s: { key: string }) => s.key === 'alegra:c1')).toMatchObject({
      name: 'RAMEN',
      source: 'alegra',
      items: 4,
    });
    // RAMEN 4 productos = 2 páginas, SNACKS 1 = 1 página, REGALOS 1 = 1 página
    expect(body.structure).toMatchObject({ coverPages: 1, sectionCoverPages: 3, productPages: 4, termsPages: 1, totalPages: 9 });
  });

  it('PUT options recalcula informe, estructura y secciones SIN consultar Alegra', async () => {
    const { agent, regalos } = await setup();
    const prep = await prepare(agent);
    const before = mock.requests.length;

    const res = await putOptions(agent, prep.prepareId, { sectionKeys: ['alegra:c2'] }).expect(200);
    expect(res.body.structure).toMatchObject({ sectionCoverPages: 1, productPages: 1, totalPages: 1 + 1 + 1 + 1 });
    expect(res.body.options.sectionKeys).toEqual(['alegra:c2']);
    // la lista de secciones disponibles no se encoge al desmarcar
    expect(res.body.availableSections.map((s: { key: string }) => s.key)).toEqual(
      expect.arrayContaining(['alegra:c1', 'alegra:c2', regalos]),
    );

    const hidden = await putOptions(agent, prep.prepareId, { hideSoldOut: true }).expect(200);
    expect(hidden.body.report.counts.soldOut).toBe(0);
    expect(hidden.body.report.soldOutBundles).toEqual([]);
    expect(mock.requests).toHaveLength(before);
  });

  it('valida las opciones con código propio y detalles', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    const res = await putOptions(agent, prep.prepareId, { bannerText: 'x'.repeat(81) }).expect(422);
    expect(res.body.error).toBe('invalid_options');
    expect(res.body.details[0]).toMatchObject({ field: 'bannerText' });
    const res2 = await agent.post('/api/catalog/prepare').send({ bannerText: 'x'.repeat(81) }).expect(422);
    expect(res2.body.error).toBe('invalid_options');
  });

  it('410 si la preparación no existe o expiró', async () => {
    const { agent } = await setup();
    const res = await putOptions(agent, 'no-existe', { hideSoldOut: true }).expect(410);
    expect(res.body.error).toBe('prepare_expired');
  });

  it('410 cuando la preparación venció (15 minutos), tanto al cambiar opciones como al generar', async () => {
    let clock = 1_000_000;
    mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
    opened.push(mock);
    mock.setItems([item('1', 'c1')]);
    const ctx = testContext({
      config: testConfig({ alegraBaseUrl: mock.url }),
      prepares: new PrepareStore(() => clock),
    });
    const { agent } = await loggedInAgent(ctx);
    await agent.put('/api/settings/alegra').send(creds).expect(200);
    const prep = await prepare(agent);

    clock += 14 * 60 * 1000; // aún vigente
    await putOptions(agent, prep.prepareId, { hideSoldOut: true }).expect(200);

    clock += 16 * 60 * 1000; // vencida
    const stale = await putOptions(agent, prep.prepareId, { hideSoldOut: false }).expect(410);
    expect(stale.body.error).toBe('prepare_expired');
    const gen = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(410);
    expect(gen.body.error).toBe('prepare_expired');
  });

  it('las plantillas se editan aunque Alegra no responda', async () => {
    const { agent } = await setup();
    await mock.close(); // Alegra caído
    const ws = (await agent.get('/api/settings/templates').expect(200)).body;
    const templates = structuredClone(ws.templates);
    templates[0].palette.bg = '#112233';
    await agent
      .put('/api/settings/templates')
      .send({ templates, defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision })
      .expect(200);
    const down = await agent.post('/api/catalog/prepare').send({}).expect(502);
    expect(down.body.error).toBe('alegra_unreachable');
    mock = await startAlegraMock(); // para que afterEach tenga algo que cerrar
    opened.push(mock);
  });

  it('409 si hay un renderizado activo', async () => {
    const renderer = new FakeRenderer();
    renderer.delayMs = 300;
    const { agent } = await setup(renderer);
    const prep = await prepare(agent);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId, bundleDecisions: { [prep.report.soldOutBundles[0].bundleId]: 'keep' } }).expect(202);
    const res = await putOptions(agent, prep.prepareId, { hideSoldOut: true }).expect(409);
    expect(res.body.error).toBe('job_in_progress');
    await waitFor(agent, 'done');
  });

  describe('combos agotados y secciones', () => {
    it('con la sección del combo incluida se exige decisión', async () => {
      const { agent } = await setup();
      const prep = await prepare(agent);
      const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(422);
      expect(res.body.error).toBe('bundle_decision_required');
    });

    it('con la sección del combo desmarcada no se exige decisión ni se informa', async () => {
      const { agent } = await setup();
      const prep = await prepare(agent);
      const res = await putOptions(agent, prep.prepareId, { sectionKeys: ['alegra:c1', 'alegra:c2'] }).expect(200);
      expect(res.body.report.soldOutBundles).toEqual([]);
      await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
      await waitFor(agent, 'done');
    });

    it('con "ocultar agotados" el combo se omite sin pedir decisión', async () => {
      const { agent } = await setup();
      const prep = await prepare(agent);
      await putOptions(agent, prep.prepareId, { hideSoldOut: true }).expect(200);
      await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
      await waitFor(agent, 'done');
      const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
      const all = payload.sections.flatMap((s: { pages: { kind: string }[][] }) => s.pages.flat());
      expect(all.some((i: { kind: string }) => i.kind === 'bundle')).toBe(false);
    });

    it('una decisión "omitir" no vuelve a incluir el combo en el payload que lee la vista de impresión', async () => {
      const { agent, bundle } = await setup();
      const prep = await prepare(agent);
      await agent
        .post('/api/catalog/generate')
        .send({ prepareId: prep.prepareId, bundleDecisions: { [bundle.id]: 'omit' } })
        .expect(202);
      await waitFor(agent, 'done');
      const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
      const all = payload.sections.flatMap((s: { pages: { kind: string }[][] }) => s.pages.flat());
      expect(all.some((i: { kind: string }) => i.kind === 'bundle')).toBe(false);
    });

    it('PUT options con las decisiones refleja la estructura final', async () => {
      const { agent, bundle } = await setup();
      const prep = await prepare(agent);
      const keep = await putOptions(agent, prep.prepareId, { bundleDecisions: { [bundle.id]: 'keep' } }).expect(200);
      const omit = await putOptions(agent, prep.prepareId, { bundleDecisions: { [bundle.id]: 'omit' } }).expect(200);
      // omitir el combo deja REGALOS sin contenido: una portada y una página menos
      expect(keep.body.structure.totalPages - omit.body.structure.totalPages).toBe(2);
    });
  });

  it('generate usa las opciones vigentes (secciones y banner)', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    await putOptions(agent, prep.prepareId, { sectionKeys: ['alegra:c2'], bannerText: '  Oferta de octubre ' }).expect(200);
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitFor(agent, 'done');
    const payload = (await agent.get(`/api/catalog/payload/${prep.prepareId}`).expect(200)).body;
    expect(payload.sections.map((s: { key: string }) => s.key)).toEqual(['alegra:c2']);
    expect(payload.config.coverTitle).toBe('Oferta de octubre');
  });

  it('todas las secciones desmarcadas: 422 empty_catalog al generar', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    const res = await putOptions(agent, prep.prepareId, { sectionKeys: [] }).expect(200);
    expect(res.body.structure.nothingToGenerate).toBe(true);
    expect(res.body.report.emptyCatalog).toBe(true);
    const gen = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(422);
    expect(gen.body.error).toBe('empty_catalog');
  });

  it('requiere sesión', async () => {
    const { app } = await setup();
    await request(app).put('/api/catalog/prepare/x/options').send({}).expect(401);
  });
});

describe('la estructura coincide con el PDF real (SC-003)', () => {
  const DIST = path.join(ROOT_DIR, 'frontend', 'dist');
  let server: Server;
  let renderer: PuppeteerRenderer;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      execSync('npm run build -w frontend', { cwd: ROOT_DIR, stdio: 'ignore' });
    }
    mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }, { id: 'c2', name: 'SNACKS' }] });
    mock.setItems([item('1', 'c1'), item('2', 'c1', soldOut), item('3', 'c1'), item('4', 'c1'), item('5', 'c2')]);
    renderer = new PuppeteerRenderer();
    const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url, frontendDir: DIST }), renderer });
    const app = createApp(ctx);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    ctx.runtime.baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    agent = request.agent(server);
    await agent.post('/api/auth/login').send(SEED).expect(204);
    await agent.put('/api/settings/alegra').send(creds).expect(200);
  }, 120_000);

  afterAll(async () => {
    await renderer?.close();
    await new Promise((r) => server?.close(r));
    await mock?.close();
  });

  async function generatePages(options: object): Promise<{ pages: number; text: string; total: number }> {
    const prep = (await agent.post('/api/catalog/prepare').send({}).expect(200)).body;
    const structure = (await agent.put(`/api/catalog/prepare/${prep.prepareId}/options`).send(options).expect(200)).body.structure;
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    let job: { status: string; catalogId?: string; error?: string } = { status: 'rendering' };
    for (let i = 0; i < 400 && job.status === 'rendering'; i++) {
      await new Promise((r) => setTimeout(r, 250));
      job = (await agent.get('/api/catalog/jobs/current')).body;
    }
    if (job.status !== 'done') throw new Error(`generación fallida: ${job.error ?? job.status}`);
    const res = await agent.get(`/api/catalog/history/${job.catalogId}/pdf`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    const parser = new PDFParse({ data: new Uint8Array(res.body as Buffer) });
    const info = await parser.getInfo();
    const { text } = await parser.getText();
    await parser.destroy();
    return { pages: info.total, text, total: structure.totalPages };
  }

  it('páginas del PDF = structure.totalPages con todas las secciones', async () => {
    const r = await generatePages({});
    expect(r.pages).toBe(r.total);
    expect(r.pages).toBe(1 + 2 + 2 + 1 + 1); // portada + RAMEN(portada+2) + SNACKS(portada+1) + políticas
  }, 120_000);

  it('con una sección menos, agotados ocultos y banner propio', async () => {
    const r = await generatePages({ sectionKeys: ['alegra:c1'], hideSoldOut: true, bannerText: 'Oferta de octubre' });
    expect(r.pages).toBe(r.total);
    expect(r.pages).toBe(1 + 1 + 1 + 1); // RAMEN con 3 productos = 1 página
    expect(r.text).toContain('Oferta de octubre');
    expect(r.text).not.toContain('SNACKS');
  }, 120_000);
});
