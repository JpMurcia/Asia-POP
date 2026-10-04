import { afterEach, describe, expect, it } from 'vitest';
import { baseTemplate } from '../../src/catalog/template-presets';
import type { Template, WorkspaceState } from '../../src/catalog/template';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { loggedInAgent, testConfig, testContext, FakeRenderer } from '../helpers';

const creds = { email: 'tienda@example.com', apiToken: 'tok_valido' };

let mock: AlegraMock | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

const item = (id: string, cat: 'c1' | 'c2'): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: `desc ${id}`,
  status: 'active',
  price: 9000,
  category: { id: cat, name: cat === 'c1' ? 'RAMEN' : 'SNACKS' },
  images: [`${mock!.url}/img/ok.png`],
});

async function setup() {
  mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }, { id: 'c2', name: 'SNACKS' }] });
  mock.setItems([item('1', 'c1'), item('2', 'c1'), item('3', 'c1'), item('4', 'c1'), item('5', 'c2')]);
  const session = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer: new FakeRenderer() }));
  await session.agent.put('/api/settings/alegra').send(creds).expect(200);
  return session;
}
type Agent = Awaited<ReturnType<typeof setup>>['agent'];

const load = async (agent: Agent): Promise<WorkspaceState> => (await agent.get('/api/settings/templates').expect(200)).body;
const prepare = async (agent: Agent, body: object = {}) => (await agent.post('/api/catalog/prepare').send(body).expect(200)).body;
const payload = async (agent: Agent, id: string) => (await agent.get(`/api/catalog/payload/${id}`).expect(200)).body;

/** Guarda un cambio en el conjunto (con la revisión al día). */
async function saveWith(agent: Agent, edit: (ws: WorkspaceState) => Partial<Record<'templates' | 'defaultId', unknown>>) {
  const ws = await load(agent);
  const patch = edit(structuredClone(ws));
  await agent
    .put('/api/settings/templates')
    .send({ templates: ws.templates, defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision, ...patch })
    .expect(200);
}

async function waitDone(agent: Agent) {
  for (let i = 0; i < 100; i++) {
    const res = await agent.get('/api/catalog/jobs/current');
    if (res.body.status === 'done') return res.body;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('el trabajo no terminó');
}

describe('la plantilla en la preparación', () => {
  it('prepare sin templateId usa la predeterminada y no la registra en las opciones', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    expect(prep.options).toEqual({ hideSoldOut: false });
    const p = await payload(agent, prep.prepareId);
    expect(p.template.id).toBe('neon');
    expect(p.template).toEqual(baseTemplate('neon'));
  });

  it('prepare acepta un templateId, lo devuelve en las opciones y el payload usa esa plantilla', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent, { templateId: 'kraft' });
    expect(prep.options.templateId).toBe('kraft');
    expect((await payload(agent, prep.prepareId)).template.id).toBe('kraft');
  });

  it('PUT options acepta templateId, cambia la plantilla sin consultar Alegra y la estructura no cambia', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    const before = mock!.requests.length;
    const res = await agent.put(`/api/catalog/prepare/${prep.prepareId}/options`).send({ templateId: 'kawaii' }).expect(200);
    expect(res.body.options.templateId).toBe('kawaii');
    expect(res.body.structure).toEqual(prep.structure);
    expect((await payload(agent, prep.prepareId)).template.id).toBe('kawaii');
    expect(mock!.requests).toHaveLength(before);
  });

  it('la estructura es la misma con cualquier plantilla (FR-029, SC-010)', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    for (const templateId of ['neon', 'pop', 'kawaii', 'kraft']) {
      const res = await agent.put(`/api/catalog/prepare/${prep.prepareId}/options`).send({ templateId }).expect(200);
      expect(res.body.structure).toEqual(prep.structure);
    }
  });

  it('valida templateId: debe ser texto de hasta 80 caracteres', async () => {
    const { agent } = await setup();
    const bad = await agent.post('/api/catalog/prepare').send({ templateId: 123 }).expect(422);
    expect(bad.body.error).toBe('invalid_options');
    expect(bad.body.details[0]).toMatchObject({ field: 'templateId' });
    await agent.post('/api/catalog/prepare').send({ templateId: 'x'.repeat(81) }).expect(422);
    const prep = await prepare(agent);
    await agent.put(`/api/catalog/prepare/${prep.prepareId}/options`).send({ templateId: 5 }).expect(422);
  });

  it('el payload ya no lleva el tema de 002', async () => {
    const { agent } = await setup();
    const p = await payload(agent, (await prepare(agent)).prepareId);
    expect(p.config).not.toHaveProperty('theme');
    expect(p.template).toBeDefined();
  });
});

describe('la plantilla se lee al construir (FR-022)', () => {
  it('una plantilla guardada entre preparar y generar llega al payload', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    expect((await payload(agent, prep.prepareId)).template.palette.a1).toBe('#FF007A');

    await saveWith(agent, (ws) => {
      ws.templates[0]!.palette.a1 = '#112233';
      return { templates: ws.templates };
    });
    // la vista previa lo refleja
    expect((await payload(agent, prep.prepareId)).template.palette.a1).toBe('#112233');

    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitDone(agent);
    // y el payload con el que se imprimió también
    expect((await payload(agent, prep.prepareId)).template.palette.a1).toBe('#112233');
  });

  it('cambiar la predeterminada entre preparar y generar usa la nueva', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent);
    await saveWith(agent, () => ({ defaultId: 'pop' }));
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(res.body.template).toEqual({ id: 'pop', name: 'Pop crema', fallback: false });
    await waitDone(agent);
    expect((await payload(agent, prep.prepareId)).template.id).toBe('pop');
  });

  it('la plantilla elegida para una generación no cambia la predeterminada', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent, { templateId: 'kraft' });
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitDone(agent);
    expect((await agent.get('/api/settings/templates/summary').expect(200)).body.defaultId).toBe('neon');
    // y la siguiente preparación vuelve a la predeterminada
    expect((await payload(agent, (await prepare(agent)).prepareId)).template.id).toBe('neon');
  });

  it('generate responde con la plantilla usada', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent, { templateId: 'kawaii' });
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(res.body.jobId).toEqual(expect.any(String));
    expect(res.body.template).toEqual({ id: 'kawaii', name: 'Kawaii pastel', fallback: false });
    await waitDone(agent);
  });

  it('registra el templateId elegido en los parámetros del catálogo generado', async () => {
    const { agent, ctx } = await setup();
    const prep = await prepare(agent, { templateId: 'kraft' });
    await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    await waitDone(agent);
    const row = ctx.db.prepare('SELECT params_json FROM generated_catalog').get() as { params_json: string };
    expect(JSON.parse(row.params_json).options.templateId).toBe('kraft');
  });
});

describe('plantilla eliminada: se usa la predeterminada y se avisa', () => {
  it('un templateId inexistente cae a la predeterminada y generate avisa con fallback: true', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent, { templateId: 'no-existe' });
    expect((await payload(agent, prep.prepareId)).template.id).toBe('neon');
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(res.body.template).toEqual({ id: 'neon', name: 'Neón Noche', fallback: true });
    await waitDone(agent);
  });

  it('eliminar la plantilla elegida después de preparar no rompe la generación', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent, { templateId: 'kraft' });
    await saveWith(agent, (ws) => ({ templates: ws.templates.filter((t: Template) => t.id !== 'kraft') }));
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(res.body.template).toEqual({ id: 'neon', name: 'Neón Noche', fallback: true });
    await waitDone(agent);
    expect((await payload(agent, prep.prepareId)).template.id).toBe('neon');
  });

  it('el reemplazo es la predeterminada vigente, no siempre Neón Noche', async () => {
    const { agent } = await setup();
    const prep = await prepare(agent, { templateId: 'kraft' });
    await saveWith(agent, (ws) => ({ templates: ws.templates.filter((t: Template) => t.id !== 'kraft'), defaultId: 'kawaii' }));
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(res.body.template).toMatchObject({ id: 'kawaii', fallback: true });
    await waitDone(agent);
  });
});

describe('migración desde 002', () => {
  it('generar en una base de 002 recién migrada, sin haber abierto Apariencia, usa neon con los colores del tema guardado', async () => {
    mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }] });
    mock.setItems([item('1', 'c1')]);
    const ctx = testContext({ config: testConfig({ alegraBaseUrl: mock.url }), renderer: new FakeRenderer() });
    // Una base de 002: tiene un tema guardado y nadie ha pedido todavía las plantillas
    ctx.db
      .prepare(
        `INSERT INTO catalog_theme (id, background, accent1, accent2, accent3, updated_at)
         VALUES (1, '#102030', '#CC33DD', '#33DDCC', '#FFAA33', '2026-10-01T00:00:00.000Z')`,
      )
      .run();
    expect((ctx.db.prepare('SELECT COUNT(*) AS n FROM catalog_template').get() as { n: number }).n).toBe(0);

    const { agent } = await loggedInAgent(ctx);
    await agent.put('/api/settings/alegra').send(creds).expect(200);
    const prep = await prepare(agent);
    const res = await agent.post('/api/catalog/generate').send({ prepareId: prep.prepareId }).expect(202);
    expect(res.body.template).toEqual({ id: 'neon', name: 'Neón Noche', fallback: false });
    await waitDone(agent);
    const p = await payload(agent, prep.prepareId);
    expect(p.template.id).toBe('neon');
    expect(p.template.palette).toMatchObject({ bg: '#102030', a1: '#CC33DD', a2: '#33DDCC', a3: '#FFAA33' });
  });
});

describe('seguridad', () => {
  it('las rutas con plantilla exigen sesión', async () => {
    const { app } = await setup();
    const { default: request } = await import('supertest');
    await request(app).post('/api/catalog/prepare').send({ templateId: 'neon' }).expect(401);
    await request(app).put('/api/catalog/prepare/x/options').send({ templateId: 'neon' }).expect(401);
  });
});
