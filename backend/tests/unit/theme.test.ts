import { describe, expect, it } from 'vitest';
import { contrastRatio, isHexColor } from '../../src/catalog/theme';

describe('theme', () => {
  describe('isHexColor', () => {
    it.each(['#11052C', '#ffffff', '#00ff66', '#AbCdEf'])('acepta %s', (c) => {
      expect(isHexColor(c)).toBe(true);
    });
    it.each(['#FFF', '#12345', '#1234567', 'rosa', '11052C', '#12G456', '#11052C80', '', 'rgb(1,2,3)'])(
      'rechaza %s',
      (c) => {
        expect(isHexColor(c)).toBe(false);
      },
    );
    it('rechaza valores que no son texto', () => {
      expect(isHexColor(undefined)).toBe(false);
      expect(isHexColor(123 as unknown)).toBe(false);
    });
  });

  describe('contrastRatio', () => {
    it('negro sobre blanco es 21', () => {
      expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    });
    it('es simétrico y 1 entre iguales', () => {
      expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
      expect(contrastRatio('#FF007A', '#FF007A')).toBeCloseTo(1, 5);
    });
    it('valores de la paleta de Neón Noche', () => {
      expect(contrastRatio('#FFFFFF', '#11052C')).toBeCloseTo(19.4, 0);
      expect(contrastRatio('#FF007A', '#11052C')).toBeCloseTo(5.1, 0);
      expect(contrastRatio('#00FF66', '#11052C')).toBeCloseTo(14.3, 0);
      expect(contrastRatio('#FF9900', '#11052C')).toBeCloseTo(9.1, 0);
    });
  });
});
