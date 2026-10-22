import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import type { ImageEl, WorkspaceState } from '../../src/catalog/template';
import { PNG } from '../fixtures/pdf-harness';
import { loggedInAgent, testConfig, testContext } from '../helpers';

/** Feature 010: imágenes de plantilla (logo, ilustraciones) que sube la persona responsable. */
async function png(w = 40, h = 20): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: '#cc3366' } }).png().toBuffer();
}
const SAFE = /^tpl-[A-Za-z0-9._-]+\.(png|jpg|webp)$/;

async function setup() {
  const ctx = testContext({ config: testConfig() });
  const session = await loggedInAgent(ctx);
  return { ...session, ctx };
}
const upload = (agent: ReturnType<typeof request.agent>, buf: Buffer, name = 'logo.png') =>
  agent.post('/api/template-images').attach('image', buf, name);

describe('POST /api/template-images', () => {
  it('guarda la imagen con nombre seguro tpl-… y devuelve su src upload:', async () => {
    const { agent, ctx } = await setup();
    const res = await upload(agent, await png(40, 20), 'Mi Logo (nuevo).PNG').expect(201);
    expect(res.body.file).toMatch(SAFE);
    expect(res.body.src).toBe(`upload:${res.body.file}`);
    expect(res.body).toMatchObject({ width: 40, height: 20 });
    expect(res.body.bytes).toBeGreaterThan(0);
    expect(typeof res.body.name).toBe('string');
    expect(fs.existsSync(path.join(ctx.uploadsDir, res.body.file))).toBe(true);
    // se sirve por la ruta de subidas que ya existe
    await agent.get(`/media/uploads/${res.body.file}`).expect(200);
  });

  it('valida el tipo real por contenido, no por la extensión: un texto con extensión .png se rechaza', async () => {
    const { agent } = await setup();
    const res = await upload(agent, Buffer.from('esto no es una imagen'), 'falsa.png').expect(422);
    expect(res.body.error).toBe('invalid_image');
  });

  it('acepta una imagen real aunque su nombre no tenga extensión', async () => {
    const { agent } = await setup();
    const res = await upload(agent, await png(), 'sin-extension').expect(201);
    expect(res.body.file.endsWith('.png')).toBe(true);
  });

  it('rechaza lo que pasa de 5 MB con 413 y no pide el campo equivocado', async () => {
    const { agent } = await setup();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]);
    await upload(agent, big).expect(413);
    await agent.post('/api/template-images').attach('otro', await png(), 'x.png').expect(422);
    await agent.post('/api/template-images').expect(422);
  });

  it('un nombre original peligroso no sale del nombre de archivo', async () => {
    const { agent, ctx } = await setup();
    const res = await upload(agent, await png(), '../../etc/pass wd.png').expect(201);
    expect(res.body.file).toMatch(SAFE);
    expect(fs.readdirSync(ctx.uploadsDir)).toContain(res.body.file);
  });

  it('exige sesión', async () => {
    const { ctx } = await setup();
    const { createApp } = await import('../../src/app');
    await request(createApp(ctx)).post('/api/template-images').attach('image', await png(), 'a.png').expect(401);
    await request(createApp(ctx)).get('/api/template-images').expect(401);
  });
});

describe('GET /api/template-images', () => {
  it('lista solo las imágenes de plantilla (no las fotos de productos) con sus medidas', async () => {
    const { agent, ctx } = await setup();
    fs.mkdirSync(ctx.uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.uploadsDir, 'producto.png'), await png());
    expect((await agent.get('/api/template-images').expect(200)).body).toEqual({ images: [] });
    const a = (await upload(agent, await png(30, 10), 'a.png').expect(201)).body;
    const b = (await upload(agent, await png(50, 50), 'b.png').expect(201)).body;
    const list = (await agent.get('/api/template-images').expect(200)).body.images as { file: string; width: number; height: number; src: string }[];
    expect(list.map((i) => i.file).sort()).toEqual([a.file, b.file].sort());
    expect(list.find((i) => i.file === b.file)).toMatchObject({ width: 50, height: 50, src: `upload:${b.file}` });
  });
});

describe('DELETE /api/template-images/:file', () => {
  it('borra una imagen sin uso', async () => {
    const { agent, ctx } = await setup();
    const { file } = (await upload(agent, await png()).expect(201)).body;
    await agent.delete(`/api/template-images/${file}`).expect(204);
    expect(fs.existsSync(path.join(ctx.uploadsDir, file))).toBe(false);
    await agent.delete(`/api/template-images/${file}`).expect(404);
  });

  it('solo borra nombres tpl-…: una foto de producto o un nombre raro responde 404 y no se toca', async () => {
    const { agent, ctx } = await setup();
    fs.mkdirSync(ctx.uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.uploadsDir, 'producto.png'), await png());
    await agent.delete('/api/template-images/producto.png').expect(404);
    await agent.delete('/api/template-images/..%2Fdata.db').expect(404);
    await agent.delete('/api/template-images/tpl-no-existe.png').expect(404);
    expect(fs.existsSync(path.join(ctx.uploadsDir, 'producto.png'))).toBe(true);
  });

  it('si una plantilla guardada la usa responde 409 in_use con la lista de plantillas y no la borra', async () => {
    const { agent, ctx } = await setup();
    const { file, src } = (await upload(agent, await png()).expect(201)).body;
    const ws = (await agent.get('/api/settings/templates').expect(200)).body as WorkspaceState;
    const pop = ws.templates.find((t) => t.id === 'pop')!;
    const image: ImageEl = { id: 'logo-propio', type: 'image', x: 5, y: 5, w: 20, h: 12, rot: 0, opacity: 1, visible: true, locked: false, src, fit: 'contain', radius: 0 };
    pop.pages.portada.els.push(image);
    await agent
      .put('/api/settings/templates')
      .send({ templates: ws.templates, defaultId: ws.defaultId, business: ws.business, expectedRevision: ws.revision })
      .expect(200);
    const res = await agent.delete(`/api/template-images/${file}`).expect(409);
    expect(res.body.error).toBe('in_use');
    expect(res.body.details).toEqual([{ id: 'pop', name: 'Pop crema' }]);
    expect(fs.existsSync(path.join(ctx.uploadsDir, file))).toBe(true);
  });
});
