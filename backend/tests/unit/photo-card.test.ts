import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_SIZE, composeCard, type PhotoBackdrop } from '../../src/pdf/photo-card';
import { CARD_PHOTOS, meanColor } from '../fixtures/card-photos';

const FILL = '#11052C';
const { w, h } = DEFAULT_CARD_SIZE;
const make = async (photo: Buffer, backdrop: PhotoBackdrop = 'marco') => composeCard({ source: photo, w, h, fill: FILL, backdrop });

describe('composeCard (modo marco)', () => {
  it.each(['verticalPlain', 'horizontalPlain', 'squarePlain', 'transparent', 'tiny'] as const)(
    '%s: sale a 6,10 × 8,03 cm a 150 ppp y como JPEG',
    async (name) => {
      const out = await make(await CARD_PHOTOS[name]());
      const meta = await sharp(out.jpeg).metadata();
      expect({ w: meta.width, h: meta.height, format: meta.format }).toEqual({ w, h, format: 'jpeg' });
      expect(out).toMatchObject({ used: 'marco', fellBack: false, reason: null });
    },
  );

  it('es determinista: las mismas entradas dan los mismos bytes', async () => {
    const photo = await CARD_PHOTOS.verticalPlain();
    const a = await make(photo);
    const b = await make(photo);
    expect(a.jpeg.equals(b.jpeg)).toBe(true);
  });

  it('otro color o otra foto da otra tarjeta', async () => {
    const photo = await CARD_PHOTOS.verticalPlain();
    const base = await make(photo);
    const other = await composeCard({ source: photo, w, h, fill: '#2A1258', backdrop: 'marco' });
    expect(base.jpeg.equals(other.jpeg)).toBe(false);
    expect(base.jpeg.equals((await make(await CARD_PHOTOS.horizontalPlain())).jpeg)).toBe(false);
  });

  it('deja libre la franja superior del nombre: es oscura y sin la foto', async () => {
    const out = await make(await CARD_PHOTOS.squarePlain());
    // Fotos de fondo claro: si la franja tuviera la foto, sus píxeles serían claros
    const strip = await meanColor(out.jpeg, { left: Math.round(w * 0.1), top: 2, width: Math.round(w * 0.8), height: Math.round(h * 0.12) });
    for (const channel of strip) expect(channel).toBeLessThan(110);
  });

  it('la foto no se deforma: el marco claro conserva la proporción de la foto horizontal', async () => {
    const out = await make(await CARD_PHOTOS.horizontalPlain());
    const { data, info } = await sharp(out.jpeg).raw().toBuffer({ resolveWithObject: true });
    // Filas y columnas del marco claro (#F4EFE6): su caja envuelve la foto
    let x0 = info.width;
    let x1 = 0;
    let y0 = info.height;
    let y1 = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 3;
        if (data[i]! > 235 && data[i + 1]! > 230 && data[i + 2]! > 215) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const ratio = (x1 - x0 + 1) / (y1 - y0 + 1);
    expect(ratio).toBeGreaterThan(1.3); // la foto es 900 × 600 (1,5): el marco no la volvió vertical
    expect(ratio).toBeLessThan(1.7);
  });

  it('una foto diminuta no se agranda más allá de su tamaño: queda con fondo oscuro alrededor', async () => {
    const out = await make(await CARD_PHOTOS.tiny());
    const { data } = await sharp(out.jpeg).raw().toBuffer({ resolveWithObject: true });
    // Cerca del centro de la zona hay marco claro; en una esquina inferior, fondo oscuro
    const px = (x: number, y: number) => data[(y * w + x) * 3]!;
    expect(px(Math.round(w * 0.06), h - 8)).toBeLessThan(90);
  });

  it('una foto ilegible no inventa nada: lanza', async () => {
    await expect(make(Buffer.from('no es una imagen'))).rejects.toThrow();
  });

  it('pesa poco: una tarjeta de foto simple queda por debajo de 60 KB', async () => {
    const out = await make(await CARD_PHOTOS.verticalPlain());
    expect(out.jpeg.length).toBeLessThan(60_000);
  });
});
