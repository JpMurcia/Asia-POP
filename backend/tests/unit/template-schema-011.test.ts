import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import { RANGES, TEXT_EFFECT_DEFAULTS, type TextEl, type Template } from '../../src/catalog/template';

/** Feature 011: sombra y fondo opcionales del texto. */
function withText(over: Record<string, unknown>): Template {
  const t = baseTemplate('neon');
  const i = t.pages.portada.els.findIndex((e) => e.type === 'text');
  t.pages.portada.els = t.pages.portada.els.map((el, k) => (k === i ? ({ ...el, ...over } as TextEl) : el));
  return t;
}
const check = (t: Template) => workspaceSchema.safeParse({ templates: [t], defaultId: t.id });
const messages = (t: Template): string[] => {
  const r = check(t);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};
const firstText = (t: Template): TextEl => t.pages.portada.els.find((e) => e.type === 'text') as TextEl;

const ALL = {
  shadow: true,
  shDist: 12,
  shAngle: -90,
  shBlur: 20,
  shAlpha: 80,
  shColor: '#112233',
  bg: true,
  bgRadius: 14,
  bgPad: 10,
  bgAlpha: 70,
  bgColor: 'a1',
};

describe('esquema de plantilla: sombra y fondo del texto (feature 011)', () => {
  it('una plantilla sin los campos es válida y se lee sin ellos', () => {
    const r = check(baseTemplate('pop'));
    expect(r.success).toBe(true);
    if (r.success) for (const el of r.data.templates[0]!.pages.portada.els) expect('shadow' in el || 'bg' in el).toBe(false);
  });

  it('los once campos sobreviven a validar (no los descarta zod)', () => {
    const r = check(withText(ALL));
    expect(r.success).toBe(true);
    if (r.success) expect(firstText(r.data.templates[0]!)).toMatchObject(ALL);
  });

  it.each([
    ['shDist', 51, /distancia de la sombra/i],
    ['shAngle', 200, /dirección de la sombra/i],
    ['shBlur', 99, /desenfoque de la sombra/i],
    ['shAlpha', 101, /transparencia de la sombra/i],
    ['bgRadius', -1, /redondez del fondo/i],
    ['bgPad', 41, /separación del fondo/i],
    ['bgAlpha', -1, /transparencia del fondo/i],
  ])('%s = %s se rechaza con su mensaje', (key, value, msg) => {
    expect(messages(withText({ [key]: value })).join('\n')).toMatch(msg);
  });

  it.each(['shColor', 'bgColor'])('%s inválido se rechaza', (key) => {
    expect(check(withText({ [key]: 'rojo' })).success).toBe(false);
  });

  it('un parámetro guardado con el interruptor apagado se conserva', () => {
    const r = check(withText({ shadow: false, shBlur: 9, bg: false, bgPad: 5 }));
    expect(r.success).toBe(true);
    if (r.success) expect(firstText(r.data.templates[0]!)).toMatchObject({ shadow: false, shBlur: 9, bg: false, bgPad: 5 });
  });

  it('los valores por defecto caen dentro de sus rangos', () => {
    const d = TEXT_EFFECT_DEFAULTS;
    const inside = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
    expect(inside(d.shDist, RANGES.shDist)).toBe(true);
    expect(inside(d.shAngle, RANGES.shAngle)).toBe(true);
    expect(inside(d.shBlur, RANGES.shBlur)).toBe(true);
    expect(inside(d.shAlpha, RANGES.alpha)).toBe(true);
    expect(inside(d.bgRadius, RANGES.bgRadius)).toBe(true);
    expect(inside(d.bgPad, RANGES.bgPad)).toBe(true);
    expect(inside(d.bgAlpha, RANGES.alpha)).toBe(true);
  });
});
