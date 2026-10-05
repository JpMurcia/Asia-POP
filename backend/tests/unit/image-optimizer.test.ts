import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { optimizePhoto, PhotoOptimizer } from '../../src/pdf/image-optimizer';
import {
  belowTargetPng,
  brokenJpeg,
  exifJpeg,
  heavyJpeg,
  heavyPng,
  lightJpeg,
  opaqueAlphaPng,
  staticGif,
  tinyPng,
  transparentPng,
} from '../fixtures/photos';

/** El recuadro de Neón Noche a 150 ppp (research §4). */
const TARGET = { w: 360, h: 474 };

describe('optimizePhoto', () => {
  it('reduce una foto opaca grande a JPEG que cubre el recuadro, con su proporción y calidad 88 en 4:4:4 (FR-004)', async () => {
    const src = await heavyPng(); // 900 × 1200
    const res = await optimizePhoto(src, TARGET);
    expect(res).not.toBeNull();
    expect(res!.ext).toBe('jpg');
    expect(res!.buffer.length).toBeLessThan(src.length);
    const meta = await sharp(res!.buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.chromaSubsampling).toBe('4:4:4');
    // Escala = max(360/900, 474/1200) = 0,4 ⇒ 360 × 480: cubre el recuadro sin recortar
    expect([meta.width, meta.height]).toEqual([360, 480]);
  });

  it('una foto horizontal también cubre el recuadro, y no queda por debajo en ningún eje', async () => {
    const res = await optimizePhoto(await heavyJpeg(), TARGET); // 1600 × 1200
    expect(res!.ext).toBe('jpg');
    const meta = await sharp(res!.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([632, 474]);
    expect(meta.width!).toBeGreaterThanOrEqual(TARGET.w);
    expect(meta.height!).toBeGreaterThanOrEqual(TARGET.h);
  });

  it('una foto con transparencia real se conserva como PNG con su transparencia (FR-006)', async () => {
    const res = await optimizePhoto(await transparentPng(), TARGET); // 800 × 1000
    expect(res).not.toBeNull();
    expect(res!.ext).toBe('png');
    const { data, info } = await sharp(res!.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect((await sharp(res!.buffer).metadata()).hasAlpha).toBe(true);
    expect(data[3]).toBe(0); // la esquina (0,0) sigue transparente
    const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
    expect(data[center + 3]).toBe(255); // y el centro, opaco
    expect([info.width, info.height]).toEqual([379, 474]);
  });

  it('un PNG con canal alfa totalmente opaco no tiene transparencia real: pasa a JPEG', async () => {
    const res = await optimizePhoto(await opaqueAlphaPng(), TARGET);
    expect(res!.ext).toBe('jpg');
    expect((await sharp(res!.buffer).metadata()).hasAlpha).toBe(false);
  });

  it('una foto diminuta no se agranda ni pesa menos: se usa el original (FR-004, FR-007)', async () => {
    expect(await optimizePhoto(await tinyPng(), TARGET)).toBeNull();
  });

  it('una foto menor que el recuadro en ambos ejes no se agranda pero sí se recomprime', async () => {
    const res = await optimizePhoto(await belowTargetPng(), TARGET); // 300 × 300 sin comprimir
    expect(res).not.toBeNull();
    const meta = await sharp(res!.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([300, 300]);
  });

  it('una foto angosta que no cubre el ancho del recuadro no se agranda (no se reduce a medias)', async () => {
    // 300 × 1000 sin comprimir: para cubrir 360 de ancho habría que agrandarla, así que se queda en su tamaño
    const px = Buffer.alloc(300 * 1000 * 3);
    for (let i = 0; i < px.length; i++) px[i] = (i * 7) % 251;
    const narrow = await sharp(px, { raw: { width: 300, height: 1000, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    const res = await optimizePhoto(narrow, TARGET);
    expect(res).not.toBeNull();
    const meta = await sharp(res!.buffer).metadata();
    expect([meta.width, meta.height]).toEqual([300, 1000]);
  });

  it('un JPEG ya liviano no se recomprime: la copia pesaría más que el original (FR-007)', async () => {
    expect(await optimizePhoto(await lightJpeg(), TARGET)).toBeNull();
  });

  it('aplica la orientación EXIF: una foto guardada de 1200 × 800 con orientación 6 sale vertical', async () => {
    const res = await optimizePhoto(await exifJpeg(), TARGET);
    expect(res).not.toBeNull();
    const meta = await sharp(res!.buffer).metadata();
    expect(meta.height!).toBeGreaterThan(meta.width!);
    // Se muestra de 800 × 1200 ⇒ escala max(360/800, 474/1200) = 0,45 ⇒ 360 × 540
    expect([meta.width, meta.height]).toEqual([360, 540]);
  });

  it('una foto dañada no lanza: devuelve null y se usa el original (FR-008)', async () => {
    await expect(optimizePhoto(await brokenJpeg(), TARGET)).resolves.toBeNull();
    await expect(optimizePhoto(Buffer.alloc(0), TARGET)).resolves.toBeNull();
    await expect(optimizePhoto(Buffer.from('<html>no es una imagen</html>'), TARGET)).resolves.toBeNull();
  });

  it('un GIF no lanza y, si se reduce, no se agranda', async () => {
    const res = await optimizePhoto(await staticGif(), TARGET); // 600 × 600
    if (res) {
      const meta = await sharp(res.buffer).metadata();
      expect(meta.width!).toBeLessThanOrEqual(600);
      expect(meta.height!).toBeLessThanOrEqual(600);
    }
  });
});

describe('PhotoOptimizer', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  /** Carpetas temporales de caché, subidas y copias; el optimizador se crea después de dejar los archivos. */
  function setup() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-opt-'));
    dirs.push(base);
    const cacheDir = path.join(base, 'image-cache');
    const uploadsDir = path.join(base, 'uploads');
    const root = path.join(base, 'pdf-photos');
    fs.mkdirSync(cacheDir);
    fs.mkdirSync(uploadsDir);
    return { cacheDir, uploadsDir, root, make: () => new PhotoOptimizer(root, { cacheDir, uploadsDir }) };
  }

  async function withPhotos() {
    const s = setup();
    fs.writeFileSync(path.join(s.cacheDir, 'aaa.png'), await heavyPng());
    fs.writeFileSync(path.join(s.cacheDir, 'bbb.png'), await transparentPng());
    fs.writeFileSync(path.join(s.cacheDir, 'ccc.png'), await tinyPng());
    fs.writeFileSync(path.join(s.uploadsDir, 'u1.jpg'), await heavyJpeg());
    return s;
  }

  const URLS = [
    '/media/cache/aaa.png',
    '/media/cache/bbb.png',
    '/media/cache/ccc.png', // diminuta: no se reduce
    '/media/uploads/u1.jpg',
    '/media/cache/missing.png', // el archivo no existe
    '/assets/x.png', // no es una foto local
    'https://cdn.example.com/a.png',
    '/media/cache/../x.png', // nombre no seguro
  ];

  it('devuelve solo las fotos que se redujeron, con copias en <raíz>/<trabajo>/ (caché y subidas)', async () => {
    const s = await withPhotos();
    const map = await s.make().run('run1', URLS, TARGET);
    expect([...map.keys()].sort()).toEqual(['/media/cache/aaa.png', '/media/cache/bbb.png', '/media/uploads/u1.jpg']);
    for (const value of map.values()) {
      expect(value).toMatch(/^\/media\/pdf\/run1\/[A-Za-z0-9._-]+\.(jpg|png)$/);
      expect(fs.existsSync(path.join(s.root, 'run1', path.basename(value)))).toBe(true);
    }
    expect(map.get('/media/cache/aaa.png')).toMatch(/\.jpg$/);
    expect(map.get('/media/cache/bbb.png')).toMatch(/\.png$/); // transparencia real
    expect(map.get('/media/uploads/u1.jpg')).toMatch(/\.jpg$/);
  });

  it('las copias pesan menos que los originales y los originales no se tocan (FR-010)', async () => {
    const s = await withPhotos();
    const before = fs.readFileSync(path.join(s.cacheDir, 'aaa.png'));
    const map = await s.make().run('run1', URLS, TARGET);
    const copy = fs.readFileSync(path.join(s.root, 'run1', path.basename(map.get('/media/cache/aaa.png')!)));
    expect(copy.length).toBeLessThan(before.length);
    expect(fs.readFileSync(path.join(s.cacheDir, 'aaa.png')).equals(before)).toBe(true);
  });

  it('informa el avance hasta el total de fotos locales de nombre seguro', async () => {
    const s = await withPhotos();
    const calls: [number, number][] = [];
    await s.make().run('run1', URLS, TARGET, (done, total) => calls.push([done, total]));
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.at(-1)).toEqual([5, 5]); // aaa, bbb, ccc, u1 y missing
    expect(calls.map(([d]) => d)).toEqual([...calls.map(([d]) => d)].sort((a, b) => a - b));
  });

  it('sin objetivo (la plantilla no tiene bloque de productos) no hace nada', async () => {
    const s = await withPhotos();
    const map = await s.make().run('run1', URLS, null);
    expect(map.size).toBe(0);
    expect(fs.existsSync(path.join(s.root, 'run1'))).toBe(false);
  });

  it('cleanup borra las copias del trabajo y no falla si no existen', async () => {
    const s = await withPhotos();
    const opt = s.make();
    await opt.run('run1', URLS, TARGET);
    expect(fs.existsSync(path.join(s.root, 'run1'))).toBe(true);
    opt.cleanup('run1');
    expect(fs.existsSync(path.join(s.root, 'run1'))).toBe(false);
    expect(() => opt.cleanup('run1')).not.toThrow();
    expect(() => opt.cleanup('nunca-existio')).not.toThrow();
  });

  it('al crearse borra los restos de un cierre brusco', () => {
    const s = setup();
    fs.mkdirSync(path.join(s.root, 'viejo'), { recursive: true });
    fs.writeFileSync(path.join(s.root, 'viejo', 'x.jpg'), 'resto');
    s.make();
    expect(fs.existsSync(path.join(s.root, 'viejo'))).toBe(false);
  });

  it('fileFor devuelve la ruta solo de copias que existen y con nombres seguros', async () => {
    const s = await withPhotos();
    const opt = s.make();
    const map = await opt.run('run1', URLS, TARGET);
    const name = path.basename(map.get('/media/cache/aaa.png')!);
    expect(opt.fileFor('run1', name)).toBe(path.join(s.root, 'run1', name));
    expect(opt.fileFor('run1', 'no-existe.jpg')).toBeNull();
    expect(opt.fileFor('run1', '../x.jpg')).toBeNull();
    expect(opt.fileFor('..', name)).toBeNull();
    expect(opt.fileFor('run1', '')).toBeNull();
  });
});
