import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AlegraCategoryRaw, AlegraItemRaw } from '../../src/alegra/alegra.types';
import {
  brokenJpeg,
  exifJpeg,
  heavyJpeg,
  heavyPng,
  lightJpeg,
  opaqueAlphaPng,
  staticGif,
  tinyPng,
  transparentPng,
} from './photos';

/** Fotos sintéticas pesadas (feature 005): ruta del simulador → bytes. Se sirven como las de Alegra: `binary/octet-stream`. */
const HEAVY_PHOTOS: Record<string, () => Promise<Buffer>> = {
  '/img/heavy.png': heavyPng,
  '/img/heavy.jpg': heavyJpeg,
  '/img/alpha.png': transparentPng,
  '/img/opaque-alpha.png': opaqueAlphaPng,
  '/img/tiny.png': tinyPng,
  '/img/light.jpg': lightJpeg,
  '/img/exif.jpg': exifJpeg,
  '/img/broken.jpg': brokenJpeg,
  '/img/photo.gif': staticGif,
};

export interface AlegraMockOptions {
  email?: string;
  token?: string;
  items?: AlegraItemRaw[];
  categories?: AlegraCategoryRaw[];
  /** Cantidad de respuestas 429 iniciales antes de responder normalmente. */
  rateLimitFirst?: number;
}

export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** JPEG válido de 2×2 px (empieza por `FF D8 FF`); sirve también para pruebas que lo decodifican. */
export const JPEG_2X2 = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABwj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCWADpZb//Z',
  'base64',
);

export interface AlegraMock {
  url: string;
  /** Reemplaza los ítems servidos (útil para referenciar `${mock.url}/img/ok.png`). */
  setItems: (items: AlegraItemRaw[]) => void;
  /** Peticiones recibidas; `search` es la consulta (p. ej. `?status=active&mode=advanced`), vacía si no hay. */
  requests: { method: string; path: string; search: string }[];
  close: () => Promise<void>;
}

export async function startAlegraMock(opts: AlegraMockOptions = {}): Promise<AlegraMock> {
  const email = opts.email ?? 'tienda@example.com';
  const token = opts.token ?? 'tok_valido';
  const expected = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
  const requests: AlegraMock['requests'] = [];
  let limited = opts.rateLimitFirst ?? 0;
  let currentItems = opts.items ?? [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    requests.push({ method: req.method ?? 'GET', path: url.pathname, search: url.search });
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };
    // Imágenes de producto (públicas, sin autenticación, como las fotos firmadas del CDN de Alegra).
    // MOCK_IMG permite probar el diseño con una imagen real (revisión visual manual).
    const realImg = (): Buffer => (process.env.MOCK_IMG ? fs.readFileSync(process.env.MOCK_IMG) : PNG_1X1);
    switch (url.pathname) {
      // Las fotos reales de Alegra llegan con `Content-Type: binary/octet-stream` aunque sean JPG o PNG
      case '/img/generic.png':
        res.writeHead(200, { 'Content-Type': 'binary/octet-stream' });
        return res.end(realImg());
      case '/img/generic.jpg':
        res.writeHead(200, { 'Content-Type': 'binary/octet-stream' });
        return res.end(JPEG_2X2);
      case '/img/ok.png':
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return res.end(realImg());
      case '/img/forbidden':
        return send(403, { message: 'Forbidden' });
      case '/img/missing':
        return send(404, { message: 'no image' });
      case '/img/error':
        return send(500, { message: 'error' });
      case '/img/html':
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end('<!doctype html><html><body>Acceso denegado</body></html>');
      case '/img/svg':
        res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
        return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"></svg>');
      case '/img/slow':
        // Responde pasado el tiempo límite que usan las pruebas (≈ 200 ms)
        {
          const timer = setTimeout(() => {
            res.writeHead(200, { 'Content-Type': 'binary/octet-stream' });
            res.end(PNG_1X1);
          }, 1500);
          res.on('close', () => clearTimeout(timer));
          return;
        }
      case '/img/big':
        // Mayor que el tope bajo (1 KB) con el que se prueba `too_large`
        res.writeHead(200, { 'Content-Type': 'binary/octet-stream' });
        return res.end(Buffer.concat([PNG_1X1, Buffer.alloc(2048)]));
    }
    // Fotos sintéticas pesadas para las pruebas del PDF liviano
    const heavy = HEAVY_PHOTOS[url.pathname];
    if (heavy) {
      heavy().then(
        (bytes) => {
          res.writeHead(200, { 'Content-Type': 'binary/octet-stream' });
          res.end(bytes);
        },
        () => send(500, { message: 'no se pudo crear la foto de prueba' }),
      );
      return;
    }
    // Cualquier otra /img/* no existe
    if (url.pathname.startsWith('/img/')) return send(404, { message: 'no image' });
    if (req.headers.authorization !== expected) return send(401, { message: 'Unauthorized' });
    if (limited > 0) {
      limited--;
      return send(429, { message: 'Too many requests' }, { 'Retry-After': '0' });
    }
    if (url.pathname === '/company') return send(200, { name: 'ASIANPOP' });

    const paged = <T>(list: T[]) => {
      const start = Number(url.searchParams.get('start') ?? 0);
      const limit = Math.min(Number(url.searchParams.get('limit') ?? 30), 30);
      return list.slice(start, start + limit);
    };
    if (url.pathname === '/item-categories') return send(200, paged(opts.categories ?? []));
    if (url.pathname === '/items') {
      const status = url.searchParams.get('status');
      const items = currentItems.filter((i) => !status || (i.status ?? 'active') === status);
      return send(200, paged(items));
    }
    return send(404, { message: 'not found' });
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    setItems: (items) => {
      currentItems = items;
    },
    requests,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
