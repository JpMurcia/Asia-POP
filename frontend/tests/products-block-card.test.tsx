import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tokensFrom, type ProductsEl, type Template } from '../../backend/src/catalog/template';
import { baseTemplate } from '../../backend/src/catalog/template-presets';
import type { CatalogItem } from '../../backend/src/catalog/types';
import TemplatePage from '../src/print/TemplatePage';

/** Feature 010: la foto-tarjeta y el nombre dentro de ella. */
const tokens = tokensFrom(
  { storeName: 'ASIANPOP MARKET+', phone1: '310 669 0585', phone2: '318 807 0709', address: 'Cra 10', coverTitle: 'Catálogo' },
  'RAMEN',
);
const item = (id: string, name = `Producto ${id}`, over: Partial<CatalogItem> = {}): CatalogItem =>
  ({
    kind: 'alegra',
    id,
    name,
    description: `Descripción ${id}`,
    priceLabel: '$9.000',
    imageUrl: `/media/cards/${'a'.repeat(40)}.jpg`,
    soldOut: false,
    ...over,
  }) as CatalogItem;

function withProducts(patch: Partial<ProductsEl>): Template {
  const t = baseTemplate('neon');
  t.pages.productos.els = t.pages.productos.els.map((e) => (e.type === 'products' ? ({ ...e, ...patch } as ProductsEl) : e));
  return t;
}
const renderPage = (patch: Partial<ProductsEl>, items: CatalogItem[]) =>
  render(<TemplatePage template={withProducts(patch)} page="productos" tokens={tokens} items={items} />).container;
const card = (c: HTMLElement, i = 0) => c.querySelectorAll<HTMLElement>('[data-testid="product-card"]')[i]!;

describe('ProductsBlock con foto-tarjeta (cardStyle tarjeta, nameStyle tarjeta)', () => {
  const patch: Partial<ProductsEl> = { cardStyle: 'tarjeta', nameStyle: 'tarjeta', nameColor: '#FF7A00', nameGlow: true };

  it('el nombre se dibuja dentro de la foto, no en un rótulo aparte ni en la burbuja', () => {
    const c = renderPage(patch, [item('1', 'Shin Ramyun')]);
    const row = card(c);
    const photo = row.querySelector('[data-part="photo"]')!;
    const name = photo.querySelector('[data-part="card-name"]');
    expect(name).not.toBeNull();
    expect(name!.textContent).toBe('Shin Ramyun');
    expect(row.querySelector('[data-part="name"]')).toBeNull(); // sin rótulo separado
    expect(row.querySelector('[data-part="bubble"] .pb-name')).toBeNull(); // ni en la burbuja
  });

  it('el nombre ocupa la franja superior del 18 % de la foto, con margen lateral del 5 %', () => {
    const c = renderPage(patch, [item('1')]);
    const name = card(c).querySelector<HTMLElement>('[data-part="card-name"]')!;
    expect(name.style.top).toBe('0px');
    expect(parseFloat(name.style.height)).toBeGreaterThan(0);
    const photo = card(c).querySelector<HTMLElement>('[data-part="photo"]')!;
    expect(parseFloat(name.style.height)).toBeCloseTo(parseFloat(photo.style.height) * 0.18, 1);
    expect(parseFloat(name.style.left)).toBeCloseTo(parseFloat(photo.style.width) * 0.05, 1);
    expect(parseFloat(name.style.width)).toBeCloseTo(parseFloat(photo.style.width) * 0.9, 1);
  });

  it('usa el color de nombre de la plantilla y su resplandor neón', () => {
    const c = renderPage(patch, [item('1')]);
    const name = card(c).querySelector<HTMLElement>('[data-part="card-name"]')!;
    expect(name.style.color).toBe('rgb(255, 122, 0)');
    expect(name.style.textShadow.toLowerCase()).toContain('#ff7a00');
    const sin = renderPage({ ...patch, nameGlow: false }, [item('1')]);
    expect(card(sin).querySelector<HTMLElement>('[data-part="card-name"]')!.style.textShadow).toBe('');
  });

  it('un nombre largo, de una sola palabra o en coreano se dibuja completo en el DOM (el ajuste lo hace useFit)', () => {
    for (const name of ['x'.repeat(60), 'Palabra'.repeat(5), '신라면 매운맛 컵라면 큰사발']) {
      const c = renderPage(patch, [item('1', name)]);
      expect(card(c).querySelector('[data-part="card-name"]')!.textContent).toBe(name);
    }
  });

  it('la burbuja solo existe si hay descripción: sin descripción no hay burbuja vacía', () => {
    const c = renderPage(patch, [item('1', 'A', { description: '' })]);
    expect(card(c).querySelector('[data-part="bubble"]')).toBeNull();
    const d = renderPage(patch, [item('1', 'A')]);
    expect(card(d).querySelector('[data-part="bubble"]')).not.toBeNull();
  });

  it('la imagen es la tarjeta que llega en el payload y el precio sigue dibujándose', () => {
    const c = renderPage(patch, [item('1')]);
    expect(card(c).querySelector<HTMLImageElement>('img.pb-img')!.getAttribute('src')).toMatch(/^\/media\/cards\/[0-9a-f]{40}\.jpg$/);
    expect(card(c).querySelector('[data-part="price"]')!.textContent).toBe('$9.000');
  });

  it('un producto agotado conserva su tarjeta y suma su estilo de agotado', () => {
    const c = renderPage(patch, [item('1', 'A', { soldOut: true })]);
    expect(card(c).getAttribute('data-sold-out')).toBe('true');
    expect(card(c).querySelector('[data-part="card-name"]')).not.toBeNull();
    expect(card(c).textContent).toContain('AGOTADO');
  });
});

describe('ProductsBlock sin foto-tarjeta: el render de siempre', () => {
  it('con cardStyle plana (o sin el campo) no hay nombre dentro de la foto', () => {
    for (const p of [{ cardStyle: 'plana' as const }, {}]) {
      const c = renderPage(p, [item('1')]);
      expect(card(c).querySelector('[data-part="card-name"]')).toBeNull();
      expect(card(c).querySelector('[data-part="name"]')).not.toBeNull(); // Neón Noche: nombre separado
    }
  });

  it('la tarjeta no cambia el resto de las plantillas: el marcado de Neón Noche es idéntico con y sin los campos nuevos', () => {
    const a = renderPage({}, [item('1'), item('2')]).innerHTML;
    const b = renderPage({ cardStyle: 'plana', priceGlow: false, soldGlow: false, bubbleShadow: false }, [item('1'), item('2')]).innerHTML;
    expect(b).toBe(a);
  });
});
