import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { testContext } from '../helpers';

describe('guardia de sesión', () => {
  const routes: [string, string][] = [
    ['get', '/api/settings/alegra'],
    ['put', '/api/settings/alegra'],
    ['post', '/api/settings/alegra/test'],
    ['post', '/api/catalog/prepare'],
    ['post', '/api/catalog/generate'],
    ['get', '/api/catalog/jobs/current'],
    ['get', '/api/catalog/history'],
    ['get', '/api/sections'],
    ['get', '/api/custom-products'],
    ['get', '/api/bundles'],
    ['get', '/api/catalog/uncategorized'],
    ['get', '/api/settings/business'],
  ];

  it.each(routes)('%s %s sin sesión responde 401', async (method, url) => {
    const app = createApp(testContext());
    const res = await (request(app) as unknown as Record<string, (u: string) => request.Test>)[method]!(url);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthenticated');
  });
});
