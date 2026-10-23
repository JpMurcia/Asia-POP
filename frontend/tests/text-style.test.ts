import { describe, expect, it } from 'vitest';
import type { TextEl } from '../../backend/src/catalog/template';
import { draftText } from '../../backend/src/catalog/template-presets';
import { STYLE_KEYS, pickStyle, styleToPatch } from '../src/pages/TemplateEditor/text-style';

const text = (o: Partial<TextEl> = {}): TextEl => ({ id: 't', ...draftText(o) }) as TextEl;

describe('copiar estilo: qué viaja', () => {
  it('nunca copia el contenido, la posición, el tamaño de la caja ni el nombre', () => {
    const style = pickStyle(text({ name: 'Mi texto', text: 'Hola', x: 3, y: 4, w: 50, h: 9, rot: 10, opacity: 0.5 }));
    for (const k of ['id', 'name', 'text', 'x', 'y', 'w', 'h', 'rot', 'opacity', 'visible', 'locked']) expect(style).not.toHaveProperty(k);
    for (const k of STYLE_KEYS) expect(['id', 'name', 'text', 'x', 'y', 'w', 'h', 'rot', 'opacity', 'visible', 'locked']).not.toContain(k);
  });

  it('copia fuente, tamaño, peso, color, alineación y los efectos activos', () => {
    const style = pickStyle(text({ font: 'bungee', size: 22, weight: 900, color: 'a2', align: 'left', italic: true, underline: true, shadow: true, glitch: true, curve: 40 }));
    expect(style).toMatchObject({ font: 'bungee', size: 22, weight: 900, color: 'a2', align: 'left', italic: true, underline: true, shadow: true, glitch: true, curve: 40 });
  });

  it('solo lleva las claves presentes', () => {
    expect(pickStyle(text())).not.toHaveProperty('italic');
  });
});

describe('copiar estilo: qué se pega', () => {
  it('el parche borra lo opcional que el origen no trae (el resultado es el original, no una mezcla)', () => {
    const patch = styleToPatch(pickStyle(text({ size: 30 })));
    expect(patch.size).toBe(30);
    expect(Object.keys(patch)).toContain('italic');
    expect(patch.italic).toBeUndefined();
  });
});
