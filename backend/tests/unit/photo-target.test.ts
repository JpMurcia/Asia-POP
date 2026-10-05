import { describe, expect, it } from 'vitest';
import { BASE_TEMPLATES, baseTemplate } from '../../src/catalog/template-presets';
import type { ProductsEl, Template } from '../../src/catalog/template';
import { PDF_PPP, photoTarget } from '../../src/pdf/photo-target';

const productsBlock = (t: Template): ProductsEl => t.pages.productos.els.find((e): e is ProductsEl => e.type === 'products')!;

describe('resolución objetivo de las fotos (FR-004)', () => {
  it('se calcula a 150 puntos por pulgada', () => {
    expect(PDF_PPP).toBe(150);
  });

  // Valores calculados con el código real (research §4): píxeles = ceil(unidades × 150 / 72) sobre el mayor recuadro
  // de foto de `layoutRows`; la página lógica mide 595,28 unidades = 210 mm, o sea 1 unidad = 1/72 de pulgada
  it.each([
    ['neon', { w: 360, h: 474 }],
    ['pop', { w: 331, h: 445 }],
    ['kawaii', { w: 350, h: 403 }],
    ['kraft', { w: 309, h: 309 }],
  ] as const)('en la plantilla base %s pide %o', (id, expected) => {
    expect(photoTarget(baseTemplate(id))).toEqual(expected);
  });

  it('cubre las cuatro plantillas base', () => {
    expect(BASE_TEMPLATES.map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'kraft']);
  });

  it('con el bloque de productos agrandado a toda la página pide más píxeles (no usa un tamaño fijo)', () => {
    const t = structuredClone(baseTemplate('neon'));
    const block = productsBlock(t);
    block.w = 100;
    block.h = 100;
    expect(photoTarget(t)).toEqual({ w: 360, h: 556 });
  });

  it('con varios bloques de productos toma el mayor ancho y el mayor alto de todos', () => {
    const t = structuredClone(baseTemplate('neon'));
    // Un segundo bloque de tarjetas a página completa: 182,6 × 209,9 unidades ⇒ 381 × 438 px; el alto de Neón Noche (474) sigue siendo mayor
    t.pages.productos.els.push({
      ...structuredClone(productsBlock(t)),
      id: 'segundo',
      layout: 'tarjetas',
      x: 0,
      y: 0,
      w: 100,
      h: 100,
    });
    expect(photoTarget(t)).toEqual({ w: 381, h: 474 });
  });

  it('ignora los bloques de productos que no son visibles', () => {
    const t = structuredClone(baseTemplate('neon'));
    t.pages.productos.els.push({
      ...structuredClone(productsBlock(t)),
      id: 'oculto',
      layout: 'tarjetas',
      w: 100,
      h: 100,
      visible: false,
    });
    expect(photoTarget(t)).toEqual({ w: 360, h: 474 });
  });

  it('sin ningún bloque de productos visible no hay nada que reducir', () => {
    const t = structuredClone(baseTemplate('neon'));
    t.pages.productos.els = t.pages.productos.els.filter((e) => e.type !== 'products');
    expect(photoTarget(t)).toBeNull();

    const hidden = structuredClone(baseTemplate('neon'));
    productsBlock(hidden).visible = false;
    expect(photoTarget(hidden)).toBeNull();
  });

  it('no muta la plantilla recibida', () => {
    const t = structuredClone(baseTemplate('kawaii'));
    const before = structuredClone(t);
    photoTarget(t);
    expect(t).toEqual(before);
  });
});
