import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_SIZE, composeCard, type FallbackReason } from '../../src/pdf/photo-card';
import { CARD_PHOTOS, meanColor } from '../fixtures/card-photos';

const FILL = '#11052C';
const { w, h } = DEFAULT_CARD_SIZE;
const cutout = (photo: Buffer) => composeCard({ source: photo, w, h, fill: FILL, backdrop: 'sin-fondo' });

describe('composeCard (modo sin-fondo)', () => {
  it.each(['verticalPlain', 'horizontalPlain', 'squarePlain', 'transparent'] as const)(
    '%s: separa el producto y lo deja flotando sobre el fondo oscuro',
    async (name) => {
      const out = await cutout(await CARD_PHOTOS[name]());
      expect(out).toMatchObject({ used: 'sin-fondo', fellBack: false, reason: null });
      // Esquinas inferiores: color de la tarjeta, no el blanco de la foto
      const corner = await meanColor(out.jpeg, { left: 4, top: h - 24, width: 24, height: 16 });
      for (const channel of corner) expect(channel).toBeLessThan(70);
      // El centro de la zona de la foto lleva el rojo de la lata
      const center = await meanColor(out.jpeg, { left: Math.round(w / 2) - 6, top: Math.round(h * 0.55), width: 12, height: 12 });
      expect(center[0]!).toBeGreaterThan(center[2]! + 40);
    },
  );

  it('es determinista', async () => {
    const photo = await CARD_PHOTOS.verticalPlain();
    expect((await cutout(photo)).jpeg.equals((await cutout(photo)).jpeg)).toBe(true);
  });

  it('la tarjeta tiene el mismo tamaño que en modo marco', async () => {
    const meta = await sharp((await cutout(await CARD_PHOTOS.verticalPlain())).jpeg).metadata();
    expect({ w: meta.width, h: meta.height }).toEqual({ w, h });
  });

  it.each([
    ['gradient', 'border_not_uniform'],
    ['cut', 'subject_cut'],
    ['two', 'multiple_subjects'],
    ['fills', 'subject_too_large'],
  ] as const)('%s: no hay confianza y se queda con el marco (%s)', async (name, reason) => {
    const out = await cutout(await CARD_PHOTOS[name]());
    expect(out).toMatchObject({ used: 'marco', fellBack: true, reason: reason as FallbackReason });
    const meta = await sharp(out.jpeg).metadata();
    expect({ w: meta.width, h: meta.height }).toEqual({ w, h });
  });

  it('un empaque blanco sobre blanco no se recorta: cae al marco', async () => {
    const out = await cutout(await CARD_PHOTOS.whiteOnWhite());
    expect(out.used).toBe('marco');
    expect(out.fellBack).toBe(true);
    expect(['subject_too_small', 'border_not_uniform']).toContain(out.reason);
  });

  it('el respaldo es idéntico a pedir el marco directamente', async () => {
    const photo = await CARD_PHOTOS.gradient();
    const fallback = await cutout(photo);
    const direct = await composeCard({ source: photo, w, h, fill: FILL, backdrop: 'marco' });
    expect(fallback.jpeg.equals(direct.jpeg)).toBe(true);
  });

  it('una foto ilegible no se recorta ni se inventa: lanza', async () => {
    await expect(cutout(Buffer.from('xx'))).rejects.toThrow();
  });
});
