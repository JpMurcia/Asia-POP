import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SoldOutStyle } from '../../src/catalog/template';
import { baseTemplate } from '../../src/catalog/template-presets';
import { PNG, copyOf, startHarness, type Harness } from '../fixtures/pdf-harness';

/**
 * Principio II y SC-009: los tres estilos de agotado (sello, cinta y gris) muestran la palabra AGOTADO en el PDF,
 * solo en los productos agotados según las reglas de 001 y nunca en un producto propio. `pdf-parse` lee el texto
 * real del PDF, así que el sello (imagen) debe llevar además su etiqueta de texto invisible.
 */

const STYLES: SoldOutStyle[] = ['sello', 'cinta', 'gris'];
let h: Harness;

beforeAll(async () => {
  h = await startHarness({
    categories: [{ id: 'c1', name: 'RAMEN' }],
    items: (url) => [
      {
        id: '1',
        name: 'Fideos disponibles',
        description: 'Siempre hay',
        status: 'active',
        price: 9000,
        category: { id: 'c1', name: 'RAMEN' },
        images: [`${url}/img/ok.png`],
      },
      {
        id: '2',
        name: 'Fideos agotados',
        description: 'Se acabaron',
        status: 'active',
        price: 9000,
        category: { id: 'c1', name: 'RAMEN' },
        images: [`${url}/img/ok.png`],
        inventory: { availableQuantity: 0, trackInventory: true },
      },
    ],
    seed: async (agent) => {
      const section = (await agent.post('/api/sections/custom').send({ name: 'MOCHIS' }).expect(201)).body;
      const product = (
        await agent.post('/api/custom-products').send({ sectionId: section.id, name: 'Caja de mochis', description: 'Rellenos de crema', price: 30000 }).expect(201)
      ).body;
      await agent.put(`/api/custom-products/${product.id}/image`).attach('image', PNG, 'p.png').expect(200);
    },
  });
  // Una plantilla por estilo de agotado, partiendo de Neón Noche
  await h.save((ws) => ({
    templates: [
      ...ws.templates,
      ...STYLES.map((sold) => {
        const t = copyOf(baseTemplate('neon'), `t${sold}`, `Agotado ${sold}`);
        t.pages.productos.els = t.pages.productos.els.map((e) => (e.type === 'products' ? { ...e, sold } : e));
        return t;
      }),
    ],
  }));
}, 180_000);

afterAll(async () => {
  await h?.close();
});

describe.each(STYLES)('estilo de agotado: %s', (style) => {
  it('muestra AGOTADO junto al producto agotado de Alegra y no en los demás', async () => {
    const r = await h.generate({ prepare: { templateId: `t${style}`, sectionKeys: ['alegra:c1'] } });
    expect(r.payload.template.id).toBe(`t${style}`);
    const page = r.pageTexts.find((t) => t.includes('Se acabaron'))!;
    expect(page, 'página del producto agotado').toBeDefined();
    expect(page).toContain('AGOTADO');
    // el producto disponible está en la misma página y no lleva la indicación: solo aparece una vez
    expect(page).toContain('Siempre hay');
    expect(page.match(/AGOTADO/g)).toHaveLength(1);
  }, 120_000);

  it('nunca lo muestra en un producto propio', async () => {
    const own = (await h.sections()).find((s) => s.source === 'custom')!.key;
    const r = await h.generate({ prepare: { templateId: `t${style}`, sectionKeys: [own] } });
    const page = r.pageTexts.find((t) => t.includes('Caja de mochis'))!;
    expect(page, 'página del producto propio').toBeDefined();
    expect(page).not.toContain('AGOTADO');
    expect(r.text).not.toContain('AGOTADO');
  }, 120_000);
});

describe('sin agotados', () => {
  it('con "ocultar agotados" el PDF no contiene la palabra AGOTADO con ningún estilo', async () => {
    for (const style of STYLES) {
      const r = await h.generate({ prepare: { templateId: `t${style}`, hideSoldOut: true } });
      expect(r.text, style).not.toContain('AGOTADO');
    }
  }, 240_000);
});
