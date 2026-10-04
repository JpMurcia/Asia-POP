import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { SEED, testContext } from '../helpers';

describe('autenticación', () => {
  it('rechaza credenciales incorrectas con mensaje genérico', async () => {
    const app = createApp(testContext());
    const badUser = await request(app).post('/api/auth/login').send({ username: 'x', password: SEED.password });
    const badPass = await request(app).post('/api/auth/login').send({ username: SEED.username, password: 'x' });
    expect(badUser.status).toBe(401);
    expect(badPass.status).toBe(401);
    expect(badUser.body.message).toBe(badPass.body.message);
  });

  it('acepta los datos semilla, crea cookie httpOnly y permite consultar la sesión', async () => {
    const app = createApp(testContext());
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send(SEED);
    expect(login.status).toBe(204);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const session = await agent.get('/api/auth/session');
    expect(session.status).toBe(200);
    expect(session.body).toEqual({ authenticated: true });
  });

  it('cerrar sesión invalida la cookie', async () => {
    const app = createApp(testContext());
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(SEED).expect(204);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/session').expect(401);
  });

  it('limita a 5 intentos de login por minuto', async () => {
    const app = createApp(testContext());
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'x', password: 'y' }).expect(401);
    }
    await request(app).post('/api/auth/login').send(SEED).expect(429);
  });
});
