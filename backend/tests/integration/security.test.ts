import net from 'node:net';
import os from 'node:os';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { maskSecrets } from '../../src/api/errors';
import { LISTEN_HOST, listenLocal } from '../../src/listen';
import { SEED, loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

const TOKEN = 'TOKEN_SUPER_SECRETO_123';

let server: Server | undefined;
let mock: AlegraMock | undefined;
afterEach(async () => {
  await new Promise((r) => (server ? server.close(r) : r(null)));
  server = undefined;
  await mock?.close();
  mock = undefined;
});

describe('seguridad', () => {
  it('el servidor escucha solo en 127.0.0.1', async () => {
    const ctx = testContext();
    server = await listenLocal(createApp(ctx), ctx, 0);
    const { address, port } = server.address() as AddressInfo;
    expect(address).toBe('127.0.0.1');
    expect(LISTEN_HOST).toBe('127.0.0.1');

    // No debe aceptar conexiones por otras interfaces del equipo (p. ej. la IP de la red local)
    const external = Object.values(os.networkInterfaces())
      .flat()
      .find((i) => i && i.family === 'IPv4' && !i.internal);
    if (external) {
      const refused = await new Promise<boolean>((resolve) => {
        const s = net.connect({ host: external.address, port, timeout: 1500 });
        s.on('connect', () => (s.destroy(), resolve(false)));
        s.on('error', () => resolve(true));
        s.on('timeout', () => (s.destroy(), resolve(true)));
      });
      expect(refused).toBe(true);
    }
  });

  it('el token de Alegra no aparece en ninguna respuesta ni en los logs', async () => {
    mock = await startAlegraMock({ token: TOKEN, categories: [{ id: 'c1', name: 'RAMEN' }], items: [] });
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')].map((s) =>
      s.mockImplementation(() => {}),
    );
    const { agent } = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));

    const bodies: string[] = [];
    const record = (res: request.Response) => bodies.push(JSON.stringify(res.body) + JSON.stringify(res.headers) + res.text);
    record(await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: TOKEN }));
    record(await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'otro' })); // rechazado
    record(await agent.post('/api/settings/alegra/test').send({ email: 'tienda@example.com', apiToken: TOKEN }));
    for (const url of [
      '/api/settings/alegra',
      '/api/sections',
      '/api/catalog/uncategorized',
      '/api/bundles',
      '/api/settings/business',
      '/api/catalog/history',
      '/api/catalog/jobs/current',
    ]) {
      record(await agent.get(url));
    }
    record(await agent.post('/api/catalog/prepare').send({}));

    for (const b of bodies) expect(b).not.toContain(TOKEN);
    for (const spy of logs) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    logs.forEach((s) => s.mockRestore());
  });

  it('las rutas de las features 002 y 003 exigen sesión', async () => {
    const { app } = await loggedInAgent();
    const anon = request(app);
    await anon.get('/api/settings/templates').expect(401);
    await anon.put('/api/settings/templates').send({}).expect(401);
    await anon.get('/api/settings/templates/summary').expect(401);
    await anon.get('/api/panel/summary').expect(401);
    await anon.get('/api/panel/summary?refresh=1').expect(401);
    await anon.put('/api/catalog/prepare/x/options').send({}).expect(401);
    await anon.get('/api/catalog/payload/x').expect(401);
  });

  it('el tema de 002 ya no existe: /api/settings/theme responde 404 con sesión y 401 sin ella', async () => {
    const { app, agent } = await loggedInAgent();
    await request(app).get('/api/settings/theme').expect(401);
    await agent.get('/api/settings/theme').expect(404);
    await agent.put('/api/settings/theme').send({}).expect(404);
    await agent.delete('/api/settings/theme').expect(404);
  });

  it('las respuestas nuevas (plantillas, resumen de Inicio, opciones) no exponen el token ni los datos semilla', async () => {
    mock = await startAlegraMock({ token: TOKEN, categories: [{ id: 'c1', name: 'RAMEN' }], items: [] });
    const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')].map((s) =>
      s.mockImplementation(() => {}),
    );
    const { agent } = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
    await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: TOKEN }).expect(200);

    const bodies: string[] = [];
    const record = (res: request.Response) => bodies.push(JSON.stringify(res.body) + JSON.stringify(res.headers) + res.text);
    const templates = await agent.get('/api/settings/templates');
    record(templates);
    record(await agent.put('/api/settings/templates').send({ ...templates.body, expectedRevision: templates.body.revision }));
    record(await agent.put('/api/settings/templates').send({ templates: [] })); // error de validación
    record(await agent.put('/api/settings/templates').send({ ...templates.body, expectedRevision: 0 })); // 409
    record(await agent.get('/api/settings/templates/summary'));
    record(await agent.get('/api/settings/alegra'));
    record(await agent.post('/api/settings/alegra/test').send({ email: 'tienda@example.com', apiToken: TOKEN }));
    record(await agent.get('/api/panel/summary'));
    record(await agent.get('/api/panel/summary?refresh=1'));
    const prep = await agent.post('/api/catalog/prepare').send({});
    record(prep);
    record(await agent.put(`/api/catalog/prepare/${prep.body.prepareId}/options`).send({ hideSoldOut: true }));
    record(await agent.put(`/api/catalog/prepare/${prep.body.prepareId}/options`).send({ bannerText: 'x'.repeat(81) }));
    record(await agent.get(`/api/catalog/payload/${prep.body.prepareId}`));

    for (const b of bodies) {
      expect(b).not.toContain(TOKEN);
      expect(b).not.toContain(SEED.password);
    }
    for (const spy of logs) expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN);
    logs.forEach((s) => s.mockRestore());
  });

  it('el resumen de Inicio no pasa por Alegra con métodos de escritura', async () => {
    mock = await startAlegraMock({ categories: [{ id: 'c1', name: 'RAMEN' }], items: [] });
    const { agent } = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
    await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: 'tok_valido' }).expect(200);
    await agent.get('/api/panel/summary?refresh=1').expect(200);
    expect(mock.requests.length).toBeGreaterThan(0);
    expect(mock.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('el token se guarda cifrado en la base', async () => {
    mock = await startAlegraMock({ token: TOKEN });
    const { agent, ctx } = await loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
    await agent.put('/api/settings/alegra').send({ email: 'tienda@example.com', apiToken: TOKEN }).expect(200);
    const row = ctx.db.prepare('SELECT token_encrypted FROM alegra_connection').get() as { token_encrypted: Buffer };
    expect(row.token_encrypted.includes(Buffer.from(TOKEN))).toBe(false);
  });

  it('las credenciales semilla no se devuelven ni se pueden cambiar por la API', async () => {
    const { agent } = await loggedInAgent();
    for (const url of ['/api/auth/session', '/api/settings/business']) {
      expect(JSON.stringify((await agent.get(url)).body)).not.toContain(SEED.password);
    }
    await agent.put('/api/auth/password').send({ password: 'nueva' }).expect(404);
    await agent.post('/api/auth/password').send({ password: 'nueva' }).expect(404);
  });

  it('la cookie de sesión es httpOnly y SameSite=Strict', async () => {
    const res = await request(createApp(testContext())).post('/api/auth/login').send(SEED).expect(204);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it('maskSecrets oculta campos sensibles, también anidados', () => {
    expect(
      maskSecrets({ email: 'a@b.co', apiToken: 'x', nested: { Authorization: 'Basic abc', ok: 1 }, list: [{ password: 'p' }] }),
    ).toEqual({ email: 'a@b.co', apiToken: '***', nested: { Authorization: '***', ok: 1 }, list: [{ password: '***' }] });
  });
});
