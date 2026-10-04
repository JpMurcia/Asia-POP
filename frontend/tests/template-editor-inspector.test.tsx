import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canvas,
  canvasEl,
  fireEvent,
  goToPage,
  layers,
  mockEditorApi,
  openElements,
  renderEditor,
  screen,
  selectLayer,
  setField,
  waitFor,
  within,
} from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const group = (name: string) => screen.getByRole('group', { name });
const inGroup = (g: string, button: string | RegExp) => within(group(g)).getByRole('button', { name: button });
const range = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const bounds = (label: string) => [Number(range(label).min), Number(range(label).max)];

async function start() {
  mockEditorApi();
  return renderEditor();
}

/** Agrega con el panel Elementos y deja el elemento nuevo seleccionado. */
async function add(button: string | RegExp) {
  openElements();
  click(button);
}

describe('inspector por tipo de elemento (FR-011, FR-012)', () => {
  it('sin selección muestra la página, no un elemento', async () => {
    await start();
    expect(screen.getByTestId('inspector')).toHaveTextContent('Página');
    expect(screen.getByTestId('inspector')).toHaveTextContent('Portada');
    expect(screen.queryByRole('button', { name: 'Duplicar' })).not.toBeInTheDocument();
  });

  describe('texto', () => {
    it('muestra contenido, datos insertables, tipografía, color y posición con los rangos de FR-012', async () => {
      await start();
      await add('Agregar título');
      expect(screen.getByTestId('inspector')).toHaveTextContent('Texto');
      expect(screen.getByTestId('inspector')).toHaveTextContent('Título'); // el nombre del elemento
      expect(screen.getByLabelText('Texto')).toHaveValue('Nuevo título');
      for (const chip of ['Banner', 'Sección', 'Teléfonos', 'Dirección', 'Tienda']) {
        expect(within(group('Insertar dato')).getByRole('button', { name: chip })).toBeInTheDocument();
      }
      expect(bounds('Tamaño')).toEqual([8, 140]);
      expect(bounds('Espaciado')).toEqual([-2, 12]);
      expect(bounds('Opacidad')).toEqual([0, 100]);
      expect(bounds('Rotación')).toEqual([-180, 180]);
      for (const w of ['Normal', 'Semi', 'Negrita', 'Black']) expect(inGroup('Peso', w)).toBeInTheDocument();
      for (const a of ['Izq.', 'Centro', 'Der.']) expect(inGroup('Alineación', a)).toBeInTheDocument();
      expect(screen.getByRole('switch', { name: 'Mayúsculas' })).toBeInTheDocument();
      for (const g of ['Relleno', 'Contorno', 'Resplandor neón']) expect(group(g)).toBeInTheDocument();
      for (const n of ['X %', 'Y %', 'Ancho %', 'Alto %']) expect(screen.getByLabelText(n)).toBeInTheDocument();
    });

    it('la fuente ofrece título, cuerpo y las seis familias', async () => {
      await start();
      await add('Agregar texto');
      const options = within(screen.getByLabelText('Fuente')).getAllByRole('option').map((o) => o.textContent);
      expect(options).toEqual([
        'Título · Fredoka',
        'Cuerpo · Poppins',
        'Fredoka',
        'Poppins',
        'Bungee',
        'Zen Maru Gothic',
        'Space Grotesk',
        'DM Serif Display',
      ]);
    });

    it('el grosor del contorno solo aparece con un contorno y va de 0 a 8', async () => {
      await start();
      await add('Agregar título');
      expect(screen.queryByLabelText('Grosor del contorno')).not.toBeInTheDocument();
      fireEvent.click(within(group('Contorno')).getByRole('button', { name: 'Acento 1' }));
      expect(bounds('Grosor del contorno')).toEqual([0, 8]);
    });

    it('cambiar un campo actualiza el lienzo', async () => {
      await start();
      await add('Agregar título');
      fireEvent.click(within(group('Relleno')).getByRole('button', { name: 'Acento 2' }));
      const text = Array.from(canvas().querySelectorAll<HTMLElement>('[data-el-type="text"] .tpl-text')).find((t) => t.textContent === 'Nuevo título')!;
      expect(getComputedStyle(text).color).toBe('rgb(0, 255, 102)');
      setField('Texto', 'Hola mundo');
      // la miniatura de la tira también dibuja el texto: se busca solo en la hoja del lienzo
      expect(within(canvas()).getByText('Hola mundo', { selector: '.tpl-text' })).toBeInTheDocument();
    });

    it('un color personalizado #RRGGBB queda fijo y en mayúsculas', async () => {
      await start();
      await add('Agregar título');
      fireEvent.change(within(group('Relleno')).getByLabelText('Color personalizado'), { target: { value: '#12ab34' } });
      const text = Array.from(canvas().querySelectorAll<HTMLElement>('[data-el-type="text"] .tpl-text')).find((t) => t.textContent === 'Nuevo título')!;
      expect(getComputedStyle(text).color).toBe('rgb(18, 171, 52)');
    });

    it('"ninguno" en el contorno lo quita', async () => {
      await start();
      await add('Agregar título');
      fireEvent.click(within(group('Contorno')).getByRole('button', { name: 'Acento 1' }));
      expect(screen.getByLabelText('Grosor del contorno')).toBeInTheDocument();
      fireEvent.click(within(group('Contorno')).getByRole('button', { name: 'Ninguno' }));
      expect(screen.queryByLabelText('Grosor del contorno')).not.toBeInTheDocument();
    });

    it('insertar un dato agrega el marcador al texto', async () => {
      await start();
      await add('Agregar texto');
      fireEvent.click(within(group('Insertar dato')).getByRole('button', { name: 'Teléfonos' }));
      expect(screen.getByLabelText('Texto')).toHaveValue('Escribe aquí {telefonos}');
    });
  });

  describe('posición, tamaño, rotación y opacidad', () => {
    it('escribir X cambia la posición en el lienzo', async () => {
      await start();
      selectLayer(/^Banner/);
      setField('X %', '20');
      expect(canvasEl('neon-p2')!.style.left).toBe('20%');
      setField('Ancho %', '50');
      expect(canvasEl('neon-p2')!.style.width).toBe('50%');
    });

    it('un valor que no es número se ignora', async () => {
      await start();
      selectLayer(/^Banner/);
      setField('X %', 'abc');
      expect(canvasEl('neon-p2')!.style.left).toBe('6%');
    });

    it('el ancho y el alto no bajan de sus mínimos (3 % y 0,3 %)', async () => {
      await start();
      selectLayer(/^Banner/);
      setField('Ancho %', '1');
      setField('Alto %', '0');
      expect(canvasEl('neon-p2')!.style.width).toBe('3%');
      expect(canvasEl('neon-p2')!.style.height).toBe('0.3%');
    });

    it('la rotación y la opacidad se aplican al elemento', async () => {
      await start();
      selectLayer(/^Banner/);
      setField('Rotación', '25');
      setField('Opacidad', '40');
      expect(canvasEl('neon-p2')!.style.transform).toBe('rotate(25deg)');
      expect(canvasEl('neon-p2')!.style.opacity).toBe('0.4');
    });
  });

  describe('insignia', () => {
    it('texto, fondo, color del texto, fuente y tamaño de 8 a 48', async () => {
      await start();
      await add('Insignia');
      expect(screen.getByLabelText('Texto')).toHaveValue('NUEVO');
      expect(group('Fondo')).toBeInTheDocument();
      expect(group('Color del texto')).toBeInTheDocument();
      expect(screen.getByLabelText('Fuente')).toBeInTheDocument();
      expect(bounds('Tamaño')).toEqual([8, 48]);
    });
  });

  describe('forma', () => {
    it('rectángulo: relleno, borde, esquinas 0–80 y resplandor; el grosor del borde de 0 a 12 solo con borde', async () => {
      await start();
      await add('Rectángulo');
      for (const g of ['Relleno', 'Borde', 'Resplandor neón']) expect(group(g)).toBeInTheDocument();
      for (const k of ['Rectángulo', 'Círculo', 'Píldora']) expect(inGroup('Forma', k)).toBeInTheDocument();
      expect(bounds('Esquinas')).toEqual([0, 80]);
      expect(screen.queryByLabelText('Grosor del borde')).not.toBeInTheDocument();
      fireEvent.click(within(group('Borde')).getByRole('button', { name: 'Acento 3' }));
      expect(bounds('Grosor del borde')).toEqual([0, 12]);
    });

    it('un círculo no tiene esquinas; al volver a rectángulo reaparecen', async () => {
      await start();
      await add('Círculo');
      expect(screen.queryByLabelText('Esquinas')).not.toBeInTheDocument();
      fireEvent.click(inGroup('Forma', 'Rectángulo'));
      expect(screen.getByLabelText('Esquinas')).toBeInTheDocument();
    });

    it('la línea es un rectángulo delgado de 0,4 % de alto con esquinas rectas', async () => {
      await start();
      await add('Línea');
      expect(screen.getByLabelText('Alto %')).toHaveValue('0.4');
      expect(inGroup('Forma', 'Rectángulo')).toHaveAttribute('aria-pressed', 'true');
      expect(range('Esquinas').value).toBe('0');
    });
  });

  describe('imagen', () => {
    it('ofrece las cinco imágenes, tres ajustes y esquinas hasta 300 (círculo)', async () => {
      await start();
      await add('Collage');
      for (const k of ['Logo', 'Collage', 'Mármol', 'Atardecer', 'Marco de portada']) expect(inGroup('Imagen', k)).toBeInTheDocument();
      for (const k of ['Contener', 'Cubrir', 'Estirar']) expect(inGroup('Ajuste', k)).toBeInTheDocument();
      expect(bounds('Esquinas')).toEqual([0, 300]);
    });

    it('cambiar la imagen y el ajuste actualiza el lienzo', async () => {
      await start();
      await add('Collage');
      fireEvent.click(inGroup('Imagen', 'Logo'));
      fireEvent.click(inGroup('Ajuste', 'Cubrir'));
      expect(canvas().querySelectorAll('img[data-src="logo"]').length).toBeGreaterThan(0);
      const added = Array.from(canvas().querySelectorAll<HTMLImageElement>('img.tpl-image')).filter((i) => i.style.objectFit === 'cover');
      expect(added.length).toBeGreaterThan(0);
    });

    it('con 300 de esquinas se avisa que es un círculo', async () => {
      await start();
      await add('Logo');
      setField('Esquinas', '300');
      expect(screen.getByTestId('inspector')).toHaveTextContent('círculo');
    });
  });

  describe('bloque de productos', () => {
    async function onProducts() {
      await start();
      goToPage('Productos');
      selectLayer(/^Productos/);
    }

    it('distribución, foto, descripción, precio y agotados con sus rangos', async () => {
      await onProducts();
      for (const k of ['Alternado', 'Tarjetas', 'Lista']) expect(inGroup('Distribución', k)).toBeInTheDocument();
      for (const g of ['Fondo de la foto', 'Anillo', 'Burbuja', 'Texto', 'Fondo', 'Borde', 'Texto del precio']) expect(group(g)).toBeInTheDocument();
      expect(bounds('Grosor del anillo')).toEqual([0, 10]);
      expect(bounds('Esquinas')).toEqual([0, 80]);
      expect(bounds('Esquinas de la burbuja')).toEqual([0, 40]);
      for (const k of ['Píldora', 'Suave', 'Recta']) expect(inGroup('Forma', k)).toBeInTheDocument();
      for (const k of ['Sello', 'Cinta', 'Gris']) expect(inGroup('Estilo', k)).toBeInTheDocument();
    });

    it('no ofrece rotación (los bloques automáticos no se giran)', async () => {
      await onProducts();
      expect(screen.queryByLabelText('Rotación')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Opacidad')).toBeInTheDocument();
    });

    it('el color de la cinta solo aparece con el estilo Cinta', async () => {
      await onProducts();
      expect(screen.queryByRole('group', { name: 'Color de la cinta' })).not.toBeInTheDocument();
      fireEvent.click(inGroup('Estilo', 'Cinta'));
      expect(group('Color de la cinta')).toBeInTheDocument();
    });

    it('cambiar la distribución y el estilo actualiza el lienzo con los tres productos de muestra, uno agotado', async () => {
      await onProducts();
      fireEvent.click(inGroup('Distribución', 'Lista'));
      expect(canvas().querySelector('.pb[data-layout="lista"]')).not.toBeNull();
      fireEvent.click(inGroup('Estilo', 'Cinta'));
      expect(canvas().querySelectorAll('[data-testid="product-card"]')).toHaveLength(3);
      expect(canvas().querySelectorAll('[data-sold-out="true"]')).toHaveLength(1);
      expect(canvas().querySelector('.pb-ribbon')).toHaveTextContent('AGOTADO');
    });
  });

  describe('políticas, introducción y pie', () => {
    it('políticas: los cuatro colores', async () => {
      await start();
      goToPage('Políticas');
      selectLayer(/^Políticas/);
      for (const g of ['Fondo del título', 'Texto del título', 'Fondo de la caja', 'Texto']) expect(group(g)).toBeInTheDocument();
    });

    it('introducción: esquinas de 0 a 60 y sus colores', async () => {
      await start();
      goToPage('Portada de sección');
      selectLayer(/^Introducción/);
      expect(bounds('Esquinas')).toEqual([0, 60]);
      expect(group('Fondo')).toBeInTheDocument();
      expect(group('Color del texto')).toBeInTheDocument();
    });

    it('pie: contenido con datos insertables, fondo, línea y su grosor de 0 a 6', async () => {
      await start();
      goToPage('Productos');
      selectLayer(/^Pie de página/);
      expect(screen.getByLabelText('Contenido')).toHaveValue('{telefonos} · {direccion}');
      expect(group('Insertar dato')).toBeInTheDocument();
      expect(group('Línea superior')).toBeInTheDocument();
      expect(bounds('Grosor de la línea')).toEqual([0, 6]);
      fireEvent.click(within(group('Insertar dato')).getByRole('button', { name: 'Tienda' }));
      expect(screen.getByLabelText('Contenido')).toHaveValue('{telefonos} · {direccion} {tienda}');
    });
  });
});

describe('fondo de la página (sin selección, FR-013)', () => {
  it('color, degradado o imagen', async () => {
    await start();
    for (const k of ['Color', 'Degradado', 'Imagen']) expect(inGroup('Fondo', k)).toBeInTheDocument();
  });

  it('de color: un solo selector; elegir un color de la paleta cambia la hoja', async () => {
    await start();
    fireEvent.click(inGroup('Fondo', 'Color'));
    fireEvent.click(within(group('Color')).getByRole('button', { name: 'Acento 2' }));
    const page = canvas().querySelector<HTMLElement>('.tpl-page')!;
    expect(page.style.backgroundColor).toBe('rgb(0, 255, 102)');
    expect(canvas().querySelector('img.tpl-bg')).toBeNull();
  });

  it('degradado: color superior e inferior', async () => {
    await start();
    fireEvent.click(inGroup('Fondo', 'Degradado'));
    expect(group('Color superior')).toBeInTheDocument();
    expect(group('Color inferior')).toBeInTheDocument();
    expect(canvas().querySelector<HTMLElement>('.tpl-page')!.style.backgroundImage).toContain('linear-gradient');
  });

  it('imagen: mármol o atardecer, con color de apoyo', async () => {
    await start();
    fireEvent.click(inGroup('Fondo', 'Imagen'));
    expect(inGroup('Imagen de fondo', 'Mármol')).toBeInTheDocument();
    fireEvent.click(inGroup('Imagen de fondo', 'Mármol'));
    expect(canvas().querySelector('img.tpl-bg')!.getAttribute('src')).toMatch(/marble/);
    expect(group('Color')).toBeInTheDocument(); // color de apoyo
  });

  it('cada página edita su propio fondo', async () => {
    await start();
    fireEvent.click(inGroup('Fondo', 'Color'));
    goToPage('Productos');
    expect(inGroup('Fondo', 'Imagen')).toHaveAttribute('aria-pressed', 'true'); // Productos sigue con el mármol
  });
});

describe('capas', () => {
  it('lista los elementos en orden de apilado (el último arriba) con nombre, tipo, visible/oculto y fijo/libre', async () => {
    await start();
    const items = within(layers()).getAllByRole('listitem');
    // Neón Noche, Portada: marco, banner, collage, domicilios y teléfonos
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('Teléfonos');
    expect(items[0]).toHaveTextContent('Texto');
    expect(items.at(-1)).toHaveTextContent('Marco');
    expect(items.at(-1)).toHaveTextContent('Imagen');
    expect(within(items.at(-1)!).getByRole('button', { name: 'Fijo' })).toBeInTheDocument(); // el marco nace bloqueado
    expect(within(items[0]!).getByRole('button', { name: 'Libre' })).toBeInTheDocument();
    expect(within(items[0]!).getByRole('button', { name: 'Visible' })).toBeInTheDocument();
  });

  it('los bloques automáticos se rotulan como tales', async () => {
    await start();
    goToPage('Productos');
    expect(within(layers()).getByText(/Bloque de productos · automático/)).toBeInTheDocument();
  });

  it('ocultar desde la lista quita el elemento del lienzo y se puede volver a mostrar', async () => {
    await start();
    const row = within(layers()).getAllByRole('listitem').find((li) => li.textContent?.includes('Banner'))!;
    fireEvent.click(within(row).getByRole('button', { name: 'Visible' }));
    expect(canvasEl('neon-p2')).toBeNull();
    expect(within(row).getByRole('button', { name: 'Oculto' })).toBeInTheDocument();
    fireEvent.click(within(row).getByRole('button', { name: 'Oculto' }));
    expect(canvasEl('neon-p2')).not.toBeNull();
  });

  it('permite seleccionar un elemento oculto y editarlo', async () => {
    await start();
    const row = within(layers()).getAllByRole('listitem').find((li) => li.textContent?.includes('Banner'))!;
    fireEvent.click(within(row).getByRole('button', { name: 'Visible' }));
    selectLayer(/^Banner/);
    expect(screen.getByTestId('inspector')).toHaveTextContent('Banner');
    setField('X %', '30');
    expect(screen.getByLabelText('X %')).toHaveValue('30');
    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeInTheDocument();
  });

  it('fijar y soltar desde la lista', async () => {
    await start();
    const row = () => within(layers()).getAllByRole('listitem').find((li) => li.textContent?.includes('Banner'))!;
    fireEvent.click(within(row()).getByRole('button', { name: 'Libre' }));
    expect(within(row()).getByRole('button', { name: 'Fijo' })).toBeInTheDocument();
    expect(canvasEl('neon-p2')).toHaveAttribute('data-locked', 'true');
  });

  it('un bloque automático no se puede ocultar desde la lista', async () => {
    await start();
    goToPage('Productos');
    const row = within(layers()).getAllByRole('listitem').find((li) => li.textContent?.includes('Bloque de productos'))!;
    fireEvent.click(within(row).getByRole('button', { name: 'Visible' }));
    expect(canvas().querySelector('[data-el-type="products"]')).not.toBeNull();
    expect(screen.getByTestId('toast')).toHaveTextContent(/ocultar/i);
  });
});

describe('acciones del elemento (FR-009)', () => {
  it('duplicar, al frente, atrás, bloquear, ocultar y eliminar', async () => {
    await start();
    selectLayer(/^Banner/);
    for (const a of ['Duplicar', 'Al frente', 'Atrás', 'Bloquear', 'Ocultar', 'Eliminar']) {
      expect(screen.getByRole('button', { name: a })).toBeInTheDocument();
    }
    click('Bloquear');
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument();
    expect(screen.queryByTestId('resize-handle')).not.toBeInTheDocument();
    click('Desbloquear');
    click('Ocultar');
    expect(canvasEl('neon-p2')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeInTheDocument();
  });

  it('eliminar quita el elemento y vuelve a la lista de capas', async () => {
    await start();
    selectLayer(/^Banner/);
    click('Eliminar');
    expect(canvasEl('neon-p2')).toBeNull();
    expect(screen.getByTestId('layers')).toBeInTheDocument();
  });

  it('un bloque automático: eliminar y duplicar explican por qué no', async () => {
    await start();
    goToPage('Productos');
    selectLayer(/^Productos/);
    click('Eliminar');
    expect(screen.getByTestId('toast')).toHaveTextContent(/obligatorio/i);
    click('Duplicar');
    expect(screen.getByTestId('toast')).toHaveTextContent(/un bloque de este tipo/i);
    click('Ocultar');
    expect(screen.getByTestId('toast')).toHaveTextContent(/ocultar/i);
    expect(canvas().querySelectorAll('[data-el-type="products"]')).toHaveLength(1);
  });

  it('al frente y atrás mueven el elemento una capa', async () => {
    await start();
    // Pila de Neón Noche (de abajo arriba): Marco, Banner, Collage, Domicilios, Teléfonos
    const order = () => within(layers()).getAllByRole('listitem').map((li) => li.querySelector('strong')?.textContent);
    expect(order()).toEqual(['Teléfonos', 'Domicilios', 'Collage', 'Banner', 'Marco']);
    selectLayer(/^Banner/);
    click('Al frente');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(order()).toEqual(['Teléfonos', 'Domicilios', 'Banner', 'Collage', 'Marco']);
    selectLayer(/^Banner/);
    click('Atrás');
    click('Atrás');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(order()).toEqual(['Teléfonos', 'Domicilios', 'Collage', 'Marco', 'Banner']);
  });
});

describe('advertencia de bloque reducido (Edge Cases)', () => {
  it('un bloque automático que llega al mínimo sin caber muestra la advertencia, sin bloquear', async () => {
    await start();
    goToPage('Productos');
    selectLayer(/^Productos/);
    expect(screen.queryByTestId('overflow-warning')).not.toBeInTheDocument();
    const bubble = canvas().querySelector('[data-part="bubble"]')!;
    bubble.setAttribute('data-overflow', 'true'); // lo escribe useFit en el navegador
    expect(await screen.findByTestId('overflow-warning')).toHaveTextContent(/mínimo legible/i);
    bubble.removeAttribute('data-overflow');
    await waitFor(() => expect(screen.queryByTestId('overflow-warning')).not.toBeInTheDocument());
  });

  it('la advertencia solo aparece para el elemento seleccionado', async () => {
    await start();
    goToPage('Productos');
    canvas().querySelector('[data-part="bubble"]')!.setAttribute('data-overflow', 'true');
    selectLayer(/^Pie de página/);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('overflow-warning')).not.toBeInTheDocument();
  });
});
