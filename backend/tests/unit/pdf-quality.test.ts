import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PDF_QUALITY,
  exceedsTarget,
  formatMegabytes,
  PDF_QUALITIES,
  PDF_QUALITY_OPTIONS,
  PDF_TARGET_BYTES,
} from '../../src/catalog/pdf-quality';

describe('calidad del PDF', () => {
  it('las calidades son Optimizada y Original, y Optimizada viene preseleccionada (FR-002)', () => {
    expect([...PDF_QUALITIES]).toEqual(['optimized', 'original']);
    expect(DEFAULT_PDF_QUALITY).toBe('optimized');
  });

  it('el tamaño objetivo es de 25 MB (FR-003), con 1 MB = 1.048.576 bytes', () => {
    expect(PDF_TARGET_BYTES).toBe(25 * 1024 * 1024);
    expect(PDF_TARGET_BYTES).toBe(26_214_400);
  });

  describe('formatMegabytes', () => {
    it('usa coma decimal, un decimal y la unidad MB', () => {
      expect(formatMegabytes(19_320_118)).toBe('18,4 MB');
      expect(formatMegabytes(32_700_000)).toBe('31,2 MB');
      expect(formatMegabytes(1_048_576)).toBe('1,0 MB');
      expect(formatMegabytes(0)).toBe('0,0 MB');
    });

    it('redondea a un decimal', () => {
      expect(formatMegabytes(163_999_000)).toBe('156,4 MB'); // el PDF real de 004
      expect(formatMegabytes(1_048_576 * 0.05)).toBe('0,1 MB');
    });
  });

  describe('exceedsTarget', () => {
    it('no avisa con exactamente el objetivo ni por debajo', () => {
      expect(exceedsTarget(0)).toBe(false);
      expect(exceedsTarget(PDF_TARGET_BYTES)).toBe(false);
    });

    it('avisa apenas lo supera', () => {
      expect(exceedsTarget(PDF_TARGET_BYTES + 1)).toBe(true);
      expect(exceedsTarget(156 * 1024 * 1024)).toBe(true);
    });
  });

  describe('opciones de la pantalla (contracts/generate-ui.md §1)', () => {
    it('cada calidad tiene etiqueta y ayuda en español', () => {
      expect(PDF_QUALITY_OPTIONS.optimized.label).toBe('Optimizada');
      expect(PDF_QUALITY_OPTIONS.original.label).toBe('Original');
      for (const q of PDF_QUALITIES) {
        expect(PDF_QUALITY_OPTIONS[q].hint.length).toBeGreaterThan(20);
      }
    });

    it('solo Optimizada es la recomendada', () => {
      expect(PDF_QUALITY_OPTIONS.optimized.recommended).toBe(true);
      expect(PDF_QUALITY_OPTIONS.original.recommended).toBeFalsy();
    });

    it('los textos coinciden con el contrato', () => {
      expect(PDF_QUALITY_OPTIONS.optimized.hint).toBe(
        'Archivo mucho más liviano, ideal para enviar por correo o mensajería. Las fotos se ven igual a tamaño normal.',
      );
      expect(PDF_QUALITY_OPTIONS.original.hint).toBe(
        'Conserva las fotos tal como están en Alegra. El archivo puede ser varias veces más grande.',
      );
      expect(PDF_QUALITY_OPTIONS.original.hint).toContain('puede ser varias veces más grande');
    });

    it('no usan jerga técnica', () => {
      for (const q of PDF_QUALITIES) {
        const text = `${PDF_QUALITY_OPTIONS[q].label} ${PDF_QUALITY_OPTIONS[q].hint}`;
        expect(text).not.toMatch(/ppp|jpeg|jpg|png|compresi[oó]n|pixel|resoluci[oó]n/i);
      }
    });
  });
});
