import { afterEach, describe, expect, it, vi } from 'vitest';
import { loggedInAgent, testConfig, testContext } from '../helpers';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
afterEach(async () => mock?.close());

const good = { email: 'tienda@example.com', apiToken: 'tok_valido' };

async function setup() {
  mock = await startAlegraMock();
  return loggedInAgent(testContext({ config: testConfig({ alegraBaseUrl: mock.url }) }));
}

describe('configuración de Alegra', () => {
  it('sin configurar: estado vacío', async () => {
    const { agent } = await setup();
    const res = await agent.get('/api/settings/alegra').expect(200);
    expect(res.body).toEqual({ email: null, isConfigured: false, lastTestedAt: null, testAttempts: { limit: 10, remaining: 10 } });
  });

  it('guarda credenciales válidas y nunca devuelve el token', async () => {
    const { agent, ctx } = await setup();
    const put = await agent.put('/api/settings/alegra').send(good).expect(200);
    expect(put.body.isConfigured).toBe(true);
    expect(JSON.stringify(put.body)).not.toContain('tok_valido');
    const get = await agent.get('/api/settings/alegra').expect(200);
    expect(JSON.stringify(get.body)).not.toContain('tok_valido');
    // En la base el token está cifrado
    const row = ctx.db.prepare('SELECT token_encrypted FROM alegra_connection').get() as { token_encrypted: Buffer };
    expect(row.token_encrypted.toString('utf8')).not.toContain('tok_valido');
  });

  it('credenciales inválidas se rechazan y se conservan las anteriores', async () => {
    const { agent } = await setup();
    await agent.put('/api/settings/alegra').send(good).expect(200);
    const bad = await agent.put('/api/settings/alegra').send({ ...good, apiToken: 'mal' });
    expect(bad.status).toBe(422);
    expect(bad.body.error).toBe('alegra_rejected');
    expect(JSON.stringify(bad.body)).not.toContain('mal"');
    const get = await agent.get('/api/settings/alegra').expect(200);
    expect(get.body.email).toBe('tienda@example.com');
    expect(get.body.isConfigured).toBe(true);
  });

  it('/test valida sin guardar', async () => {
    const { agent } = await setup();
    await agent.post('/api/settings/alegra/test').send(good).expect(200, { ok: true, testAttempts: { limit: 10, remaining: 9 } });
    const get = await agent.get('/api/settings/alegra').expect(200);
    expect(get.body.isConfigured).toBe(false);
    await agent.post('/api/settings/alegra/test').send({ ...good, apiToken: 'mal' }).expect(422);
  });

  it('Alegra caído devuelve 502', async () => {
    const { agent } = await loggedInAgent(testContext());
    const res = await agent.put('/api/settings/alegra').send(good);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('alegra_unreachable');
  });

  it('valida el cuerpo (422)', async () => {
    const { agent } = await setup();
    await agent.put('/api/settings/alegra').send({ email: '' }).expect(422);
  });

  describe('intentos de prueba restantes (FR-035)', () => {
    it('GET informa el límite (10 por minuto) y cuántos quedan', async () => {
      const { agent } = await setup();
      const res = await agent.get('/api/settings/alegra').expect(200);
      expect(res.body.testAttempts).toEqual({ limit: 10, remaining: 10 });
    });

    it('cada prueba correcta descuenta un intento y lo informa; GET refleja lo mismo sin consumir', async () => {
      const { agent } = await setup();
      for (let used = 1; used <= 3; used++) {
        const res = await agent.post('/api/settings/alegra/test').send(good).expect(200);
        expect(res.body).toEqual({ ok: true, testAttempts: { limit: 10, remaining: 10 - used } });
      }
      for (let i = 0; i < 3; i++) {
        expect((await agent.get('/api/settings/alegra').expect(200)).body.testAttempts.remaining).toBe(7);
      }
    });

    it('una prueba rechazada por Alegra también descuenta y lo informa en `details`', async () => {
      const { agent } = await setup();
      const res = await agent.post('/api/settings/alegra/test').send({ ...good, apiToken: 'mal' }).expect(422);
      expect(res.body.error).toBe('alegra_rejected');
      expect(res.body.details).toEqual({ testAttempts: { limit: 10, remaining: 9 } });
    });

    it('Alegra caído: el 502 también informa los intentos', async () => {
      const { agent } = await loggedInAgent(testContext());
      const res = await agent.post('/api/settings/alegra/test').send(good).expect(502);
      expect(res.body.details).toEqual({ testAttempts: { limit: 10, remaining: 9 } });
    });

    it('al agotarlos, el 429 informa que quedan 0 dentro de `details`', async () => {
      const { agent } = await setup();
      for (let i = 0; i < 10; i++) await agent.post('/api/settings/alegra/test').send(good).expect(200);
      const res = await agent.post('/api/settings/alegra/test').send(good).expect(429);
      expect(res.body.error).toBe('too_many_requests');
      expect(res.body.details).toEqual({ testAttempts: { limit: 10, remaining: 0 } });
      expect((await agent.get('/api/settings/alegra').expect(200)).body.testAttempts).toEqual({ limit: 10, remaining: 0 });
    });

    it('guardar las credenciales (PUT) no gasta intentos de prueba', async () => {
      const { agent } = await setup();
      await agent.put('/api/settings/alegra').send(good).expect(200);
      expect((await agent.get('/api/settings/alegra').expect(200)).body.testAttempts.remaining).toBe(10);
    });

    it('un cuerpo inválido (422 de validación) también cuenta como intento: el limitador va antes de validar', async () => {
      const { agent } = await setup();
      await agent.post('/api/settings/alegra/test').send({ email: '' }).expect(422);
      expect((await agent.get('/api/settings/alegra').expect(200)).body.testAttempts.remaining).toBe(9);
    });

    it('nunca expone el token', async () => {
      const { agent } = await setup();
      const res = await agent.post('/api/settings/alegra/test').send(good).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('tok_valido');
    });
  });

  it('el token no aparece en los logs de error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { agent } = await loggedInAgent(testContext());
    await agent.put('/api/settings/alegra').send({ email: 'a@b.co', apiToken: 'TOKEN_SECRETO_XYZ' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('TOKEN_SECRETO_XYZ');
    spy.mockRestore();
  });
});
