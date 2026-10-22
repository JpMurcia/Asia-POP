import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../src/catalog/template-presets';
import { workspaceSchema } from '../../src/catalog/template.schema';
import type { ImageEl, ProductsEl, Template } from '../../src/catalog/template';

/** Feature 010: los valores nuevos del modelo se aceptan y los inválidos se rechazan con la ruta del campo. */
function withProducts(over: Record<string, unknown>): Template {
  const t = baseTemplate('neon');
  t.pages.productos.els = t.pages.productos.els.map((el) => (el.type === 'products' ? ({ ...el, ...over } as ProductsEl) : el));
  return t;
}
function withImage(src: string): Template {
  const t = baseTemplate('neon');
  const image = { id: 'img', type: 'image', x: 5, y: 5, w: 20, h: 20, rot: 0, opacity: 1, visible: true, locked: false, src, fit: 'contain', radius: 0 };
  t.pages.portada.els = [...t.pages.portada.els, image as unknown as ImageEl];
  return t;
}
const check = (t: Template) => workspaceSchema.safeParse({ templates: [t], defaultId: t.id });
const paths = (t: Template): string[] => {
  const r = check(t);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};
const productsIndex = (): number => baseTemplate('neon').pages.productos.els.findIndex((e) => e.type === 'products');

describe('esquema de plantilla: campos de la feature 010', () => {
  it('acepta la distribución base, el nombre en tarjeta y el agotado diagonal', () => {
    expect(check(withProducts({ layout: 'base', nameStyle: 'tarjeta', sold: 'diagonal' })).success).toBe(true);
  });

  it('acepta los campos opcionales nuevos y los conserva (z.object no descarta lo declarado)', () => {
    const r = check(withProducts({ cardStyle: 'tarjeta', priceGlow: true, soldGlow: true, bubbleShadow: true, descLh: 1.4 }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    const block = r.data.templates[0]!.pages.productos.els.find((e) => e.type === 'products') as ProductsEl;
    expect(block).toMatchObject({ cardStyle: 'tarjeta', priceGlow: true, soldGlow: true, bubbleShadow: true, descLh: 1.4 });
  });

  it('una plantilla sin los campos nuevos sigue siendo válida', () => {
    expect(check(baseTemplate('pop')).success).toBe(true);
  });

  it.each([
    ['cardStyle', 'mosaico'],
    ['priceGlow', 'si'],
    ['soldGlow', 1],
    ['bubbleShadow', 'no'],
    ['descLh', 0.5],
    ['descLh', 2.6],
  ])('rechaza %s = %s', (key, value) => {
    expect(paths(withProducts({ [key]: value }))).toContain(`templates.0.pages.productos.els.${productsIndex()}.${key}`);
  });

  it('acepta las imágenes fijas nuevas y las subidas con nombre seguro', () => {
    for (const src of ['sparkle', 'chat', 'upload:tpl-ab12.png', 'upload:tpl_logo-1.JPG']) {
      expect(check(withImage(src)).success, src).toBe(true);
    }
  });

  it.each(['upload:../secreto.png', 'upload:a/b.png', 'upload:a\\b.png', 'upload:', 'upload:..', 'upload:a b.png', 'http://x/y.png', 'desconocida'])(
    'rechaza la imagen %s',
    (src) => {
      expect(check(withImage(src)).success).toBe(false);
    },
  );
});
