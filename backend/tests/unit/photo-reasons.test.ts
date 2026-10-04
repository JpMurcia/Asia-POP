import { describe, expect, it } from 'vitest';
import { PHOTO_REASON_LABEL } from '../../src/catalog/photo-reasons';
import type { PhotoFailureReason } from '../../src/catalog/types';

const REASONS: PhotoFailureReason[] = [
  'unauthorized',
  'not_found',
  'timeout',
  'not_image',
  'unsupported_format',
  'too_large',
  'unavailable',
];

describe('textos de los motivos de foto no obtenida', () => {
  it('hay un texto por cada motivo y ninguno de más', () => {
    expect(Object.keys(PHOTO_REASON_LABEL).sort()).toEqual([...REASONS].sort());
  });

  it('cada texto está en español, no está vacío y es distinto de los demás', () => {
    const texts = REASONS.map((r) => PHOTO_REASON_LABEL[r]);
    for (const t of texts) expect(t.trim().length).toBeGreaterThan(10);
    expect(new Set(texts).size).toBe(REASONS.length);
  });

  it('no usan códigos HTTP ni jerga técnica', () => {
    for (const r of REASONS) {
      expect(PHOTO_REASON_LABEL[r]).not.toMatch(/\b(401|403|404|410|500|http|https|binary|content-type|octet|mime|url|cdn)\b/i);
    }
  });

  it('coinciden con la tabla de data-model.md', () => {
    expect(PHOTO_REASON_LABEL).toEqual({
      unauthorized: 'Alegra rechazó el acceso a la foto o su enlace venció',
      not_found: 'La foto ya no existe en Alegra',
      timeout: 'La foto tardó demasiado en descargarse',
      not_image: 'El archivo de la foto no es una imagen',
      unsupported_format: 'Formato de foto no admitido (usa JPG, PNG, WebP o GIF)',
      too_large: 'La foto pesa más de 10 MB',
      unavailable: 'El servidor de la foto no respondió',
    });
  });
});
