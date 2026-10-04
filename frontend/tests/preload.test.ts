import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../backend/src/catalog/template-presets';
import { IMAGES } from '../src/print/assets';
import { templateAssetRequests } from '../src/print/preload';

describe('templateAssetRequests', () => {
  it('pide las tipografías con el peso que existe de cada familia', () => {
    const { fonts } = templateAssetRequests(baseTemplate('neon'));
    // título Fredoka 700 (nombre de sección) y cuerpo Poppins en los pesos del texto y de los bloques
    expect(fonts).toContain('700 16px "Fredoka"');
    expect(fonts).toEqual(expect.arrayContaining(['500 16px "Poppins"', '600 16px "Poppins"', '700 16px "Poppins"']));
  });

  it('mapea un peso que la familia no tiene al más cercano', () => {
    const { fonts } = templateAssetRequests(baseTemplate('kraft')); // título DM Serif Display (solo 400), cuerpo Space Grotesk
    expect(fonts).toContain('400 16px "DM Serif Display"');
    expect(fonts.some((f) => f.includes('"DM Serif Display"') && !f.startsWith('400'))).toBe(false);
    expect(fonts).toContain('500 16px "Space Grotesk"');
    expect(fonts).toContain('700 16px "Space Grotesk"');
  });

  it('pide las imágenes de fondo y de elementos que usa la plantilla, sin repetir', () => {
    const { images } = templateAssetRequests(baseTemplate('neon'));
    expect([...images].sort()).toEqual([IMAGES.collage, IMAGES.coverbg, IMAGES.frame, IMAGES.logo, IMAGES.marble].sort());
    expect(new Set(images).size).toBe(images.length);
  });

  it('una plantilla sin imágenes no pide ninguna', () => {
    const t = baseTemplate('kraft');
    for (const page of Object.values(t.pages)) {
      page.els = page.els.filter((e) => e.type !== 'image');
      page.bg = { ...page.bg, type: 'color' };
    }
    expect(templateAssetRequests(t).images).toEqual([]);
  });

  it('cada familia usada en un elemento se pide aunque no sea la de título o cuerpo', () => {
    const t = baseTemplate('neon');
    t.pages.portada.els.push({ ...(t.pages.portada.els.find((e) => e.type === 'text')!), id: 'x', font: 'bungee' } as never);
    expect(templateAssetRequests(t).fonts).toContain('400 16px "Bungee"');
  });
});
