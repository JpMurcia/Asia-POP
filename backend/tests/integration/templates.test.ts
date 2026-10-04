import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { baseTemplate, draftText } from '../../src/catalog/template-presets';
import type { Template, WorkspaceState } from '../../src/catalog/template';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';
import { loggedInAgent, testConfig, testContext } from '../helpers';

let mock: AlegraMock | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

type Agent = Awaited<ReturnType<typeof loggedInAgent>>['agent'];

const load = async (agent: Agent): Promise<WorkspaceState> => (await agent.get('/api/settings/templates').expect(200)).body;

/** Cuerpo de un guardado correcto a partir de lo que devolvió el servidor. */
const body = (ws: WorkspaceState, over: Record<string, unknown> = {}) => ({
  templates: ws.templates,
  defaultId: ws.defaultId,
  business: ws.business,
  expectedRevision: ws.revision,
  ...over,
});

describe('GET /api/settings/templates', () => {
  it('la primera lectura siembra las 4 plantillas base y devuelve los datos del negocio y la revisión', async () => {
    const { agent } = await loggedInAgent();
    const ws = await load(agent);
    expect(ws.templates.map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft']);
    expect(ws.defaultId).toBe('neon');
    expect(ws.revision).toBe(1);
    expect(ws.business.storeName).toBe('ASIANPOP MARKET+');
    expect(ws.business.terms.length).toBeGreaterThan(0);
    expect(ws).not.toHaveProperty('warnings');
    expect(ws.templates[0]!.pages.productos.els.some((e) => e.type === 'products')).toBe(true);
  });

  it('la segunda lectura devuelve lo mismo', async () => {
    const { agent } = await loggedInAgent();
    expect(await load(agent)).toEqual(await load(agent));
  });
});

describe('GET /api/settings/templates/summary', () => {
  it('es ligero: id, nombre, marca de predeterminada, paleta y fuentes, sin documentos', async () => {
    const { agent } = await loggedInAgent();
    const res = (await agent.get('/api/settings/templates/summary').expect(200)).body;
    expect(res.defaultId).toBe('neon');
    expect(res.items).toHaveLength(4);
    expect(res.items[0]).toEqual({
      id: 'neon',
      name: 'Neón Noche',
      isDefault: true,
      palette: baseTemplate('neon').palette,
      fonts: { title: 'fredoka', body: 'poppins' },
    });
    expect(res.items.filter((i: { isDefault: boolean }) => i.isDefault)).toHaveLength(1);
    expect(JSON.stringify(res)).not.toContain('"pages"');
  });
});

describe('PUT /api/settings/templates', () => {
  it('guarda, incrementa la revisión y devuelve el conjunto con las advertencias', async () => {
    const { agent } = await loggedInAgent();
    const ws = await load(agent);
    const templates = structuredClone(ws.templates);
    templates[1]!.name = 'Pop de temporada';
    const res = await agent.put('/api/settings/templates').send(body(ws, { templates })).expect(200);
    expect(res.body.revision).toBe(2);
    expect(res.body.templates[1].name).toBe('Pop de temporada');
    expect(res.body.warnings).toEqual(expect.any(Array));
    expect(await load(agent)).toMatchObject({ revision: 2, templates: [{}, { name: 'Pop de temporada' }, {}, {}] });
  });

  it('también guarda los datos del negocio en la misma operación', async () => {
    const { agent } = await loggedInAgent();
    const ws = await load(agent);
    const business = { ...ws.business, storeName: 'Otra tienda', phone2: '', coverTitle: 'Oferta' };
    await agent.put('/api/settings/templates').send(body(ws, { business })).expect(200);
    expect((await agent.get('/api/settings/business').expect(200)).body).toMatchObject({ storeName: 'Otra tienda', phone2: '', coverTitle: 'Oferta' });
    expect((await load(agent)).business.storeName).toBe('Otra tienda');
  });

  it('guarda la plantilla predeterminada', async () => {
    const { agent } = await loggedInAgent();
    const ws = await load(agent);
    const res = await agent.put('/api/settings/templates').send(body(ws, { defaultId: 'kraft' })).expect(200);
    expect(res.body.defaultId).toBe('kraft');
    expect((await agent.get('/api/settings/templates/summary')).body.defaultId).toBe('kraft');
  });

  it('borra las plantillas ausentes, agrega las nuevas y respeta el orden', async () => {
    const { agent } = await loggedInAgent();
    const ws = await load(agent);
    const mine: Template = { ...baseTemplate('kawaii'), id: 'tnueva', name: 'Mía' };
    const templates = [mine, ws.templates[0]!, ws.templates[3]!];
    const res = await agent.put('/api/settings/templates').send(body(ws, { templates })).expect(200);
    expect(res.body.templates.map((t: Template) => t.id)).toEqual(['tnueva', 'neon', 'kraft']);
    expect((await load(agent)).templates.map((t) => t.id)).toEqual(['tnueva', 'neon', 'kraft']);
  });

  it('normaliza los colores a mayúsculas', async () => {
    const { agent } = await loggedInAgent();
    const ws = await load(agent);
    const templates = structuredClone(ws.templates);
    templates[0]!.palette.a1 = '#aa11bb';
    const res = await agent.put('/api/settings/templates').send(body(ws, { templates })).expect(200);
    expect(res.body.templates[0].palette.a1).toBe('#AA11BB');
  });

  describe('422 invalid_templates: no se escribe nada', () => {
    it('un color inválido señala el campo con su ruta y no cambia ni plantillas, ni negocio, ni revisión', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const templates = structuredClone(ws.templates);
      templates[0]!.name = 'No debe guardarse';
      const products = templates[0]!.pages.productos.els.find((e) => e.type === 'products')!;
      (products as { ringW: number }).ringW = 11; // fuera de rango
      const business = { ...ws.business, storeName: 'Tampoco esta' };
      const res = await agent.put('/api/settings/templates').send(body(ws, { templates, business })).expect(422);
      expect(res.body.error).toBe('invalid_templates');
      const fields = res.body.details.map((d: { field: string }) => d.field);
      const idx = templates[0]!.pages.productos.els.indexOf(products);
      expect(fields).toContain(`templates[0].pages.productos.els[${idx}].ringW`);
      expect(await load(agent)).toEqual(ws);
    });

    it('un bloque obligatorio ausente, un nombre vacío y una predeterminada inexistente', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const t1 = structuredClone(ws.templates);
      t1[0]!.pages.productos.els = t1[0]!.pages.productos.els.filter((e) => e.type !== 'products');
      const r1 = await agent.put('/api/settings/templates').send(body(ws, { templates: t1 })).expect(422);
      expect(r1.body.details.map((d: { field: string }) => d.field)).toContain('templates[0].pages.productos.els');

      const t2 = structuredClone(ws.templates);
      t2[2]!.name = '   ';
      const r2 = await agent.put('/api/settings/templates').send(body(ws, { templates: t2 })).expect(422);
      expect(r2.body.details.map((d: { field: string }) => d.field)).toContain('templates[2].name');

      const r3 = await agent.put('/api/settings/templates').send(body(ws, { defaultId: 'no-existe' })).expect(422);
      expect(r3.body.details.map((d: { field: string }) => d.field)).toContain('defaultId');
      expect(await load(agent)).toEqual(ws);
    });

    it('sin plantillas, con más de 30 o con ids repetidos', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      await agent.put('/api/settings/templates').send(body(ws, { templates: [] })).expect(422);
      const many = Array.from({ length: 31 }, (_, i) => ({ ...baseTemplate('pop'), id: `t${i}` }));
      await agent.put('/api/settings/templates').send(body(ws, { templates: many, defaultId: 't0' })).expect(422);
      await agent.put('/api/settings/templates').send(body(ws, { templates: [ws.templates[0], ws.templates[0]] })).expect(422);
      expect(await load(agent)).toEqual(ws);
    });

    it('un cuerpo sin plantillas o sin revisión también es inválido', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      await agent.put('/api/settings/templates').send({}).expect(422);
      const noRevision = body(ws) as Record<string, unknown>;
      delete noRevision.expectedRevision;
      const res = await agent.put('/api/settings/templates').send(noRevision).expect(422);
      expect(res.body.error).toBe('invalid_templates');
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain('expectedRevision');
    });
  });

  describe('422 invalid_business: no se escribe nada', () => {
    it('un banner de más de 80 caracteres no guarda ni las plantillas ni el negocio', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const templates = structuredClone(ws.templates);
      templates[0]!.name = 'No debe guardarse';
      const business = { ...ws.business, coverTitle: 'x'.repeat(81) };
      const res = await agent.put('/api/settings/templates').send(body(ws, { templates, business })).expect(422);
      expect(res.body.error).toBe('invalid_business');
      expect(res.body.details.map((d: { field: string }) => d.field)).toContain('coverTitle');
      expect(await load(agent)).toEqual(ws);
    });

    it('políticas de más de 3500 caracteres en total', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const terms = Array.from({ length: 4 }, (_, i) => ({ title: `P${i}`, body: 'x'.repeat(1000) }));
      const res = await agent.put('/api/settings/templates').send(body(ws, { business: { ...ws.business, terms } })).expect(422);
      expect(res.body.error).toBe('invalid_business');
      expect(await load(agent)).toEqual(ws);
    });
  });

  describe('409 templates_changed (edición desde dos pestañas)', () => {
    it('rechaza una revisión vieja sin pisar lo guardado por la otra pestaña', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const first = structuredClone(ws.templates);
      first[0]!.name = 'Primera pestaña';
      await agent.put('/api/settings/templates').send(body(ws, { templates: first })).expect(200);

      const second = structuredClone(ws.templates);
      second[0]!.name = 'Segunda pestaña';
      const res = await agent.put('/api/settings/templates').send(body(ws, { templates: second })).expect(409);
      expect(res.body.error).toBe('templates_changed');
      expect(res.body.message).toMatch(/recarga/i);
      expect((await load(agent)).templates[0]!.name).toBe('Primera pestaña');
    });

    it('PUT /api/settings/business también incrementa la revisión y deja obsoleta a la otra pestaña', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      await agent.put('/api/settings/business').send({ ...ws.business, phone1: '300 000 0000' }).expect(200);
      expect((await load(agent)).revision).toBe(ws.revision + 1);
      await agent.put('/api/settings/templates').send(body(ws)).expect(409);
    });

    it('con la revisión al día guarda varias veces seguidas', async () => {
      const { agent } = await loggedInAgent();
      let ws = await load(agent);
      for (let i = 0; i < 3; i++) {
        ws = (await agent.put('/api/settings/templates').send(body(ws)).expect(200)).body;
      }
      expect(ws.revision).toBe(4);
    });

    it('un PUT de negocio inválido no incrementa la revisión', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      await agent.put('/api/settings/business').send({ ...ws.business, coverTitle: '' }).expect(422);
      expect((await load(agent)).revision).toBe(ws.revision);
    });
  });

  describe('advertencias de contraste', () => {
    it('no bloquean el guardado y señalan la plantilla y el código', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const templates = structuredClone(ws.templates);
      templates[1]!.palette.bg = '#F5F5F5'; // blanco ilegible sobre el fondo
      templates[1]!.palette.a2 = '#F4F4F4';
      const res = await agent.put('/api/settings/templates').send(body(ws, { templates })).expect(200);
      expect(res.body.templates[1].palette.bg).toBe('#F5F5F5');
      const mine = res.body.warnings.filter((w: { templateId: string }) => w.templateId === 'pop');
      expect(mine.map((w: { code: string }) => w.code)).toEqual(expect.arrayContaining(['low_text_contrast', 'low_accent_contrast']));
      expect(res.body.warnings.every((w: { message: string }) => typeof w.message === 'string')).toBe(true);
    });

    it('la paleta de fábrica de Neón Noche no da advertencias', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const res = await agent.put('/api/settings/templates').send(body(ws)).expect(200);
      expect(res.body.warnings.filter((w: { templateId: string }) => w.templateId === 'neon')).toEqual([]);
    });
  });

  describe('tamaño del cuerpo', () => {
    /** Plantilla con textos de 500 caracteres en dos páginas (~100 KB): varias superan el límite global de 1 MB. */
    function bigTemplate(id: string): Template {
      const t = { ...baseTemplate('pop'), id, name: `Grande ${id}` };
      const filler = (prefix: string, n: number) =>
        Array.from({ length: n }, (_, k) => ({
          ...draftText({ text: 'palabra '.repeat(62).slice(0, 500) }),
          id: `${prefix}${k}`,
        }));
      const blocks = t.pages.productos.els.filter((e) => e.type === 'products' || e.type === 'footer');
      t.pages.portada.els = filler('a', 60);
      t.pages.productos.els = [...filler('b', 58), ...blocks];
      return t;
    }

    it('acepta un cuerpo de ~1,5 MB (el límite global es 1 MB)', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const templates = Array.from({ length: 16 }, (_, i) => bigTemplate(`big${i}`));
      const payload = body(ws, { templates, defaultId: 'big0' });
      const size = Buffer.byteLength(JSON.stringify(payload));
      expect(size).toBeGreaterThan(1_200_000);
      expect(size).toBeLessThan(2_000_000);
      const res = await agent.put('/api/settings/templates').send(payload).expect(200);
      expect(res.body.templates).toHaveLength(16);
    });

    it('rechaza un cuerpo de más de 2 MB con 413', async () => {
      const { agent } = await loggedInAgent();
      const ws = await load(agent);
      const res = await agent
        .put('/api/settings/templates')
        .send({ ...body(ws), relleno: 'x'.repeat(2_200_000) })
        .expect(413);
      expect(res.body.error).toBe('payload_too_large');
    });

    it('el límite de 1 MB del resto de rutas no cambia', async () => {
      const { agent } = await loggedInAgent();
      await agent.put('/api/settings/business').send({ relleno: 'x'.repeat(1_200_000) }).expect(413);
    });
  });
});

describe('seguridad', () => {
  it('sin sesión: 401 en GET, PUT y resumen, sin leer el cuerpo grande', async () => {
    const { app } = await loggedInAgent();
    const anon = request(app);
    await anon.get('/api/settings/templates').expect(401);
    await anon.put('/api/settings/templates').send({}).expect(401);
    await anon.put('/api/settings/templates').send({ relleno: 'x'.repeat(1_500_000) }).expect(401);
    await anon.get('/api/settings/templates/summary').expect(401);
  });

  it('el token de Alegra no aparece en ninguna respuesta de plantillas', async () => {
    const TOKEN = 'TOKEN_SUPER_SECRETO_123';
    mock = await startAlegraMock({ token: TOKEN, categories: [{ id: 'c1', name: 'RAMEN' }], items: [] });
    const { agent } = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
    await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: TOKEN }).expect(200);
    const ws = await load(agent);
    const responses = [
      await agent.get('/api/settings/templates'),
      await agent.get('/api/settings/templates/summary'),
      await agent.put('/api/settings/templates').send(body(ws)),
      await agent.put('/api/settings/templates').send(body(ws, { defaultId: 'nada' })),
    ];
    for (const r of responses) expect(JSON.stringify(r.body) + r.text + JSON.stringify(r.headers)).not.toContain(TOKEN);
  });
});
