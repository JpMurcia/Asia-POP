import { describe, expect, it } from 'vitest';
import { TEXT_EFFECT_DEFAULTS } from '../../backend/src/catalog/template';
import { draftText } from '../../backend/src/catalog/template-presets';
import type { TextEl } from '../../backend/src/catalog/template';
import { bgStyle, shadowCss, withAlpha } from '../src/print/text-effects';

const text = (o: Partial<TextEl> = {}): TextEl => ({ id: 't', ...draftText(o) }) as TextEl;
const palette = { bg: '#FFFFFF', ink: '#111111', a1: '#E91E8C', a2: '#00AAFF', a3: '#FFD400', muted: '#888888' } as never;

describe('withAlpha', () => {
  it('convierte #RRGGBB con su transparencia en porcentaje', () => {
    expect(withAlpha('#FF0000', 50)).toBe('rgba(255,0,0,0.5)');
    expect(withAlpha('#000000', 100)).toBe('rgba(0,0,0,1)');
    expect(withAlpha('#00ff80', 0)).toBe('rgba(0,255,128,0)');
  });
  it('no falla con transparent ni con colores inválidos', () => {
    expect(withAlpha('transparent', 50)).toBe('transparent');
    expect(withAlpha('rojo', 50)).toBe('transparent');
    expect(withAlpha('#12', 50)).toBe('transparent');
  });
  it('acepta #RGB', () => {
    expect(withAlpha('#F00', 50)).toBe('rgba(255,0,0,0.5)');
  });
});

describe('shadowCss', () => {
  it('sin sombra no devuelve nada', () => {
    expect(shadowCss(text(), palette)).toBeUndefined();
    expect(shadowCss(text({ shadow: false }), palette)).toBeUndefined();
  });
  it('ángulo 0 va a la derecha y 90 hacia abajo', () => {
    const right = shadowCss(text({ shadow: true, shDist: 10, shAngle: 0, shBlur: 4, shAlpha: 100, shColor: '#000000' }), palette)!;
    expect(right).toContain('calc(10px * var(--fit, 1)) calc(0px * var(--fit, 1)) calc(4px * var(--fit, 1))');
    const down = shadowCss(text({ shadow: true, shDist: 10, shAngle: 90, shBlur: 4, shAlpha: 100, shColor: '#000000' }), palette)!;
    expect(down).toContain('calc(0px * var(--fit, 1)) calc(10px * var(--fit, 1))');
  });
  it('usa los valores por defecto cuando faltan parámetros y resuelve la paleta', () => {
    const css = shadowCss(text({ shadow: true, shColor: 'a1' }), palette)!;
    expect(css).toContain('rgba(233,30,140');
    expect(css).toContain(`${TEXT_EFFECT_DEFAULTS.shBlur}px`);
  });
});

describe('bgStyle', () => {
  it('sin fondo no devuelve nada', () => {
    expect(bgStyle(text(), palette)).toBeUndefined();
  });
  it('arma color, relleno, esquinas y repetición del fondo por línea', () => {
    const s = bgStyle(text({ bg: true, bgColor: '#102030', bgAlpha: 50, bgPad: 6, bgRadius: 3 }), palette)!;
    expect(s.backgroundColor).toBe('rgba(16,32,48,0.5)');
    expect(s.padding).toBe('0 calc(6px * var(--fit, 1))');
    expect(s.borderRadius).toBe('calc(3px * var(--fit, 1))');
    expect(s.boxDecorationBreak).toBe('clone');
  });
  it('usa el color de la paleta y los valores por defecto', () => {
    const s = bgStyle(text({ bg: true }), palette)!;
    expect(s.backgroundColor).toBe('rgba(255,255,255,1)');
  });
});
