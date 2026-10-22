import { describe, expect, it } from 'vitest';
import { baseTemplate, draftShape, draftText } from '../../backend/src/catalog/template-presets';
import type { PageElement, Template } from '../../backend/src/catalog/template';
import { BASIC_COLORS, colorOptions, foldText, hexOf, normalizeHex, searchColors, usedColors } from '../src/pages/TemplateEditor/template-colors';
import { fontChoices, searchFonts, usedFonts } from '../src/pages/TemplateEditor/template-fonts';

/** Feature 009: cálculos puros del selector de color y de fuente. */
function withEls(page: 'portada' | 'productos', els: PageElement[]): Template {
  const t = structuredClone(baseTemplate('neon'));
  for (const key of Object.keys(t.pages) as (keyof Template['pages'])[]) t.pages[key].els = [];
  t.pages[page].els = els;
  return t;
}
const el = (e: object, id: string): PageElement => ({ ...e, id }) as PageElement;

describe('normalizeHex', () => {
  it.each([
    ['e91e8c', '#E91E8C'],
    ['#E91E8C', '#E91E8C'],
    ['#e91e8c', '#E91E8C'],
    ['#e91', '#EE9911'],
    ['E91', '#EE9911'],
    ['  #abc  ', '#AABBCC'],
  ])('«%s» ⇒ %s', (typed, hex) => {
    expect(normalizeHex(typed)).toBe(hex);
  });

  it.each(['#12', 'zzz', '', '#12345', '#1234567', '##abc', 'rojo'])('«%s» no es un código válido', (typed) => {
    expect(normalizeHex(typed)).toBeNull();
  });
});

describe('foldText', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(foldText('Ámbar')).toBe('ambar');
    expect(foldText('  ACENTO 2 ')).toBe('acento 2');
  });
});

describe('usedColors', () => {
  it('reúne los libres de cualquier página, sin repetir y con #abc ≡ #AABBCC, en orden de primer uso', () => {
    const t = withEls('portada', [
      el(draftText({ color: '#abc' }), 'a'),
      el(draftText({ color: '#11AA22' }), 'b'),
      el(draftShape({ fill: '#AABBCC' }), 'c'),
    ]);
    t.pages.productos.els = [el(draftText({ stroke: '#11aa22' }), 'd'), el(draftText({ glow: '#334455' }), 'e')];
    expect(usedColors(t)).toEqual(['#AABBCC', '#11AA22', '#334455']);
  });

  it('cuenta también el fondo de la página', () => {
    const t = withEls('portada', []);
    t.pages.portada.bg = { ...t.pages.portada.bg, color: '#778899' } as never;
    expect(usedColors(t)).toContain('#778899');
  });

  it('un libre igual a un color de la paleta no cuenta como libre (se muestra como el de la paleta)', () => {
    const neon = baseTemplate('neon');
    const t = withEls('portada', [el(draftText({ color: neon.palette.a1 }), 'a')]);
    expect(usedColors(t)).toEqual([]);
  });

  it('un texto libre que contiene un código no se cuenta; las claves de paleta tampoco', () => {
    const t = withEls('portada', [el(draftText({ text: '#E91E8C', color: 'a2' }), 'a')]);
    expect(usedColors(t)).toEqual([]);
  });

  it('una plantilla sin libres muestra solo los seis de la paleta', () => {
    const t = withEls('portada', [el(draftText({ color: 'a1' }), 'a')]);
    t.pages.portada.bg = { ...t.pages.portada.bg, color: 'paper' } as never;
    expect(usedColors(t)).toEqual([]);
    expect(colorOptions(t).filter((o) => o.group === 'plantilla')).toHaveLength(6);
  });
});

describe('colorOptions y searchColors', () => {
  const t = withEls('portada', [el(draftText({ color: '#445566' }), 'a')]);

  it('ordena la paleta, los libres, los básicos y la opción especial', () => {
    const o = colorOptions(t, { none: 'none' });
    expect(o.slice(0, 6).map((x) => x.value)).toEqual(['bg', 'a1', 'a2', 'a3', 'ink', 'paper']);
    expect(o[6]).toMatchObject({ value: '#445566', group: 'plantilla' });
    expect(o.filter((x) => x.group === 'basico')).toHaveLength(BASIC_COLORS.length);
    expect(o.at(-1)).toMatchObject({ value: 'none', label: 'Ninguno', group: 'especial' });
    expect(colorOptions(t, { none: 'transparent' }).at(-1)!.label).toBe('Transparente');
    expect(colorOptions(t).some((x) => x.group === 'especial')).toBe(false);
  });

  it('busca por nombre sin importar mayúsculas ni tildes, y no incluye la opción especial', () => {
    const o = colorOptions(t, { none: 'none' });
    expect(searchColors(o, 'ACENTO').map((x) => x.label)).toEqual(['Acento 1', 'Acento 2', 'Acento 3']);
    expect(searchColors(o, 'azul').map((x) => x.label)).toEqual(['Azul']);
    expect(searchColors(o, 'ningun')).toEqual([]);
    expect(searchColors(o, 'zzz')).toEqual([]);
    expect(searchColors(o, '')).toHaveLength(o.length);
  });

  it('una búsqueda por código encuentra el color de esa muestra', () => {
    expect(searchColors(colorOptions(t), '#445566').map((x) => x.value)).toContain('#445566');
  });
});

describe('hexOf', () => {
  it('resuelve claves de la paleta y códigos al mismo formato', () => {
    const neon = baseTemplate('neon');
    expect(hexOf(neon, 'a1')).toBe(neon.palette.a1.toUpperCase());
    expect(hexOf(neon, '#abc')).toBe('#AABBCC');
    expect(hexOf(neon, 'none')).toBeNull();
    expect(hexOf(neon, 5)).toBeNull();
  });
});

describe('fuentes de la plantilla', () => {
  it('reúne las familias usadas por textos e insignias sin repetir', () => {
    const t = withEls('portada', [el(draftText({ font: 'bungee' }), 'a'), el(draftText({ font: 'bungee' }), 'b'), el(draftText({ font: 'title' }), 'c'), el(draftText({ font: 'serif' }), 'd')]);
    expect(usedFonts(t)).toEqual(['bungee', 'serif']);
  });

  it('ofrece primero Título, Cuerpo y las usadas, y después las seis', () => {
    const t = withEls('portada', [el(draftText({ font: 'bungee' }), 'a')]);
    const o = fontChoices(t);
    expect(o.slice(0, 2).map((x) => x.value)).toEqual(['title', 'body']);
    expect(o[0]!.label).toMatch(/^Título · /);
    expect(o[1]!.label).toMatch(/^Cuerpo · /);
    expect(o.filter((x) => x.group === 'todas').map((x) => x.value)).toEqual(['fredoka', 'poppins', 'bungee', 'zen', 'grotesk', 'serif']);
    expect(o.some((x) => x.group === 'plantilla' && x.value === 'bungee')).toBe(true);
  });

  it('busca por nombre sin importar mayúsculas ni tildes', () => {
    const o = fontChoices(withEls('portada', []));
    expect(searchFonts(o, 'ZEN').map((x) => x.value)).toEqual(['zen']);
    expect(searchFonts(o, 'dm').map((x) => x.value)).toContain('serif');
    expect(searchFonts(o, 'titulo').map((x) => x.value)).toEqual(['title']);
    expect(searchFonts(o, 'zzz')).toEqual([]);
  });
});
