import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import { RANGES, TEXT_DEFAULTS, type TextEl, type Template } from '../../src/catalog/template';

/** Feature 008: rangos ampliados de altura de línea y espaciado, y el anclaje vertical opcional de los textos. */
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

describe('esquema de plantilla: ajustes avanzados de texto (feature 008)', () => {
  it('los rangos nuevos contienen por completo a los anteriores', () => {
    expect(RANGES.lh).toEqual([0.5, 2.5]);
    expect(RANGES.ls).toEqual([-10, 60]);
    expect(RANGES.lh[0]).toBeLessThanOrEqual(0.8);
    expect(RANGES.ls[0]).toBeLessThanOrEqual(-2);
    expect(RANGES.ls[1]).toBeGreaterThanOrEqual(12);
  });

  it.each([0.5, 1.37, 2.5])('la altura de línea %s es válida', (lh) => {
    expect(check(withText({ lh })).success).toBe(true);
  });
  it.each([0.4, 9])('la altura de línea %s se rechaza con el mensaje de rango', (lh) => {
    expect(messages(withText({ lh })).join('\n')).toMatch(/altura de línea/i);
  });

  it.each([-10, 0, 33.3, 60])('el espaciado %s es válido', (ls) => {
    expect(check(withText({ ls })).success).toBe(true);
  });
  it.each([-11, 61])('el espaciado %s se rechaza con el mensaje de rango', (ls) => {
    expect(messages(withText({ ls })).join('\n')).toMatch(/espaciado/i);
  });

  it.each(['top', 'middle', 'bottom'] as const)('acepta y conserva el anclaje %s', (vAlign) => {
    const r = check(withText({ vAlign }));
    expect(r.success).toBe(true);
    if (r.success) expect(firstText(r.data.templates[0]!).vAlign).toBe(vAlign);
  });

  it('rechaza un anclaje que no es uno de los tres', () => {
    expect(messages(withText({ vAlign: 'centro' })).join('\n')).toMatch(/alineación vertical/i);
  });

  it('una plantilla sin anclaje es válida y se lee sin el campo', () => {
    const r = check(baseTemplate('pop'));
    expect(r.success).toBe(true);
    if (r.success) for (const el of r.data.templates[0]!.pages.portada.els) expect('vAlign' in el).toBe(false);
    expect(TEXT_DEFAULTS.vAlign).toBe('middle');
  });

  it('los valores de antes (0,8; −2; 12; 3; 0,4) siguen siendo válidos', () => {
    expect(check(withText({ lh: 0.8 })).success).toBe(true);
    expect(check(withText({ ls: -2 })).success).toBe(true);
    expect(check(withText({ ls: 12 })).success).toBe(true);
    for (const id of ['neon', 'pop', 'kawaii', 'kraft', 'base'] as const) expect(check(baseTemplate(id)).success).toBe(true);
  });
});
