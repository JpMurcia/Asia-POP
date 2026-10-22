import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tokensFrom, type ProductsEl, type Template } from '../../backend/src/catalog/template';
import { baseTemplate } from '../../backend/src/catalog/template-presets';
import type { CatalogItem } from '../../backend/src/catalog/types';
import TemplatePage from '../src/print/TemplatePage';

/** Feature 010: lo que dibuja la plantilla Base AsianPop en el bloque de productos. */
const tokens = tokensFrom(
  { storeName: 'ASIANPOP MARKET+', phone1: '310 669 0585', phone2: '318 807 0709', address: 'Cra 10', coverTitle: 'Catálogo' },
  'RAMEN',
);
const item = (id: string, over: Partial<CatalogItem> = {}): CatalogItem =>
  ({
    kind: 'alegra',
    id,
    name: `Producto ${id}`,
    description: `Descripción ${id}`,
    priceLabel: '$9.000',
    imageUrl: `/media/cards/${'b'.repeat(40)}.jpg`,
    soldOut: false,
    ...over,
  }) as CatalogItem;

function withProducts(patch: Partial<ProductsEl>, id: 'base' | 'neon' = 'base'): Template {
  const t = baseTemplate(id);
  t.pages.productos.els = t.pages.productos.els.map((e) => (e.type === 'products' ? ({ ...e, ...patch } as ProductsEl) : e));
  return t;
}
const renderPage = (template: Template, items: CatalogItem[]) =>
  render(<TemplatePage template={template} page="productos" tokens={tokens} items={items} />).container;
const card = (c: HTMLElement, i = 0) => c.querySelectorAll<HTMLElement>('[data-testid="product-card"]')[i]!;
const style = (el: Element | null) => (el as HTMLElement).style;

describe('ProductsBlock · plantilla Base AsianPop', () => {
  it('dibuja tres productos en zigzag con la foto-tarjeta, el nombre dentro y la burbuja con la descripción', () => {
    const c = renderPage(baseTemplate('base'), [item('1'), item('2'), item('3')]);
    const rows = [0, 1, 2].map((i) => card(c, i));
    const x = rows.map((r) => parseFloat(style(r.querySelector('[data-part="photo"]')).left));
    expect(x[0]).toBeLessThan(x[1]!);
    expect(x[2]).toBeCloseTo(x[0]!, 3);
    for (const r of rows) {
      expect(r.querySelector('[data-part="card-name"]')).not.toBeNull();
      expect(r.querySelector('[data-part="bubble"] .pb-desc')).not.toBeNull();
      expect(r.querySelector('[data-part="price"]')!.textContent).toBe('$9.000');
    }
  });

  it('la burbuja va detrás de la foto (z-index) y su texto se corre para no quedar bajo la foto', () => {
    const c = renderPage(baseTemplate('base'), [item('1'), item('2')]);
    // fila izquierda: la foto tapa el borde izquierdo de la burbuja ⇒ relleno a la izquierda
    expect(style(card(c, 0).querySelector('[data-part="bubble"]')).paddingLeft).toContain('calc(');
    // fila derecha: la foto tapa el borde derecho ⇒ relleno a la derecha
    expect(style(card(c, 1).querySelector('[data-part="bubble"]')).paddingRight).toContain('calc(');
    expect(c.querySelector('.pb')!.getAttribute('data-layout')).toBe('base');
  });

  it('el AGOTADO diagonal es texto real, por encima de la foto, rojo y con neón', () => {
    const c = renderPage(baseTemplate('base'), [item('1', { soldOut: true }), item('2')]);
    const diag = card(c, 0).querySelector<HTMLElement>('[data-part="photo"] .pb-diag');
    expect(diag).not.toBeNull();
    expect(diag!.textContent).toBe('AGOTADO');
    expect(diag!.style.color).toBe('rgb(255, 49, 49)');
    expect(diag!.style.textShadow.toLowerCase()).toContain('#ff3131');
    expect(card(c, 1).querySelector('.pb-diag')).toBeNull();
    expect(style(card(c, 0).querySelector('[data-part="photo"]')).overflow).toBe('visible');
  });

  it('sin soldGlow la cinta diagonal no lleva resplandor', () => {
    const c = renderPage(withProducts({ soldGlow: false }), [item('1', { soldOut: true })]);
    expect(card(c).querySelector<HTMLElement>('.pb-diag')!.style.textShadow).toBe('');
  });

  it('el precio lleva neón con priceGlow y la burbuja sombra con bubbleShadow', () => {
    const c = renderPage(baseTemplate('base'), [item('1')]);
    expect(style(card(c).querySelector('[data-part="price"]')).textShadow.toLowerCase()).toContain('#c04b0f');
    expect(style(card(c).querySelector('[data-part="bubble"]')).boxShadow).not.toBe('');
    const off = renderPage(withProducts({ priceGlow: false, bubbleShadow: false }), [item('1')]);
    expect(style(card(off).querySelector('[data-part="price"]')).textShadow).toBe('');
    expect(style(card(off).querySelector('[data-part="bubble"]')).boxShadow).toBe('');
  });

  it('la descripción usa el interlineado descLh', () => {
    const c = renderPage(baseTemplate('base'), [item('1')]);
    expect(style(card(c).querySelector('.pb-desc')).lineHeight).toBe('1.4');
    const other = renderPage(withProducts({ descLh: 1.8 }), [item('1')]);
    expect(style(card(other).querySelector('.pb-desc')).lineHeight).toBe('1.8');
  });

  it('con 1 o 2 productos las filas se centran: la primera foto baja respecto a la de 3 productos', () => {
    const three = renderPage(baseTemplate('base'), [item('1'), item('2'), item('3')]);
    const one = renderPage(baseTemplate('base'), [item('1')]);
    const top = (c: HTMLElement) => parseFloat(style(card(c).querySelector('[data-part="photo"]')).top);
    expect(top(one)).toBeGreaterThan(top(three));
    expect(one.querySelectorAll('[data-testid="product-card"]')).toHaveLength(1);
  });

  it('un producto sin descripción no muestra burbuja vacía y conserva tarjeta y precio', () => {
    const c = renderPage(baseTemplate('base'), [item('1', { description: '' })]);
    expect(card(c).querySelector('[data-part="bubble"]')).toBeNull();
    expect(card(c).querySelector('[data-part="photo"]')).not.toBeNull();
    expect(card(c).querySelector('[data-part="price"]')).not.toBeNull();
  });
});

describe('ProductsBlock · las otras plantillas no cambian', () => {
  it('sin los campos nuevos el marcado de Neón Noche no lleva sombra, neón de precio ni interlineado propio', () => {
    const c = renderPage(withProducts({}, 'neon'), [item('1'), item('2')]);
    expect(style(card(c).querySelector('[data-part="price"]')).textShadow).toBe('');
    expect(style(card(c).querySelector('[data-part="bubble"]')).boxShadow).toBe('');
    expect(style(card(c).querySelector('.pb-desc')).lineHeight).toBe('');
    expect(c.querySelector('.pb-diag')).toBeNull();
  });
});
