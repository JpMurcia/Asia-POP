import { describe, expect, it } from 'vitest';
import { sniffImage } from '../../src/pdf/image-sniff';
import { JPEG_2X2, PNG_1X1 } from '../fixtures/alegra-mock';

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => Uint8Array.from(Buffer.from(s, 'latin1'));

describe('sniffImage (reconoce la imagen por sus bytes, no por el tipo declarado)', () => {
  it('reconoce JPEG, PNG, GIF y WebP', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe('.jpg');
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe('.png');
    expect(sniffImage(ascii('GIF87a....'))).toBe('.gif');
    expect(sniffImage(ascii('GIF89a....'))).toBe('.gif');
    expect(sniffImage(ascii('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '))).toBe('.webp');
  });

  it('reconoce imágenes reales completas', () => {
    expect(sniffImage(PNG_1X1)).toBe('.png');
    expect(sniffImage(JPEG_2X2)).toBe('.jpg');
  });

  it('un RIFF que no es WebP (p. ej. WAV) no es imagen', () => {
    expect(sniffImage(ascii('RIFF\u0000\u0000\u0000\u0000WAVEfmt '))).toBeNull();
  });

  it('rechaza HTML, SVG/XML y bytes cualesquiera', () => {
    expect(sniffImage(ascii('<!doctype html><html></html>'))).toBeNull();
    expect(sniffImage(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(ascii('<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(sniffImage(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBeNull();
  });

  it('un buffer vacío o demasiado corto no es imagen', () => {
    expect(sniffImage(new Uint8Array(0))).toBeNull();
    expect(sniffImage(bytes(0xff))).toBeNull();
    expect(sniffImage(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });
});
