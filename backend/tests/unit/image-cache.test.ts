import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const HOUR = 60 * 60 * 1000;
/** Dirección firmada como las del CDN de Alegra: la firma cambia en cada listado, la ruta no. */
const signed = (route: string, sig: string) => `${mock.url}${route}?Expires=${sig}&Signature=firma-${sig}&Key-Pair-Id=K1`;
const requestsTo = (route: string) => mock.requests.filter((r) => r.path === route).length;
/** Envejece un archivo del caché como si se hubiera descargado hace `ms`. */
const age = (name: string, ms: number) => {
  const t = new Date(Date.now() - ms);
  fs.utimesSync(path.join(dir, name), t, t);
};

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

describe('ImageCache.download: la copia sobrevive a los cambios de firma de la dirección', () => {
  it('la misma foto con otra firma (Expires/Signature) reutiliza la copia: no se vuelve a descargar ni se duplica', async () => {
    const cache = new ImageCache(dir);
    const first = await cache.download(signed('/img/generic.png', 'A'));
    const second = await cache.download(signed('/img/generic.png', 'B'));
    expect(first).toMatchObject({ ok: true });
    expect(second).toEqual(first);
    expect(requestsTo('/img/generic.png')).toBe(1);
    expect(files()).toHaveLength(1);
  });

  it('otra foto (otra ruta) se descarga aparte aunque lleve la misma firma', async () => {
    const cache = new ImageCache(dir);
    const png = await cache.download(signed('/img/generic.png', 'A'));
    const jpg = await cache.download(signed('/img/generic.jpg', 'A'));
    expect(png).toMatchObject({ ok: true });
    expect(jpg).toMatchObject({ ok: true });
    expect(png).not.toEqual(jpg);
    expect(files()).toHaveLength(2);
  });

  it('un parámetro que no es de firma sigue distinguiendo fotos: no se sirve la foto de otro producto', async () => {
    const cache = new ImageCache(dir);
    const one = await cache.download(`${mock.url}/img/generic.png?foto=1&Signature=A`);
    const two = await cache.download(`${mock.url}/img/generic.png?foto=2&Signature=A`);
    expect(one).toMatchObject({ ok: true });
    expect(two).toMatchObject({ ok: true });
    expect(one).not.toEqual(two);
    expect(requestsTo('/img/generic.png')).toBe(2);
  });

  it('pasada la hora la copia se descarga de nuevo y se renueva (una foto cambiada en la misma ruta no se queda vieja)', async () => {
    const cache = new ImageCache(dir);
    const first = await cache.download(signed('/img/generic.png', 'A'));
    if (!first.ok) throw new Error('no debería fallar');
    const name = path.basename(first.url);
    fs.writeFileSync(path.join(dir, name), Buffer.from('copia vieja'));
    age(name, 2 * HOUR);

    const again = await cache.download(signed('/img/generic.png', 'B'));
    expect(again).toEqual(first);
    expect(requestsTo('/img/generic.png')).toBe(2);
    expect(fs.readFileSync(path.join(dir, name))).toEqual(PNG_1X1);
    expect(files()).toHaveLength(1);
  });
});

describe('ImageCache.prune: el caché no crece sin límite', () => {
  const OLD = 48 * HOUR; // mucho más viejo que la ventana de reutilización y que cualquier preparación vigente
  const seed = (name: string, ageMs: number) => {
    fs.writeFileSync(path.join(dir, name), 'x');
    age(name, ageMs);
  };
  const sha = (c: string) => c.repeat(40);

  it('borra las copias que llevan más de un día sin renovarse y conserva las recientes', () => {
    seed(`${sha('a')}.png`, OLD);
    seed(`${sha('b')}.jpg`, OLD);
    seed(`${sha('c')}.png`, 2 * HOUR); // fuera de la ventana de reutilización, pero la puede estar usando una preparación abierta
    seed(`${sha('d')}.webp`, 60_000);
    new ImageCache(dir).prune();
    expect(files().sort()).toEqual([`${sha('c')}.png`, `${sha('d')}.webp`]);
  });

  it('borra también los .part abandonados por una descarga interrumpida, pero no el de una descarga en curso', () => {
    seed(`${sha('a')}.png.part`, OLD);
    seed(`${sha('b')}.png.part`, 1_000);
    new ImageCache(dir).prune();
    expect(files()).toEqual([`${sha('b')}.png.part`]);
  });

  it('no toca archivos que no son del caché', () => {
    seed('notas.txt', OLD);
    seed(`${sha('a')}.svg`, OLD);
    seed(`${sha('a')}.png`, OLD);
    new ImageCache(dir).prune();
    expect(files().sort()).toEqual([`${sha('a')}.svg`, 'notas.txt']);
  });

  it('con la carpeta inexistente no falla', () => {
    expect(() => new ImageCache(path.join(dir, 'no-existe')).prune()).not.toThrow();
  });

  it('un archivo que no se puede borrar (en uso, sin permiso) no impide borrar los demás ni lanza', () => {
    seed(`${sha('a')}.png`, OLD);
    seed(`${sha('b')}.png`, OLD);
    seed(`${sha('c')}.jpg`, OLD);
    const rm = vi.spyOn(fs, 'rmSync').mockImplementationOnce(() => {
      throw Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' });
    });
    try {
      expect(() => new ImageCache(dir).prune()).not.toThrow();
    } finally {
      rm.mockRestore();
    }
    expect(files()).toHaveLength(1); // el que falló queda para la próxima poda
  });
});

describe('ImageCache.downloadAll: poda al terminar la preparación', () => {
  it('borra lo viejo, conserva lo reciente y las fotos de esta preparación', async () => {
    const stale = `${'a'.repeat(40)}.png`;
    const recent = `${'b'.repeat(40)}.png`;
    fs.writeFileSync(path.join(dir, stale), 'x');
    fs.writeFileSync(path.join(dir, recent), 'x');
    age(stale, 48 * HOUR);
    age(recent, 10 * 60_000);

    const out = await new ImageCache(dir).downloadAll(new Map([['p', [signed('/img/generic.png', 'A')]]]));
    const mine = out.get('p');
    if (mine?.status !== 'ok') throw new Error('debería haber descargado la foto');
    expect(files().sort()).toEqual([recent, path.basename(mine.url)].sort());
  });

  it('preparar dos veces con firmas distintas deja los mismos archivos y no vuelve a descargar (el caso real)', async () => {
    const cache = new ImageCache(dir);
    const batch = (sig: string) =>
      new Map([
        ['1', [signed('/img/generic.png', sig)]],
        ['2', [signed('/img/generic.jpg', sig)]],
      ]);
    const first = await cache.downloadAll(batch('A'));
    const afterFirst = files().sort();
    const second = await cache.downloadAll(batch('B'));
    expect(afterFirst).toHaveLength(2);
    expect(files().sort()).toEqual(afterFirst);
    expect(second).toEqual(first);
    expect(requestsTo('/img/generic.png') + requestsTo('/img/generic.jpg')).toBe(2);
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
