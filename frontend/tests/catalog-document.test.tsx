import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { baseTemplate } from '../../backend/src/catalog/template-presets';
import type { CatalogPayload } from '../../backend/src/catalog/types';
import CatalogDocument from '../src/print/CatalogDocument';

const config = {
  storeName: 'ASIANPOP MARKET+',
  phone1: '310 669 0585',
  phone2: '318 807 0709',
  address: 'Cra 10 # 18-15 centro',
  coverTitle: 'Catálogo de productos',
};

const alegra = (id: string, soldOut = false) => ({
  kind: 'alegra' as const,
  id,
  name: `Producto ${id}`,
  description: `Descripción ${id}`,
  priceLabel: '$9.000',
  imageUrl: `/media/cache/${id}.jpg`,
  soldOut,
});

const payload: CatalogPayload = {
  config,
  template: baseTemplate('neon'),
  generatedAt: '2026-10-03T00:00:00Z',
  terms: [{ title: 'Pedidos', body: 'Todo pedido\ncon 1 día' }],
  sections: [
    { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', pages: [[alegra('1'), alegra('2', true), alegra('3')], [alegra('4')]] },
    {
      key: 'custom:m',
      name: 'MOCHIS',
      source: 'custom',
      introText: '¿Qué es el mochi?',
      pages: [
        [
          {
            kind: 'custom',
            id: 'p',
            name: 'Caja de mochis',
            description: 'Rellenos',
            imageUrl: '/media/uploads/p.png',
            flavors: ['FRESA'],
            options: [{ label: 'Caja x 6 UND', priceLabel: '$30.000', maxFlavors: 2 }],
          },
          {
            kind: 'bundle',
            id: 'b',
            name: 'Combo regalo',
            description: '',
            imageUrl: '/media/uploads/b.png',
            priceLabel: '$27.000',
            components: [{ name: 'Shin', quantity: 2 }],
            soldOut: true,
          },
        ],
      ],
    },
  ],
};

const pageIds = (container: HTMLElement) =>
  Array.from(container.querySelector('[data-testid="catalog-document"]')!.children).map((p) => p.getAttribute('data-testid'));

describe('documento del catálogo (vista de impresión)', () => {
  it('tiene portada, portada por sección, páginas de producto y políticas, en orden', () => {
    const { container } = render(<CatalogDocument payload={payload} />);
    expect(pageIds(container)).toEqual([
      'cover-page',
      'section-cover',
      'catalog-page',
      'catalog-page',
      'section-cover',
      'catalog-page',
      'terms-page',
    ]);
  });

  it('es una hoja A4 por página, lista para imprimir', () => {
    const { container } = render(<CatalogDocument payload={payload} />);
    const root = screen.getByTestId('catalog-document');
    expect(root).toHaveClass('print-root');
    for (const page of Array.from(root.children)) {
      expect(page).toHaveClass('a4-page');
      expect((page as HTMLElement).style.width).toBe('210mm');
    }
    expect(container.querySelectorAll('.a4-page')).toHaveLength(7);
  });

  it('ninguna página tiene más de 3 productos', () => {
    render(<CatalogDocument payload={payload} />);
    for (const page of screen.getAllByTestId('catalog-page')) {
      expect(within(page).getAllByTestId('product-card').length).toBeLessThanOrEqual(3);
    }
  });

  it('una página de productos por cada bloque de ≤ 3 ítems, con sus productos', () => {
    render(<CatalogDocument payload={payload} />);
    const pages = screen.getAllByTestId('catalog-page');
    expect(pages.map((p) => within(p).getAllByTestId('product-card').length)).toEqual([3, 1, 2]);
  });

  it('muestra AGOTADO solo en los productos agotados (y en el combo agotado)', () => {
    render(<CatalogDocument payload={payload} />);
    const cards = screen.getAllByTestId('product-card');
    const soldOut = cards.filter((c) => c.getAttribute('data-sold-out') === 'true');
    expect(soldOut).toHaveLength(2);
    expect(soldOut[0]).toHaveTextContent('AGOTADO');
    const custom = cards.find((c) => c.textContent?.includes('Caja de mochis'))!;
    expect(custom).toHaveAttribute('data-sold-out', 'false');
    expect(custom).not.toHaveTextContent('AGOTADO');
  });

  it('muestra precios, opciones con máximo de sabores y componentes del combo', () => {
    render(<CatalogDocument payload={payload} />);
    expect(screen.getAllByText('$9.000').length).toBeGreaterThan(0);
    expect(screen.getByText('Caja x 6 UND').closest('li')).toHaveTextContent('Caja x 6 UND: $30.000 · máx. 2 sabores');
    expect(screen.getByText(/Sabores: FRESA/)).toBeInTheDocument();
    expect(screen.getByText('$27.000')).toBeInTheDocument();
    expect(screen.getByText(/2 × Shin/)).toBeInTheDocument();
  });

  it('la portada muestra el banner y los teléfonos; las de sección, el nombre y la introducción', () => {
    render(<CatalogDocument payload={payload} />);
    const cover = screen.getByTestId('cover-page');
    expect(cover).toHaveTextContent('Catálogo de productos');
    expect(cover).toHaveTextContent('310 669 0585 · 318 807 0709');
    const covers = screen.getAllByTestId('section-cover');
    expect(covers[0]).toHaveTextContent('RAMEN');
    expect(covers[1]).toHaveTextContent('MOCHIS');
    expect(covers[1]).toHaveTextContent('¿Qué es el mochi?');
    // una sección sin introducción no pinta el bloque
    expect(covers[0]!.querySelector('[data-part="intro"]')).toBeNull();
    expect(covers[1]!.querySelector('[data-part="intro"]')).not.toBeNull();
  });

  it('{seccion} es el nombre de cada sección en sus páginas y queda vacío en portada y políticas', () => {
    render(<CatalogDocument payload={payload} />);
    const [ramen1, ramen2, mochis] = screen.getAllByTestId('catalog-page');
    expect(ramen1).toHaveTextContent('Catálogo RAMEN');
    expect(ramen2).toHaveTextContent('Catálogo RAMEN');
    expect(mochis).toHaveTextContent('Catálogo MOCHIS');
    expect(screen.getByTestId('cover-page')).not.toHaveTextContent('RAMEN');
    expect(screen.getByTestId('terms-page')).not.toHaveTextContent('RAMEN');
  });

  describe('pie con teléfonos y dirección', () => {
    it('está en cada página de producto y en la de políticas', () => {
      render(<CatalogDocument payload={payload} />);
      const pages = [...screen.getAllByTestId('catalog-page'), screen.getByTestId('terms-page')];
      expect(pages).toHaveLength(4);
      for (const page of pages) {
        const footer = within(page).getByTestId('page-footer');
        expect(footer).toHaveTextContent('310 669 0585');
        expect(footer).toHaveTextContent('318 807 0709');
        expect(footer).toHaveTextContent('Cra 10 # 18-15 centro');
      }
    });

    it('las portadas no llevan pie y conservan sus teléfonos', () => {
      render(<CatalogDocument payload={payload} />);
      for (const cover of [screen.getByTestId('cover-page'), ...screen.getAllByTestId('section-cover')]) {
        expect(within(cover).queryByTestId('page-footer')).not.toBeInTheDocument();
        expect(cover).toHaveTextContent('Domicilios');
        expect(cover).toHaveTextContent('310 669 0585');
      }
    });

    it('usa los datos de contacto del payload', () => {
      const custom = { ...payload, config: { ...payload.config, phone1: '300 111 2222', phone2: '', address: 'Calle 5 # 6-7' } };
      render(<CatalogDocument payload={custom} />);
      const footer = within(screen.getAllByTestId('catalog-page')[0]!).getByTestId('page-footer');
      expect(footer).toHaveTextContent('300 111 2222');
      expect(footer).toHaveTextContent('Calle 5 # 6-7');
      expect(footer).not.toHaveTextContent('318 807 0709');
    });

    it('sin dirección solo muestra los teléfonos y sin teléfonos solo la dirección', () => {
      const noAddress = { ...payload, config: { ...payload.config, address: '' } };
      const { unmount } = render(<CatalogDocument payload={noAddress} />);
      const footer = within(screen.getAllByTestId('catalog-page')[0]!).getByTestId('page-footer');
      expect(footer.textContent).toBe('310 669 0585 · 318 807 0709');
      unmount();
      const noPhones = { ...payload, config: { ...payload.config, phone1: '', phone2: '' } };
      render(<CatalogDocument payload={noPhones} />);
      expect(within(screen.getAllByTestId('catalog-page')[0]!).getByTestId('page-footer').textContent).toBe('Cra 10 # 18-15 centro');
    });
  });

  it('el estado AGOTADO nunca aparece en un producto propio aunque llegue marcado como agotado', () => {
    const tricky = {
      ...payload,
      sections: [
        {
          key: 'custom:m',
          name: 'MOCHIS',
          source: 'custom' as const,
          pages: [[{ kind: 'custom' as const, id: 'p', name: 'Mochi', description: '', imageUrl: '/m/p.png', priceLabel: '$5.000', soldOut: true } as never]],
        },
      ],
    };
    render(<CatalogDocument payload={tricky} />);
    expect(screen.getByTestId('product-card')).toHaveAttribute('data-sold-out', 'false');
  });

  it('un nombre o texto muy largo no agrega páginas ni tarjetas', () => {
    const long = 'palabra '.repeat(200);
    const heavy: CatalogPayload = {
      ...payload,
      config: { ...payload.config, address: 'Dirección larguísima '.repeat(12), coverTitle: 'Banner '.repeat(11) },
      terms: Array.from({ length: 10 }, (_, i) => ({ title: `Política ${i + 1}`, body: long.slice(0, 350) })),
      sections: [
        {
          key: 'alegra:c1',
          name: 'UNA SECCIÓN CON UN NOMBRE MUY LARGO PARA PROBAR EL AJUSTE DEL TEXTO',
          source: 'alegra',
          introText: long.slice(0, 800),
          pages: [[{ ...alegra('1'), name: 'N'.repeat(120), description: long }, alegra('2'), alegra('3')]],
        },
      ],
    };
    const { container } = render(<CatalogDocument payload={heavy} />);
    expect(pageIds(container)).toEqual(['cover-page', 'section-cover', 'catalog-page', 'terms-page']);
    expect(screen.getAllByTestId('product-card')).toHaveLength(3);
  });

  it('la página de políticas parte el texto por líneas y no aparece sin políticas', () => {
    const { rerender } = render(<CatalogDocument payload={payload} />);
    expect(screen.getByTestId('terms-page')).toHaveTextContent('Todo pedido');
    expect(screen.getByTestId('terms-page')).toHaveTextContent('con 1 día');
    rerender(<CatalogDocument payload={{ ...payload, terms: [] }} />);
    expect(screen.queryByTestId('terms-page')).not.toBeInTheDocument();
  });

  it('sin secciones solo hay portada y políticas', () => {
    const { container } = render(<CatalogDocument payload={{ ...payload, sections: [] }} />);
    expect(pageIds(container)).toEqual(['cover-page', 'terms-page']);
  });

  it('dibuja con la plantilla del payload: otra plantilla, otros elementos', () => {
    const kraft = { ...payload, template: baseTemplate('kraft') };
    const { container } = render(<CatalogDocument payload={kraft} />);
    const page = container.querySelector('[data-testid="catalog-page"]')!;
    expect(page).toHaveAttribute('data-template-id', 'kraft');
    // Kraft usa la distribución en lista: hay separadores entre filas
    expect(page.querySelector('.pb[data-layout="lista"]')).not.toBeNull();
  });

  it('un elemento oculto en la plantilla no aparece en ninguna página', () => {
    const t = baseTemplate('neon');
    const banner = t.pages.portada.els.find((e) => e.type === 'text' && e.text === '{banner}')!;
    banner.visible = false;
    render(<CatalogDocument payload={{ ...payload, template: t }} />);
    expect(screen.getByTestId('cover-page')).not.toHaveTextContent('Catálogo de productos');
  });
});
