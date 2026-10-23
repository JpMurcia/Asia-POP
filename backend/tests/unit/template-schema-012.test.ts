import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import { RANGES, TEXT_EFFECT_DEFAULTS, type TextEl, type Template } from '../../src/catalog/template';

/** Feature 012: formato y efectos de texto estilo Canva. */
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
  italic: true,
  underline: true,
  list: 'number',
  bright: true,
  echo: true,
  misalign: true,
  glitch: true,
  hollow: true,
  fxColor: '#112233',
  fxColor2: 'a3',
  fxDist: 12,
  fxI: 80,
  curve: -40,
};

describe('esquema de plantilla: texto estilo Canva (feature 012)', () => {
  it('una plantilla sin los campos es válida y se lee sin ellos', () => {
    const r = check(baseTemplate('pop'));
    expect(r.success).toBe(true);
    if (r.success) for (const el of r.data.templates[0]!.pages.portada.els) expect('italic' in el || 'list' in el || 'curve' in el).toBe(false);
  });

  it('los campos nuevos sobreviven a validar (no los descarta zod)', () => {
    const r = check(withText(ALL));
    expect(r.success).toBe(true);
    if (r.success) expect(firstText(r.data.templates[0]!)).toMatchObject({ ...ALL, fxColor: '#112233' });
  });

  it('acepta la alineación justificada', () => {
    const r = check(withText({ align: 'justify' }));
    expect(r.success).toBe(true);
    if (r.success) expect(firstText(r.data.templates[0]!).align).toBe('justify');
  });

  it.each(['none', 'bullet', 'number'])('acepta la lista %s', (list) => {
    expect(check(withText({ list })).success).toBe(true);
  });
  it('rechaza una lista desconocida', () => {
    expect(messages(withText({ list: 'romana' })).join('\n')).toMatch(/lista/i);
  });

  it.each([
    ['fxDist', 41, /distancia del efecto/i],
    ['fxI', -1, /intensidad del efecto/i],
    ['curve', 150, /curvatura/i],
    ['curve', -101, /curvatura/i],
  ])('%s = %s se rechaza con su mensaje', (key, value, msg) => {
    expect(messages(withText({ [key]: value })).join('\n')).toMatch(msg);
  });

  it.each(['fxColor', 'fxColor2'])('%s inválido se rechaza', (key) => {
    expect(check(withText({ [key]: 'rojo' })).success).toBe(false);
  });

  it.each(['italic', 'underline', 'bright', 'echo', 'misalign', 'glitch', 'hollow'])('%s debe ser booleano', (key) => {
    expect(check(withText({ [key]: 'si' })).success).toBe(false);
  });

  it('los extremos del rango son válidos', () => {
    expect(check(withText({ curve: 100, fxDist: 0, fxI: 100 })).success).toBe(true);
    expect(check(withText({ curve: -100, fxDist: 40, fxI: 0 })).success).toBe(true);
  });

  it('los valores por defecto caen dentro de sus rangos', () => {
    const d = TEXT_EFFECT_DEFAULTS;
    expect(d.fxDist).toBeGreaterThanOrEqual(RANGES.fxDist[0]);
    expect(d.fxDist).toBeLessThanOrEqual(RANGES.fxDist[1]);
    expect(d.fxI).toBeGreaterThanOrEqual(RANGES.fxI[0]);
    expect(d.fxI).toBeLessThanOrEqual(RANGES.fxI[1]);
  });
});
