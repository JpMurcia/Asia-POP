import { describe, expect, it } from 'vitest';
import { BASE_TEMPLATES, baseTemplate, normalizeProductsBlocks } from '../../src/catalog/template-presets';
import type { ProductsEl, Template } from '../../src/catalog/template';

/** Feature 010: `normalizeProductsBlocks` completa los campos nuevos con el comportamiento de antes. */
const NEW_KEYS = ['cardStyle', 'priceGlow', 'soldGlow', 'bubbleShadow', 'descLh'] as const;
const blockOf = (t: Template): ProductsEl => t.pages.productos.els.find((e) => e.type === 'products') as ProductsEl;
/** Una plantilla guardada antes de la feature: sin ninguno de los campos nuevos. */
function legacy(id: 'neon' | 'pop' | 'kawaii' | 'kraft'): Template {
  const t = baseTemplate(id);
  for (const k of NEW_KEYS) delete (blockOf(t) as unknown as Record<string, unknown>)[k];
  return t;
}

describe('normalizeProductsBlocks: campos de la feature 010', () => {
  it.each(['neon', 'pop', 'kawaii', 'kraft'] as const)('%s: completa con el valor de antes y deja descLh ausente', (id) => {
    const block = blockOf(normalizeProductsBlocks(legacy(id)));
    expect(block).toMatchObject({ cardStyle: 'plana', priceGlow: false, soldGlow: false, bubbleShadow: false });
    expect('descLh' in block).toBe(false);
  });

  it('es idempotente y no pisa lo que ya está', () => {
    const t = legacy('pop');
    Object.assign(blockOf(t), { cardStyle: 'tarjeta', priceGlow: true, descLh: 1.4 });
    const once = normalizeProductsBlocks(t);
    expect(blockOf(once)).toMatchObject({ cardStyle: 'tarjeta', priceGlow: true, descLh: 1.4, soldGlow: false });
    expect(normalizeProductsBlocks(once)).toEqual(once);
  });

  it('las plantillas de fábrica ya traen los valores de antes, así que normalizarlas no las cambia', () => {
    for (const t of BASE_TEMPLATES) expect(normalizeProductsBlocks(t)).toEqual(t);
  });

  it('no modifica la plantilla recibida', () => {
    const t = legacy('kraft');
    normalizeProductsBlocks(t);
    expect('cardStyle' in blockOf(t)).toBe(false);
  });
});
