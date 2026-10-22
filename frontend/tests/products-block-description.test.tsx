import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tokensFrom } from '../../backend/src/catalog/template';
import { baseTemplate } from '../../backend/src/catalog/template-presets';
import type { CatalogItem } from '../../backend/src/catalog/types';
import TemplatePage from '../src/print/TemplatePage';

/** Feature 010 (US3): la descripción de cada producto en la burbuja de Base AsianPop. */
const tokens = tokensFrom({ storeName: 'T', phone1: '1', phone2: '2', address: 'a', coverTitle: 'c' }, 'RAMEN');
const item = (id: string, description: string): CatalogItem =>
  ({ kind: 'alegra', id, name: `Producto ${id}`, description, priceLabel: '$9.000', imageUrl: `/media/cards/${'c'.repeat(40)}.jpg`, soldOut: false }) as CatalogItem;
const render3 = (items: CatalogItem[]) =>
  render(<TemplatePage template={baseTemplate('base')} page="productos" tokens={tokens} items={items} />).container;
const cards = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-testid="product-card"]')];

describe('descripción en la burbuja (Base AsianPop)', () => {
  it('cada producto muestra su propia descripción, nunca la de otro (FR-013c)', () => {
    const c = render3([item('1', 'Sopa picante'), item('2', 'Galletas de chocolate'), item('3', 'Té helado')]);
    const texts = cards(c).map((card) => card.querySelector('.pb-desc')?.textContent);
    expect(texts).toEqual(['Sopa picante', 'Galletas de chocolate', 'Té helado']);
  });

  it('una descripción corta va centrada en la burbuja', () => {
    const c = render3([item('1', 'Sopa picante')]);
    const bubble = cards(c)[0]!.querySelector<HTMLElement>('[data-part="bubble"]')!;
    expect(bubble.style.textAlign).toBe('center');
    expect(bubble.style.alignItems).toBe('center');
  });

  it('una descripción de 400 caracteres llega completa al DOM: el ajuste y el corte con «…» los hace el estilo (--desc-lines) y useFit', () => {
    const long = 'Fideos instantáneos con caldo intenso. '.repeat(11).slice(0, 400);
    const c = render3([item('1', long)]);
    expect(cards(c)[0]!.querySelector('.pb-desc')!.textContent).toBe(long);
  });

  it('un producto sin descripción no muestra burbuja vacía y la página queda con su tarjeta y su precio (FR-018)', () => {
    const c = render3([item('1', ''), item('2', 'Con descripción'), item('3', '')]);
    const [a, b, d] = cards(c);
    expect(a!.querySelector('[data-part="bubble"]')).toBeNull();
    expect(b!.querySelector('[data-part="bubble"]')).not.toBeNull();
    expect(d!.querySelector('[data-part="bubble"]')).toBeNull();
    for (const card of [a!, b!, d!]) {
      expect(card.querySelector('[data-part="photo"]')).not.toBeNull();
      expect(card.querySelector('[data-part="price"]')).not.toBeNull();
    }
  });
});
