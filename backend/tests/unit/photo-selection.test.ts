import { describe, expect, it } from 'vitest';
import { extractImageUrl, extractImageUrls, mapAlegraItem } from '../../src/alegra/alegra.mapper';
import type { AlegraItemRaw } from '../../src/alegra/alegra.types';

const A = 'https://cdn3.alegra.com/a.jpg?Expires=1&Signature=x&Key-Pair-Id=k';
const B = 'https://cdn3.alegra.com/b.png?Expires=1&Signature=y&Key-Pair-Id=k';
const C = 'https://cdn3.alegra.com/c.jpg?Expires=1&Signature=z&Key-Pair-Id=k';

const item = (images: AlegraItemRaw['images']): AlegraItemRaw => ({ id: '1', name: 'a', images });
const photo = (url: string, favorite?: boolean, id = 1) => ({ id, name: 'f.jpg', url, ...(favorite === undefined ? {} : { favorite }) });

describe('elección de la foto (favorita primero, luego el resto en orden)', () => {
  it('una sola foto favorita', () => {
    expect(extractImageUrls(item([photo(A, true)]))).toEqual([A]);
    expect(extractImageUrl(item([photo(A, true)]))).toBe(A);
  });

  it('la favorita va primero aunque no sea la primera de la lista (caso real: 4 de 4 productos con varias fotos)', () => {
    const raw = item([photo(A, false), photo(B, true), photo(C, false)]);
    expect(extractImageUrls(raw)).toEqual([B, A, C]);
    expect(extractImageUrl(raw)).toBe(B);
  });

  it('con varias favoritas conservan su orden relativo y van antes que las demás', () => {
    const raw = item([photo(A, false), photo(B, true), photo(C, true)]);
    expect(extractImageUrls(raw)).toEqual([B, C, A]);
  });

  it('sin ninguna favorita se respeta el orden original', () => {
    expect(extractImageUrls(item([photo(A), photo(B), photo(C, false)]))).toEqual([A, B, C]);
    expect(extractImageUrl(item([photo(A), photo(B)]))).toBe(A);
  });

  it('las no favoritas quedan como candidatas de respaldo, en orden', () => {
    expect(extractImageUrls(item([photo(A, false), photo(B, false), photo(C, true)]))).toEqual([C, A, B]);
  });

  it('descarta enlaces vacíos, ausentes, data:, relativos y no http(s)', () => {
    const raw = item([
      photo('', true),
      { id: 2, name: 'x' },
      photo('data:image/png;base64,AAAA', true),
      photo('/media/cache/a.jpg'),
      photo('ftp://x.co/a.jpg'),
      photo('no es una url'),
      photo(B, false),
    ]);
    expect(extractImageUrls(raw)).toEqual([B]);
  });

  it('acepta http y https y no repite direcciones', () => {
    expect(extractImageUrls(item([photo('http://x.co/a.jpg'), photo('http://x.co/a.jpg'), photo(A)]))).toEqual([
      'http://x.co/a.jpg',
      A,
    ]);
  });

  it('tolera las formas previas: texto suelto, { url }, { link } y { src }', () => {
    expect(extractImageUrls(item(['https://x.co/a.jpg']))).toEqual(['https://x.co/a.jpg']);
    expect(extractImageUrls(item([{ url: 'https://x.co/b.jpg' }]))).toEqual(['https://x.co/b.jpg']);
    expect(extractImageUrls(item([{ link: 'https://x.co/c.jpg' }]))).toEqual(['https://x.co/c.jpg']);
    expect(extractImageUrls(item([{ src: 'https://x.co/d.jpg' }]))).toEqual(['https://x.co/d.jpg']);
    expect(extractImageUrls(item(['https://x.co/a.jpg', { url: 'https://x.co/b.jpg', favorite: true }]))).toEqual([
      'https://x.co/b.jpg',
      'https://x.co/a.jpg',
    ]);
  });

  it('sin fotos: images ausente, null o vacío', () => {
    for (const raw of [{ id: '1', name: 'a' } as AlegraItemRaw, item(null), item([])]) {
      expect(extractImageUrls(raw)).toEqual([]);
      expect(extractImageUrl(raw)).toBeNull();
    }
  });

  it('mapAlegraItem fija remoteImageUrl = la elegida e imageUrls = todas las candidatas', () => {
    const mapped = mapAlegraItem({ ...item([photo(A, false), photo(B, true)]), category: { id: 'c1' } });
    expect(mapped.remoteImageUrl).toBe(B);
    expect(mapped.imageUrls).toEqual([B, A]);
    const none = mapAlegraItem(item([]));
    expect(none.remoteImageUrl).toBeNull();
    expect(none.imageUrls).toEqual([]);
  });
});
