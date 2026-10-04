import { afterEach, describe, expect, it } from 'vitest';
import { AlegraClient } from '../../src/alegra/alegra.client';
import { AlegraError, type AlegraItemRaw } from '../../src/alegra/alegra.types';
import { startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
afterEach(async () => mock?.close());

const makeItems = (n: number): AlegraItemRaw[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Item ${i + 1}`, status: 'active' }));

const client = (m: AlegraMock, token = 'tok_valido') =>
  new AlegraClient({ baseUrl: m.url, email: 'tienda@example.com', token, sleep: async () => {} });

describe('AlegraClient', () => {
  it('pagina hasta agotar resultados (65 ítems = 3 páginas)', async () => {
    mock = await startAlegraMock({ items: makeItems(65) });
    const items = await client(mock).listActiveItems();
    expect(items).toHaveLength(65);
    expect(mock.requests.filter((r) => r.path === '/items')).toHaveLength(3);
  });

  it('un listado exacto de 30 hace una página extra vacía y no pierde ítems', async () => {
    mock = await startAlegraMock({ items: makeItems(30) });
    expect(await client(mock).listActiveItems()).toHaveLength(30);
  });

  it('solo hace peticiones GET (Alegra es de solo lectura)', async () => {
    mock = await startAlegraMock({ items: makeItems(3), categories: [{ id: '1', name: 'RAMEN' }] });
    const c = client(mock);
    await c.getCompany();
    await c.listCategories();
    await c.listActiveItems();
    expect(mock.requests.every((r) => r.method === 'GET')).toBe(true);
  });

  it('pide los ítems con mode=advanced en cada página para que Alegra incluya las fotos', async () => {
    mock = await startAlegraMock({ items: makeItems(65) });
    await client(mock).listActiveItems();
    const pages = mock.requests.filter((r) => r.path === '/items');
    expect(pages).toHaveLength(3);
    for (const p of pages) {
      const q = new URLSearchParams(p.search);
      expect(q.get('status')).toBe('active');
      expect(q.get('mode')).toBe('advanced');
      expect(q.get('limit')).toBe('30');
    }
  });

  it('conserva las fotos con la forma real de Alegra tal como llegan', async () => {
    const images = [{ id: 7, name: 'a.jpg', url: 'https://cdn3.alegra.com/a.jpg?Expires=1', favorite: true }];
    mock = await startAlegraMock({ items: [{ id: '1', name: 'Con foto', status: 'active', images }] });
    const [item] = await client(mock).listActiveItems();
    expect(item!.images).toEqual(images);
  });

  it('con timeoutMs una petición colgada se corta como "no se pudo conectar"', async () => {
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('abortado')));
      });
    const c = new AlegraClient({
      baseUrl: 'http://alegra.invalid',
      email: 'tienda@example.com',
      token: 'tok',
      fetchImpl: hanging,
      timeoutMs: 30,
    });
    const started = Date.now();
    await expect(c.getCompany()).rejects.toBeInstanceOf(AlegraError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reintenta ante 429 y luego responde', async () => {
    mock = await startAlegraMock({ items: makeItems(2), rateLimitFirst: 2 });
    expect(await client(mock).listActiveItems()).toHaveLength(2);
  });

  it('falla con rate_limit si el 429 persiste', async () => {
    mock = await startAlegraMock({ rateLimitFirst: 99 });
    await expect(client(mock).getCompany()).rejects.toMatchObject({ kind: 'rate_limit' });
  });

  it('401 se reporta como credenciales rechazadas', async () => {
    mock = await startAlegraMock();
    const err = (await client(mock, 'otro')
      .getCompany()
      .catch((e: unknown) => e)) as AlegraError;
    expect(err).toBeInstanceOf(AlegraError);
    expect(err.kind).toBe('rejected');
  });

  it('servidor inalcanzable se reporta como unreachable', async () => {
    const c = new AlegraClient({ baseUrl: 'http://127.0.0.1:1', email: 'a', token: 'b' });
    await expect(c.getCompany()).rejects.toMatchObject({ kind: 'unreachable' });
  });
});
