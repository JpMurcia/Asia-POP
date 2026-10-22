import { describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/database';
import { BASE_TEMPLATES, baseTemplate } from '../../src/catalog/template-presets';
import { TemplateRepo } from '../../src/catalog/template.repo';
import { BusinessSettingsRepo, DEFAULT_BUSINESS } from '../../src/catalog/settings.repo';
import type { Db } from '../../src/db/database';
import type { ProductsEl, Template, WorkspaceState } from '../../src/catalog/template';
import { loggedInAgent, testContext } from '../helpers';

/** Una base de datos de 002 con un tema guardado (fondo y tres acentos propios). */
function setTheme(db: Db, t: { background: string; accent1: string; accent2: string; accent3: string }) {
  db.prepare(
    `INSERT INTO catalog_theme (id, background, accent1, accent2, accent3, updated_at)
     VALUES (1, @background, @accent1, @accent2, @accent3, '2026-10-01T00:00:00.000Z')
     ON CONFLICT(id) DO UPDATE SET background=@background, accent1=@accent1, accent2=@accent2, accent3=@accent3`,
  ).run(t);
}

function dbWithTheme() {
  const db = openDatabase(':memory:');
  setTheme(db, { background: '#102030', accent1: '#CC33DD', accent2: '#33DDCC', accent3: '#FFAA33' });
  return db;
}

describe('siembra de plantillas', () => {
  it('en una base nueva siembra las 5 plantillas base, Neón Noche predeterminada y revisión 1', () => {
    const ws = new TemplateRepo(openDatabase(':memory:')).getWorkspace();
    expect(ws.templates.map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft', 'base']);
    expect(ws.templates.map((t) => t.name)).toEqual(['Neón Noche', 'Pop crema', 'Kawaii pastel', 'Kraft minimal', 'Base AsianPop']);
    expect(ws.defaultId).toBe('neon');
    expect(ws.revision).toBe(1);
    expect(ws.templates).toEqual(BASE_TEMPLATES);
    expect(ws.templates[0]!.palette).toMatchObject({ bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900' });
  });

  it('trae también los datos del negocio con sus políticas', () => {
    const ws = new TemplateRepo(openDatabase(':memory:')).getWorkspace();
    expect(ws.business).toEqual(DEFAULT_BUSINESS);
  });

  it('con un tema guardado en 002, la paleta de Neón Noche toma sus cuatro colores y las demás no cambian', () => {
    const ws = new TemplateRepo(dbWithTheme()).getWorkspace();
    const neon = ws.templates.find((t) => t.id === 'neon')!;
    expect(neon.palette).toEqual({ ...baseTemplate('neon').palette, bg: '#102030', a1: '#CC33DD', a2: '#33DDCC', a3: '#FFAA33' });
    // el texto y el papel no forman parte del tema de 002
    expect(neon.palette.ink).toBe(baseTemplate('neon').palette.ink);
    expect(neon.palette.paper).toBe(baseTemplate('neon').palette.paper);
    // el resto del documento de Neón Noche y las otras plantillas quedan como de fábrica
    expect({ ...neon, palette: baseTemplate('neon').palette }).toEqual(baseTemplate('neon'));
    for (const id of ['pop', 'kawaii', 'kraft'] as const) {
      expect(ws.templates.find((t) => t.id === id)).toEqual(baseTemplate(id));
    }
    expect(ws.defaultId).toBe('neon');
  });

  it('"Restaurar colores originales" sigue volviendo a la paleta de fábrica, no a la del tema migrado', () => {
    const neon = new TemplateRepo(dbWithTheme()).getWorkspace().templates[0]!;
    expect(baseTemplate(neon.base).palette.bg).toBe('#11052C');
  });

  it('la segunda lectura no vuelve a sembrar ni reaplica el tema', () => {
    const db = dbWithTheme();
    const repo = new TemplateRepo(db);
    const first = repo.getWorkspace();
    // se cambia el tema de 002 después de sembrar: ya no debe influir
    setTheme(db, { background: '#000001', accent1: '#000002', accent2: '#000003', accent3: '#000004' });
    const second = new TemplateRepo(db).getWorkspace();
    expect(second).toEqual(first);
    expect(second.revision).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM catalog_template').get() as { n: number }).n).toBe(5);
    expect((db.prepare('SELECT COUNT(*) AS n FROM template_workspace').get() as { n: number }).n).toBe(1);
  });

  it('dos repositorios sobre la misma base siembran una sola vez', () => {
    const db = openDatabase(':memory:');
    new TemplateRepo(db).summary();
    new TemplateRepo(db).summary();
    expect((db.prepare('SELECT COUNT(*) AS n FROM catalog_template').get() as { n: number }).n).toBe(5);
  });

  it('la tabla catalog_theme queda intacta', () => {
    const db = dbWithTheme();
    const before = db.prepare('SELECT * FROM catalog_theme').all();
    new TemplateRepo(db).getWorkspace();
    expect(db.prepare('SELECT * FROM catalog_theme').all()).toEqual(before);
  });

  it('la siembra no modifica los datos del negocio guardados', () => {
    const db = openDatabase(':memory:');
    new BusinessSettingsRepo(db).put({ ...DEFAULT_BUSINESS, storeName: 'Mi tienda' });
    new TemplateRepo(db).getWorkspace();
    expect(new BusinessSettingsRepo(db).get().storeName).toBe('Mi tienda');
  });
});

describe('una generación en una base recién migrada no encuentra el repositorio vacío', () => {
  // No se llama antes a getWorkspace(): resolve() y summary() deben sembrar por sí solos

  it('resolve() siembra y devuelve neon con los colores del tema guardado', () => {
    const { template, fallback } = new TemplateRepo(dbWithTheme()).resolve();
    expect(fallback).toBe(false);
    expect(template.id).toBe('neon');
    expect(template.palette).toMatchObject({ bg: '#102030', a1: '#CC33DD', a2: '#33DDCC', a3: '#FFAA33' });
  });

  it('summary() siembra y trae las cinco plantillas con neon predeterminada', () => {
    const summary = new TemplateRepo(dbWithTheme()).summary();
    expect(summary.defaultId).toBe('neon');
    expect(summary.items.map((i) => i.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft', 'base']);
    expect(summary.items[0]).toMatchObject({ id: 'neon', isDefault: true, palette: { bg: '#102030' } });
  });

  it('resolve() sobre una base nueva usa la paleta de fábrica', () => {
    expect(new TemplateRepo(openDatabase(':memory:')).resolve().template.palette.bg).toBe('#11052C');
  });

  it('save() y touch() también siembran antes de actuar', () => {
    const db = openDatabase(':memory:');
    const repo = new TemplateRepo(db);
    repo.touch();
    const ws = repo.getWorkspace();
    expect(ws.templates).toHaveLength(5);
    expect(ws.revision).toBe(2);
  });
});

describe('plantillas guardadas antes de la feature 007 se completan al leerlas', () => {
  const NEW_KEYS = ['photoW', 'photoH', 'nameStyle', 'nameColor', 'nameFill', 'nameGlow'] as const;
  const productsOf = (t: Template) => t.pages.productos.els.find((e) => e.type === 'products') as ProductsEl;

  /** Siembra y reemplaza el `doc_json` de las plantillas indicadas por el que guardó la feature 006 (sin los campos nuevos). */
  function legacyDb(ids: string[], mutate: (t: Template) => void = () => {}) {
    const db = openDatabase(':memory:');
    new TemplateRepo(db).getWorkspace();
    for (const id of ids) {
      const row = db.prepare('SELECT doc_json FROM catalog_template WHERE id = ?').get(id) as { doc_json: string };
      const doc = JSON.parse(row.doc_json) as Template;
      for (const el of doc.pages.productos.els) {
        if (el.type === 'products') for (const k of NEW_KEYS) delete (el as unknown as Record<string, unknown>)[k];
      }
      mutate(doc);
      db.prepare('UPDATE catalog_template SET doc_json = ? WHERE id = ?').run(JSON.stringify(doc), id);
    }
    return db;
  }
  const rawDoc = (db: Db, id: string) =>
    (db.prepare('SELECT doc_json FROM catalog_template WHERE id = ?').get(id) as { doc_json: string }).doc_json;

  it('neon queda con el nombre separado y las demás con el nombre en la burbuja', async () => {
    const db = legacyDb(['neon', 'pop']);
    const { agent } = await loggedInAgent(testContext({ db }));
    const ws = (await agent.get('/api/settings/templates').expect(200)).body as WorkspaceState;
    expect(productsOf(ws.templates.find((t) => t.id === 'neon')!)).toMatchObject({
      nameStyle: 'separado',
      nameColor: 'a1',
      nameFill: 'bg',
      nameGlow: true,
      photoW: 100,
      photoH: 100,
    });
    expect(productsOf(ws.templates.find((t) => t.id === 'pop')!)).toMatchObject({
      nameStyle: 'burbuja',
      nameColor: 'a1',
      nameFill: 'transparent',
      nameGlow: false,
      photoW: 100,
      photoH: 100,
    });
  });

  it('no pisa un campo que ya está: una plantilla con nameStyle separado y un color propio los conserva', () => {
    const db = legacyDb(['pop'], (t) => {
      Object.assign(productsOf(t), { nameStyle: 'separado', nameColor: '#00FF66' });
    });
    const pop = new TemplateRepo(db).getWorkspace().templates.find((t) => t.id === 'pop')!;
    expect(productsOf(pop)).toMatchObject({ nameStyle: 'separado', nameColor: '#00FF66', nameFill: 'transparent', photoW: 100 });
  });

  it('leer no escribe: la base conserva el documento viejo hasta que la persona guarda', () => {
    const db = legacyDb(['neon', 'pop']);
    const before = [rawDoc(db, 'neon'), rawDoc(db, 'pop')];
    const repo = new TemplateRepo(db);
    repo.getWorkspace();
    repo.resolve('pop');
    repo.summary();
    expect([rawDoc(db, 'neon'), rawDoc(db, 'pop')]).toEqual(before);
    expect(before[0]).not.toContain('nameStyle');
  });

  it('resolve() entrega el documento completo, también el de la reserva predeterminada', () => {
    const db = legacyDb(['neon', 'pop']);
    const repo = new TemplateRepo(db);
    expect(productsOf(repo.resolve().template).nameStyle).toBe('separado');
    expect(productsOf(repo.resolve('pop').template).nameStyle).toBe('burbuja');
    // una plantilla que ya no existe cae en la predeterminada, también completa
    expect(productsOf(repo.resolve('no-existe').template).nameStyle).toBe('separado');
  });

  it('un PUT con lo recibido pasa la validación y lo guardado ya trae los campos', async () => {
    const db = legacyDb(['neon', 'pop', 'kawaii', 'kraft']);
    const { agent } = await loggedInAgent(testContext({ db }));
    const ws = (await agent.get('/api/settings/templates').expect(200)).body as WorkspaceState;
    await agent
      .put('/api/settings/templates')
      .send({ templates: ws.templates, defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision })
      .expect(200);
    for (const id of ['neon', 'pop', 'kawaii', 'kraft']) {
      const saved = JSON.parse(rawDoc(db, id)) as Template;
      for (const k of NEW_KEYS) expect(productsOf(saved), `${id}.${k}`).toHaveProperty(k);
    }
    expect(productsOf(JSON.parse(rawDoc(db, 'neon')) as Template).nameStyle).toBe('separado');
  });
});
