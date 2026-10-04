import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImageCache } from '../../src/pdf/image-cache';
import { JPEG_2X2, PNG_1X1, startAlegraMock, type AlegraMock } from '../fixtures/alegra-mock';

let mock: AlegraMock;
let dir: string;

beforeEach(async () => {
  mock = await startAlegraMock();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-cache-'));
});
afterEach(async () => {
  await mock.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const files = () => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);
const LOCAL = /^\/media\/cache\/[0-9a-f]{40}\.(jpg|png|webp|gif)$/;

describe('ImageCache.download: acepta la foto por su contenido', () => {
  it('acepta una foto con tipo genérico binary/octet-stream (comportamiento real de Alegra) y fija la extensión real', async () => {
    const cache = new ImageCache(dir);
    const png = await cache.download(`${mock.url}/img/generic.png`);
    const jpg = await cache.download(`${mock.url}/img/generic.jpg`);
    expect(png).toMatchObject({ ok: true });
    expect(jpg).toMatchObject({ ok: true });
    if (!png.ok || !jpg.ok) throw new Error('no debería fallar');
    expect(png.url).toMatch(LOCAL);
    expect(png.url.endsWith('.png')).toBe(true);
    expect(jpg.url.endsWith('.jpg')).toBe(true);
    expect(fs.readFileSync(path.join(dir, path.basename(png.url)))).toEqual(PNG_1X1);
    expect(fs.readFileSync(path.join(dir, path.basename(jpg.url)))).toEqual(JPEG_2X2);
  });

  it('sigue aceptando una foto con un tipo de imagen correcto', async () => {
    const res = await new ImageCache(dir).download(`${mock.url}/img/ok.png`);
    expect(res).toMatchObject({ ok: true });
  });

  it('reutiliza la copia local de la misma URL dentro de la hora', async () => {
    const cache = new ImageCache(dir);
    await cache.download(`${mock.url}/img/generic.png`);
    await cache.download(`${mock.url}/img/generic.png`);
    expect(mock.requests.filter((r) => r.path === '/img/generic.png')).toHaveLength(1);
    expect(files()).toHaveLength(1);
  });
});

describe('ImageCache.download: un motivo por cada fallo, sin dejar archivos', () => {
  const cases: [string, string][] = [
    ['/img/forbidden', 'unauthorized'],
    ['/img/missing', 'not_found'],
    ['/img/html', 'not_image'],
    ['/img/svg', 'unsupported_format'],
    ['/img/error', 'unavailable'],
  ];
  it.each(cases)('%s => %s', async (route, reason) => {
    const res = await new ImageCache(dir).download(`${mock.url}${route}`);
    expect(res).toEqual({ ok: false, reason });
    expect(files()).toEqual([]);
  });

  it('una ruta desconocida da not_found', async () => {
    expect(await new ImageCache(dir).download(`${mock.url}/img/no-existe.png`)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('tiempo agotado => timeout', async () => {
    const res = await new ImageCache(dir, fetch, 200).download(`${mock.url}/img/slow`);
    expect(res).toEqual({ ok: false, reason: 'timeout' });
    expect(files()).toEqual([]);
  });

  it('cuerpo mayor que el tope => too_large', async () => {
    const res = await new ImageCache(dir, fetch, 10_000, 1024).download(`${mock.url}/img/big`);
    expect(res).toEqual({ ok: false, reason: 'too_large' });
    expect(files()).toEqual([]);
  });

  it('content-length mayor que el tope => too_large sin leer el cuerpo', async () => {
    let bodyRead = false;
    // Respuesta falsa: `arrayBuffer` solo se invoca si el código intenta leer el cuerpo
    const fake = {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'binary/octet-stream', 'content-length': '999999999' }),
      body: { cancel: async () => {} },
      arrayBuffer: async () => {
        bodyRead = true;
        return new ArrayBuffer(0);
      },
    };
    const fetchImpl = (async () => fake) as unknown as typeof fetch;
    const res = await new ImageCache(dir, fetchImpl).download('https://cdn.example/x.jpg');
    expect(res).toEqual({ ok: false, reason: 'too_large' });
    expect(bodyRead).toBe(false);
  });

  it('un cuerpo vacío no es una imagen', async () => {
    const fetchImpl = (async () => new Response(null, { status: 200, headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;
    expect(await new ImageCache(dir, fetchImpl).download('https://cdn.example/x.png')).toEqual({ ok: false, reason: 'not_image' });
  });

  it('un servidor inalcanzable => unavailable', async () => {
    expect(await new ImageCache(dir).download('http://127.0.0.1:1/x.png')).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('no reenvía credenciales: la petición no lleva Authorization', async () => {
    let headers: HeadersInit | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      headers = init?.headers;
      return new Response(PNG_1X1, { status: 200, headers: { 'content-type': 'binary/octet-stream' } });
    }) as unknown as typeof fetch;
    await new ImageCache(dir, fetchImpl).download('https://cdn.example/x.png');
    expect(JSON.stringify(headers ?? {}).toLowerCase()).not.toContain('authorization');
  });
});

describe('ImageCache.fetchFirst: prueba las candidatas en orden', () => {
  it('sin candidatas => none', async () => {
    expect(await new ImageCache(dir).fetchFirst([])).toEqual({ status: 'none' });
  });

  it('usa la primera que sirva', async () => {
    const out = await new ImageCache(dir).fetchFirst([`${mock.url}/img/forbidden`, `${mock.url}/img/generic.jpg`]);
    expect(out.status).toBe('ok');
    if (out.status !== 'ok') throw new Error();
    expect(out.url.endsWith('.jpg')).toBe(true);
  });

  it('si la primera sirve no consulta las demás', async () => {
    await new ImageCache(dir).fetchFirst([`${mock.url}/img/generic.png`, `${mock.url}/img/generic.jpg`]);
    expect(mock.requests.map((r) => r.path)).toEqual(['/img/generic.png']);
  });

  it('si ninguna sirve, el motivo es el de la primera candidata', async () => {
    const out = await new ImageCache(dir).fetchFirst([`${mock.url}/img/forbidden`, `${mock.url}/img/missing`]);
    expect(out).toEqual({ status: 'failed', reason: 'unauthorized' });
    expect(files()).toEqual([]);
  });
});

describe('ImageCache.downloadAll', () => {
  it('devuelve un resultado por producto: ok, none y failed', async () => {
    const out = await new ImageCache(dir).downloadAll(
      new Map([
        ['a', [`${mock.url}/img/generic.png`]],
        ['b', []],
        ['c', [`${mock.url}/img/forbidden`]],
      ]),
    );
    expect(out.get('a')).toMatchObject({ status: 'ok' });
    expect(out.get('b')).toEqual({ status: 'none' });
    expect(out.get('c')).toEqual({ status: 'failed', reason: 'unauthorized' });
    expect(out.size).toBe(3);
  });

  it('respeta el tope de concurrencia y avisa el avance hasta el total', async () => {
    let active = 0;
    let max = 0;
    const fetchImpl = (async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
      return new Response(PNG_1X1, { status: 200, headers: { 'content-type': 'binary/octet-stream' } });
    }) as unknown as typeof fetch;
    const urls = new Map<string, string[]>(Array.from({ length: 7 }, (_, i) => [`p${i}`, [`https://cdn.example/${i}.png`]]));
    const progress: [number, number][] = [];
    const out = await new ImageCache(dir, fetchImpl).downloadAll(urls, 2, (d, t) => progress.push([d, t]));
    expect(out.size).toBe(7);
    expect(max).toBeLessThanOrEqual(2);
    expect(progress.at(-1)).toEqual([7, 7]);
  });
});
