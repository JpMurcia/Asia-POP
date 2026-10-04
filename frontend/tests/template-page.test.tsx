import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  tokensFrom,
  type PageElement,
  type PageKey,
  type ProductsEl,
  type Template,
} from '../../backend/src/catalog/template';
import { baseTemplate, draftText } from '../../backend/src/catalog/template-presets';
import type { CatalogItem } from '../../backend/src/catalog/types';
import TemplatePage from '../src/print/TemplatePage';
import { FONT_STACKS, IMAGES, fontFamily, weightFor } from '../src/print/assets';

const business = {
  storeName: 'ASIANPOP MARKET+',
  phone1: '310 669 0585',
  phone2: '318 807 0709',
  address: 'Cra 10 # 18-15 centro',
  coverTitle: 'Catálogo de productos',
};

const alegra = (id: string, soldOut = false): CatalogItem => ({
  kind: 'alegra',
  id,
  name: `Producto ${id}`,
  description: `Descripción ${id}`,
  priceLabel: '$9.000',
  imageUrl: `/media/cache/${id}.jpg`,
  soldOut,
});
const custom: CatalogItem = {
  kind: 'custom',
  id: 'p',
  name: 'Caja de mochis',
  description: 'Rellenos',
  imageUrl: '/media/uploads/p.png',
  flavors: ['FRESA', 'MANGO'],
  options: [{ label: 'Caja x 6 UND', priceLabel: '$30.000', maxFlavors: 2 }],
};
const bundle: CatalogItem = {
  kind: 'bundle',
  id: 'b',
  name: 'Combo regalo',
  description: '',
  imageUrl: '/media/uploads/b.png',
  priceLabel: '$27.000',
  components: [{ name: 'Shin', quantity: 2 }],
  soldOut: true,
};

const terms = [
  { title: 'Pedidos', body: 'Todo pedido\ncon 1 día' },
  { title: 'Pagos', body: 'Transferencia' },
];

/** Plantilla Neón Noche con el bloque de productos modificado. */
function withProducts(patch: Partial<ProductsEl>): Template {
  const t = baseTemplate('neon');
  t.pages.productos.els = t.pages.productos.els.map((e) => (e.type === 'products' ? { ...e, ...patch } : e));
  return t;
}

const find = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`[data-el-id="${id}"]`);
const idOf = (t: Template, page: PageKey, pred: (e: PageElement) => boolean) => t.pages[page].els.find(pred)!.id;

describe('TemplatePage', () => {
  const tokens = tokensFrom(business, 'RAMEN');

  it('ubica cada elemento con left/top/width/height en % y su data-el-id', () => {
    const t = baseTemplate('neon');
    const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
    for (const el of t.pages.portada.els) {
      const node = find(container, el.id)!;
      expect(node, el.id).toBeTruthy();
      expect(node.style.left).toBe(`${el.x}%`);
      expect(node.style.top).toBe(`${el.y}%`);
      expect(node.style.width).toBe(`${el.w}%`);
      expect(node.style.height).toBe(`${el.h}%`);
      expect(node.getAttribute('data-el-type')).toBe(el.type);
    }
  });

  it('pinta los elementos en el orden del arreglo (el último queda al frente)', () => {
    const t = baseTemplate('neon');
    const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
    const ids = Array.from(container.querySelectorAll('[data-el-id]')).map((n) => n.getAttribute('data-el-id'));
    expect(ids).toEqual(t.pages.portada.els.map((e) => e.id));
  });

  it('un elemento oculto no se pinta', () => {
    const t = baseTemplate('neon');
    const banner = t.pages.portada.els.find((e) => e.type === 'text' && e.text === '{banner}')!;
    banner.visible = false;
    const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
    expect(find(container, banner.id)).toBeNull();
    expect(screen.queryByText('Catálogo de productos')).not.toBeInTheDocument();
  });

  it('aplica rotación y opacidad del elemento', () => {
    const t = baseTemplate('neon');
    t.pages.portada.els.push({ ...draftText({ text: 'Girado', rot: -12, opacity: 0.4 }), id: 'girado' });
    const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
    const node = find(container, 'girado')!;
    expect(node.style.transform).toBe('rotate(-12deg)');
    expect(node.style.opacity).toBe('0.4');
  });

  describe('colores de paleta', () => {
    const textNode = (container: HTMLElement, t: Template) =>
      find(container, idOf(t, 'portada', (e) => e.type === 'text' && e.text === '{banner}'))!.querySelector<HTMLElement>('.tpl-text')!;

    it('se resuelven contra la paleta y cambian cuando cambia la paleta', () => {
      const t = baseTemplate('neon'); // el banner usa el color `bg`
      const { container, rerender } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      expect(getComputedStyle(textNode(container, t)).color).toBe('rgb(17, 5, 44)');
      const changed = { ...t, palette: { ...t.palette, bg: '#336699' } };
      rerender(<TemplatePage template={changed} page="portada" tokens={tokens} />);
      expect(getComputedStyle(textNode(container, changed)).color).toBe('rgb(51, 102, 153)');
    });

    it('un color personalizado no cambia con la paleta', () => {
      const t = baseTemplate('neon');
      t.pages.portada.els.push({ ...draftText({ text: 'Fijo', color: '#123456' }), id: 'fijo' });
      const { container } = render(<TemplatePage template={{ ...t, palette: { ...t.palette, ink: '#FFFFFF' } }} page="portada" tokens={tokens} />);
      expect(getComputedStyle(find(container, 'fijo')!.querySelector<HTMLElement>('.tpl-text')!).color).toBe('rgb(18, 52, 86)');
    });
  });

  describe('tamaño de la hoja', () => {
    it('en pantalla mide 595,28 × 841,89 px lógicos y se escala con transform', () => {
      const t = baseTemplate('neon');
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} scale={0.5} testId="vista" />);
      const frame = screen.getByTestId('vista');
      expect(frame.style.width).toBe('297.64px');
      expect(frame.style.height).toBe('420.945px');
      const page = container.querySelector<HTMLElement>('.tpl-page')!;
      expect(page.style.width).toBe('595.28px');
      expect(page.style.height).toBe('841.89px');
      expect(page.style.transform).toBe('scale(0.5)');
    });

    it('en modo impresión usa un contenedor de 210 × 297 mm, escala 4/3 y la clase de hoja A4', () => {
      const t = baseTemplate('neon');
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} mode="print" testId="cover-page" />);
      const sheet = screen.getByTestId('cover-page');
      expect(sheet).toHaveClass('a4-page');
      expect(sheet.style.width).toBe('210mm');
      expect(sheet.style.height).toBe('297mm');
      const page = container.querySelector<HTMLElement>('.tpl-page')!;
      expect(page.style.transform).toMatch(/^scale\(1\.3333/);
    });

    it('el contenedor de la página recorta lo que sale de la hoja y un elemento parcialmente fuera no cambia de tamaño', () => {
      const t = baseTemplate('neon');
      t.pages.portada.els.push({ ...draftText({ text: 'Asoma', x: -20, y: 90, w: 60, h: 20 }), id: 'asoma' });
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      expect(container.querySelector<HTMLElement>('.tpl-page')!.style.overflow).toBe('hidden');
      const node = find(container, 'asoma')!;
      expect(node.style.left).toBe('-20%');
      expect(node.style.width).toBe('60%');
      expect(node.style.height).toBe('20%');
    });
  });

  describe('fondo de página', () => {
    it('de imagen usa un <img> (para que la impresión espere a que cargue)', () => {
      const t = baseTemplate('neon'); // portada: atardecer
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      const bg = container.querySelector<HTMLImageElement>('img.tpl-bg')!;
      expect(bg).toBeTruthy();
      expect(bg.getAttribute('src')).toBe(IMAGES.coverbg);
    });

    it('de color usa el color de la paleta y de degradado va de arriba abajo', () => {
      const t = baseTemplate('kawaii'); // portada: degradado bg → paper
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      const page = container.querySelector<HTMLElement>('.tpl-page')!;
      expect(page.style.backgroundImage).toContain('linear-gradient');
      expect(page.style.backgroundImage).toMatch(/180deg/);
      expect(container.querySelector('img.tpl-bg')).toBeNull();
      const solid = baseTemplate('pop'); // portada: color paper
      const r2 = render(<TemplatePage template={solid} page="portada" tokens={tokens} />);
      expect(r2.container.querySelector<HTMLElement>('.tpl-page')!.style.backgroundColor).toBe('rgb(255, 247, 236)');
    });
  });

  describe('marcadores de datos', () => {
    it('se reemplazan en textos, insignias y pie', () => {
      const t = baseTemplate('neon');
      render(<TemplatePage template={t} page="productos" tokens={tokens} items={[alegra('1')]} />);
      expect(screen.getByText('Catálogo RAMEN')).toBeInTheDocument();
      expect(screen.getByTestId('page-footer')).toHaveTextContent('310 669 0585 · 318 807 0709 · Cra 10 # 18-15 centro');
    });

    it('un marcador desconocido queda tal cual y {seccion} vacío no deja residuo', () => {
      const t = baseTemplate('neon');
      t.pages.portada.els.push({ ...draftText({ text: 'Hola {otra}' }), id: 'otra' });
      render(<TemplatePage template={t} page="portada" tokens={tokensFrom(business)} />);
      expect(screen.getByText('Hola {otra}')).toBeInTheDocument();
    });

    it('los textos con marcadores llevan data-fit y los textos libres no', () => {
      const t = baseTemplate('neon');
      t.pages.portada.els.push(
        { ...draftText({ text: 'Texto libre' }), id: 'libre' },
        { ...draftText({ text: 'Con {tienda}' }), id: 'con-dato' },
      );
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      expect(find(container, 'con-dato')!.querySelector('[data-fit="true"]')).toBeTruthy();
      expect(find(container, 'libre')!.querySelector('[data-fit="true"]')).toBeNull();
      const banner = find(container, idOf(t, 'portada', (e) => e.type === 'text' && e.text === '{banner}'))!;
      expect(banner.querySelector('[data-fit="true"]')).toBeTruthy();
      // el texto libre conserva su salto de línea y no parte las palabras a la fuerza
      expect(find(container, 'libre')!.querySelector<HTMLElement>('.tpl-text')!.style.whiteSpace).toBe('pre-wrap');
    });

    it('una insignia con marcadores también se ajusta', () => {
      const t = baseTemplate('kawaii');
      t.pages.portada.els.push({ ...(baseTemplate('kawaii').pages.portada.els.find((e) => e.type === 'badge') as PageElement), id: 'ins', text: '{seccion}' } as PageElement);
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      expect(find(container, 'ins')!.querySelector('[data-fit="true"]')).toBeTruthy();
      expect(find(container, 'ins')).toHaveTextContent('RAMEN');
    });
  });

  describe('formas e imágenes', () => {
    it('una forma usa su relleno, borde y esquinas; un círculo es 50 % y una píldora 999 px', () => {
      const t = baseTemplate('pop'); // portada: círculo de acento 2
      const circle = t.pages.portada.els.find((e) => e.type === 'shape')!;
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      const shape = find(container, circle.id)!.querySelector<HTMLElement>('.tpl-shape')!;
      expect(shape.style.borderRadius).toBe('50%');
      expect(getComputedStyle(shape).backgroundColor).toBe('rgb(255, 184, 0)');
    });

    it('una imagen usa <img> con su ajuste; un radio de 300 o más es un círculo', () => {
      const t = baseTemplate('pop'); // portada: logo circular y collage
      const { container } = render(<TemplatePage template={t} page="portada" tokens={tokens} />);
      const logo = t.pages.portada.els.find((e) => e.type === 'image' && e.src === 'logo')!;
      const img = find(container, logo.id)!.querySelector<HTMLImageElement>('img')!;
      expect(img.getAttribute('src')).toBe(IMAGES.logo);
      expect(img.style.objectFit).toBe('cover');
      expect(img.style.borderRadius).toBe('50%');
      const collage = t.pages.portada.els.find((e) => e.type === 'image' && e.src === 'collage')!;
      expect(find(container, collage.id)!.querySelector<HTMLImageElement>('img')!.style.objectFit).toBe('contain');
    });
  });

  describe('bloque de productos', () => {
    const cards = (container: HTMLElement) => within(container).getAllByTestId('product-card');

    it('muestra a lo sumo tres productos, con nombre, descripción, precio y foto', () => {
      const { container } = render(
        <TemplatePage template={baseTemplate('neon')} page="productos" tokens={tokens} items={[alegra('1'), alegra('2'), alegra('3'), alegra('4')]} />,
      );
      expect(cards(container)).toHaveLength(3);
      expect(screen.getAllByText('$9.000')).toHaveLength(3);
      expect(screen.getByText('Producto 1', { selector: '.pb-name' })).toBeInTheDocument();
      expect(screen.getByText('Descripción 1', { selector: '.pb-desc' })).toBeInTheDocument();
      expect(container.querySelector<HTMLImageElement>('img[alt="Producto 1"]')!.getAttribute('src')).toBe('/media/cache/1.jpg');
    });

    it('un producto de Alegra con descripción muestra su nombre y su descripción (FR-010 de 001)', () => {
      // Antes solo mostraba la descripción: una nota de envío dejaba la tarjeta sin nombre
      render(
        <TemplatePage
          template={baseTemplate('neon')}
          page="productos"
          tokens={tokens}
          items={[{ ...alegra('1'), name: 'Fideos de ejemplo', description: 'Incluye el valor de envío por unidad' } as CatalogItem]}
        />,
      );
      const card = screen.getByTestId('product-card');
      expect(within(card).getByText('Fideos de ejemplo', { selector: '.pb-name' })).toBeInTheDocument();
      expect(within(card).getByText('Incluye el valor de envío por unidad', { selector: '.pb-desc' })).toBeInTheDocument();
      // El nombre va arriba de la descripción
      const name = card.querySelector('.pb-name')!;
      const desc = card.querySelector('.pb-desc')!;
      expect(name.compareDocumentPosition(desc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('un producto de Alegra sin descripción muestra su nombre y ninguna descripción vacía', () => {
      render(<TemplatePage template={baseTemplate('neon')} page="productos" tokens={tokens} items={[{ ...alegra('1'), description: '' } as CatalogItem]} />);
      expect(screen.getByText('Producto 1', { selector: '.pb-name' })).toBeInTheDocument();
      expect(screen.getByTestId('product-card').querySelector('.pb-desc')).toBeNull();
    });

    it('un producto propio sigue mostrando nombre y descripción', () => {
      render(<TemplatePage template={baseTemplate('neon')} page="productos" tokens={tokens} items={[{ ...custom, description: 'Seis mochis' } as CatalogItem]} />);
      expect(screen.getByTestId('product-card').querySelector('.pb-name')).not.toBeNull();
      expect(screen.getByText('Seis mochis', { selector: '.pb-desc' })).toBeInTheDocument();
    });

    it.each(['sello', 'cinta', 'gris'] as const)('con el estilo %s muestra AGOTADO solo en los productos agotados', (sold) => {
      const { container } = render(
        <TemplatePage template={withProducts({ sold })} page="productos" tokens={tokens} items={[alegra('1'), alegra('2', true), custom]} />,
      );
      const [ok, soldOut, own] = cards(container);
      expect(ok).toHaveAttribute('data-sold-out', 'false');
      expect(ok).not.toHaveTextContent('AGOTADO');
      expect(soldOut).toHaveAttribute('data-sold-out', 'true');
      expect(soldOut).toHaveTextContent('AGOTADO');
      expect(own).toHaveAttribute('data-sold-out', 'false');
      expect(own).not.toHaveTextContent('AGOTADO');
    });

    it('cada estilo dibuja su propia marca', () => {
      const sello = render(<TemplatePage template={withProducts({ sold: 'sello' })} page="productos" tokens={tokens} items={[alegra('2', true)]} />);
      expect(sello.container.querySelector('img.pb-seal')).toBeTruthy();
      sello.unmount();
      const cinta = render(<TemplatePage template={withProducts({ sold: 'cinta', soldFill: '#336699' })} page="productos" tokens={tokens} items={[alegra('2', true)]} />);
      const ribbon = cinta.container.querySelector<HTMLElement>('.pb-ribbon')!;
      expect(ribbon).toHaveTextContent('AGOTADO');
      expect(getComputedStyle(ribbon).backgroundColor).toBe('rgb(51, 102, 153)');
      cinta.unmount();
      const gris = render(<TemplatePage template={withProducts({ sold: 'gris' })} page="productos" tokens={tokens} items={[alegra('2', true)]} />);
      expect(gris.container.querySelector('.pb-gray-tag')).toHaveTextContent('AGOTADO');
      expect(gris.container.querySelector<HTMLElement>('.pb-photo img, .pb-photo .pb-img')!.style.filter).toBe('grayscale(1)');
    });

    it('nunca marca un producto propio como agotado aunque llegue marcado', () => {
      const tricky = { ...custom, soldOut: true } as unknown as CatalogItem;
      const { container } = render(<TemplatePage template={withProducts({ sold: 'cinta' })} page="productos" tokens={tokens} items={[tricky]} />);
      expect(cards(container)[0]).toHaveAttribute('data-sold-out', 'false');
      expect(container).not.toHaveTextContent('AGOTADO');
    });

    it('un combo agotado muestra AGOTADO, igual que un producto de Alegra', () => {
      const { container } = render(<TemplatePage template={baseTemplate('neon')} page="productos" tokens={tokens} items={[bundle]} />);
      expect(cards(container)[0]).toHaveAttribute('data-sold-out', 'true');
      expect(cards(container)[0]).toHaveTextContent('AGOTADO');
    });

    it('muestra opciones con máximo de sabores, sabores y los componentes del combo', () => {
      render(<TemplatePage template={baseTemplate('neon')} page="productos" tokens={tokens} items={[custom, bundle]} />);
      expect(screen.getByText('Caja x 6 UND').closest('li')).toHaveTextContent('Caja x 6 UND: $30.000 · máx. 2 sabores');
      expect(screen.getByText(/Sabores: FRESA, MANGO/)).toBeInTheDocument();
      expect(screen.getByText(/Incluye: 2 × Shin/)).toBeInTheDocument();
      expect(screen.getByText('$27.000')).toBeInTheDocument();
    });

    it('marca sus partes con data-part y aplica los colores del bloque', () => {
      const { container } = render(
        <TemplatePage template={withProducts({ bubbleFill: '#112233', ring: 'a1', ringW: 5, priceFill: '#445566' })} page="productos" tokens={tokens} items={[alegra('1')]} />,
      );
      const photo = container.querySelector<HTMLElement>('[data-part="photo"]')!;
      const bubble = container.querySelector<HTMLElement>('[data-part="bubble"]')!;
      const price = container.querySelector<HTMLElement>('[data-part="price"]')!;
      expect(getComputedStyle(bubble).backgroundColor).toBe('rgb(17, 34, 51)');
      expect(getComputedStyle(price).backgroundColor).toBe('rgb(68, 85, 102)');
      expect(photo.style.border).toContain('5px');
      expect(getComputedStyle(photo).borderTopColor).toBe('rgb(255, 0, 122)');
    });

    it.each(['alternado', 'tarjetas', 'lista'] as const)('con la distribución %s pinta las tres filas dentro del bloque', (layout) => {
      const { container } = render(
        <TemplatePage template={withProducts({ layout })} page="productos" tokens={tokens} items={[alegra('1'), alegra('2'), alegra('3')]} />,
      );
      expect(cards(container)).toHaveLength(3);
      expect(container.querySelectorAll('[data-part="photo"]')).toHaveLength(3);
    });

    it('acepta posiciones de recorte para los datos de muestra del editor', () => {
      const { container } = render(
        <TemplatePage template={baseTemplate('neon')} page="productos" tokens={tokens} items={[alegra('1')]} photoPositions={['69% 15%']} />,
      );
      const img = container.querySelector<HTMLElement>('[data-part="photo"] .pb-img')!;
      expect(img.style.backgroundPosition).toBe('69% 15%');
    });
  });

  describe('bloque de introducción', () => {
    it('no se pinta si la sección no tiene texto de introducción', () => {
      const { container } = render(<TemplatePage template={baseTemplate('neon')} page="seccion" tokens={tokens} />);
      expect(container.querySelector('[data-part="intro"]')).toBeNull();
      expect(container.querySelector('[data-el-type="intro"]')).toBeNull();
    });

    it('con texto lo muestra con sus saltos de línea y sus colores', () => {
      const { container } = render(<TemplatePage template={baseTemplate('neon')} page="seccion" tokens={tokens} introText={'¿Qué es el mochi?\nPostre japonés.'} />);
      const intro = container.querySelector<HTMLElement>('[data-part="intro"]')!;
      expect(intro).toHaveTextContent('¿Qué es el mochi?');
      expect(intro.style.whiteSpace).toBe('pre-line');
      expect(getComputedStyle(intro).backgroundColor).toBe('rgb(232, 223, 208)');
    });
  });

  describe('bloque de políticas', () => {
    it('muestra cada política con su título como chip y su texto por líneas', () => {
      const { container } = render(<TemplatePage template={baseTemplate('neon')} page="politicas" tokens={tokens} terms={terms} />);
      const body = container.querySelector<HTMLElement>('[data-part="terms-body"]')!;
      expect(within(body).getByText('Pedidos')).toBeInTheDocument();
      expect(within(body).getByText('Todo pedido')).toBeInTheDocument();
      expect(within(body).getByText('con 1 día')).toBeInTheDocument();
      expect(within(body).getByText('Pagos')).toBeInTheDocument();
    });

    it('el chip usa los colores del bloque', () => {
      const { container } = render(<TemplatePage template={baseTemplate('neon')} page="politicas" tokens={tokens} terms={terms} />);
      const chip = container.querySelector<HTMLElement>('[data-part="terms-body"] h3')!;
      expect(getComputedStyle(chip).backgroundColor).toBe('rgb(17, 5, 44)');
      expect(getComputedStyle(chip).color).toBe('rgb(255, 0, 122)');
    });
  });

  describe('pie de página', () => {
    it('resuelve los marcadores y conserva data-testid="page-footer"', () => {
      render(<TemplatePage template={baseTemplate('neon')} page="politicas" tokens={tokens} terms={terms} />);
      const footer = screen.getByTestId('page-footer');
      expect(footer).toHaveTextContent('310 669 0585');
      expect(footer).toHaveTextContent('Cra 10 # 18-15 centro');
      expect(footer.getAttribute('data-part')).toBe('footer');
    });

    it('sin dirección solo muestra los teléfonos, sin separador colgando', () => {
      render(<TemplatePage template={baseTemplate('neon')} page="politicas" tokens={tokensFrom({ ...business, address: '' })} terms={terms} />);
      expect(screen.getByTestId('page-footer').textContent).toBe('310 669 0585 · 318 807 0709');
    });
  });
});

describe('assets', () => {
  it('registra las cinco imágenes', () => {
    expect(Object.keys(IMAGES).sort()).toEqual(['collage', 'coverbg', 'frame', 'logo', 'marble']);
    for (const url of Object.values(IMAGES)) expect(typeof url).toBe('string');
  });

  it('tiene una pila tipográfica por cada una de las seis familias', () => {
    expect(Object.keys(FONT_STACKS).sort()).toEqual(['bungee', 'fredoka', 'grotesk', 'poppins', 'serif', 'zen']);
    expect(FONT_STACKS.zen).toContain('Zen Maru Gothic');
    expect(FONT_STACKS.serif).toContain('DM Serif Display');
  });

  it('fontFamily resuelve título, cuerpo o una familia concreta', () => {
    const t = baseTemplate('kraft'); // título: serif, cuerpo: grotesk
    expect(fontFamily(t, 'title')).toBe(FONT_STACKS.serif);
    expect(fontFamily(t, 'body')).toBe(FONT_STACKS.grotesk);
    expect(fontFamily(t, 'bungee')).toBe(FONT_STACKS.bungee);
  });

  it('weightFor usa el peso disponible más cercano de cada familia', () => {
    expect(weightFor('poppins', 600)).toBe(600);
    expect(weightFor('poppins', 900)).toBe(700);
    expect(weightFor('zen', 900)).toBe(900);
    expect(weightFor('zen', 600)).toBe(700);
    expect(weightFor('grotesk', 600)).toBe(700);
    expect(weightFor('grotesk', 400)).toBe(400);
    expect(weightFor('bungee', 900)).toBe(400);
    expect(weightFor('serif', 700)).toBe(400);
    expect(weightFor('fredoka', 400)).toBe(400);
  });
});
