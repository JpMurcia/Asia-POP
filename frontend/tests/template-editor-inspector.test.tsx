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

describe('bloque de productos: tamaño de los productos (feature 007)', () => {
  const BLOCK = 'neon-c3'; // el bloque de productos de Neón Noche
  const inspector = () => screen.getByTestId('inspector');
  const headings = () => Array.from(inspector().querySelectorAll('.ed-heading')).map((h) => h.textContent);
  const sizeField = (groupName: string, label: string) => within(group(groupName)).getByLabelText(label) as HTMLInputElement;
  /** Escribe el valor y lo confirma al salir del campo, como hace la persona. */
  const commit = (groupName: string, label: string, value: string) => {
    const input = sizeField(groupName, label);
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  };

  async function onProducts() {
    await start();
    goToPage('Productos');
    selectLayer(/^Productos/);
  }

  it('la primera sección es «Tamaño de los productos», con dos pares de Ancho % y Alto % de nombre accesible distinto', async () => {
    await onProducts();
    expect(headings()[0]).toBe('Tamaño de los productos');
    for (const g of ['Zona de productos', 'Tamaño de la foto']) {
      expect(within(group(g)).getByLabelText('Ancho %')).toBeInTheDocument();
      expect(within(group(g)).getByLabelText('Alto %')).toBeInTheDocument();
    }
    // los valores de fábrica de Neón Noche
    expect(sizeField('Zona de productos', 'Ancho %')).toHaveValue('100');
    expect(sizeField('Zona de productos', 'Alto %')).toHaveValue('85.2');
    expect(sizeField('Tamaño de la foto', 'Ancho %')).toHaveValue('100');
    expect(sizeField('Tamaño de la foto', 'Alto %')).toHaveValue('100');
    expect(screen.getAllByLabelText('Ancho %')).toHaveLength(2);
  });

  it('trae la nota fija sobre desbloquear y el botón «Restaurar tamaños originales»', async () => {
    await onProducts();
    expect(within(inspector()).getByText('Para arrastrar la zona en la página, pulsa Desbloquear.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restaurar tamaños originales' })).toBeInTheDocument();
  });

  it('los campos de la zona funcionan con el bloque fijo, sin desbloquearlo', async () => {
    await onProducts();
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument();
    commit('Zona de productos', 'Ancho %', '80');
    commit('Zona de productos', 'Alto %', '60');
    expect(canvasEl(BLOCK)!.style.width).toBe('80%');
    expect(canvasEl(BLOCK)!.style.height).toBe('60%');
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument();
  });

  it('un valor se confirma con Enter o al salir del campo, no a cada tecla', async () => {
    await onProducts();
    const input = sizeField('Zona de productos', 'Ancho %');
    fireEvent.change(input, { target: { value: '7' } });
    expect(canvasEl(BLOCK)!.style.width).toBe('100%');
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(canvasEl(BLOCK)!.style.width).toBe('70%');
  });

  it('el ancho y el alto de la foto cambian el tamaño de las fotos del lienzo', async () => {
    await onProducts();
    const photoWidth = () => canvas().querySelector<HTMLElement>('[data-part="photo"]')!.style.width;
    const before = Number.parseFloat(photoWidth());
    commit('Tamaño de la foto', 'Ancho %', '80');
    expect(Number.parseFloat(photoWidth())).toBeCloseTo(before * 0.8, 1);
  });

  it('un alto de foto mayor que el máximo se recorta y la nota (role="status") lo explica', async () => {
    await onProducts();
    commit('Tamaño de la foto', 'Alto %', '150');
    const max = Number(sizeField('Tamaño de la foto', 'Alto %').value);
    expect(max).toBeGreaterThanOrEqual(100);
    expect(max).toBeLessThan(150);
    const note = within(inspector()).getByText(`El alto máximo de la foto en esta zona es ${max} %. Agranda el alto de la zona para darle más espacio.`);
    expect(note).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('toast')).toHaveTextContent(/El alto máximo de la foto/);
  });

  it('en tarjetas, un ancho de foto mayor que el máximo se recorta con su nota', async () => {
    await onProducts();
    fireEvent.click(inGroup('Distribución', 'Tarjetas'));
    commit('Tamaño de la foto', 'Ancho %', '150');
    const max = Number(sizeField('Tamaño de la foto', 'Ancho %').value);
    expect(max).toBeLessThan(150);
    expect(within(inspector()).getByText(`El ancho máximo de la foto en esta zona es ${max} %. Agranda la zona para darle más espacio.`)).toBeInTheDocument();
  });

  it('un valor dentro de los límites no muestra nota', async () => {
    await onProducts();
    commit('Tamaño de la foto', 'Ancho %', '90');
    expect(within(inspector()).queryByText(/máximo de la foto/)).not.toBeInTheDocument();
    expect(within(inspector()).queryByText(/La zona de productos debe medir/)).not.toBeInTheDocument();
  });

  it('una zona más pequeña que el mínimo queda en 40 % y 30 % con su nota', async () => {
    await onProducts();
    commit('Zona de productos', 'Ancho %', '20');
    expect(sizeField('Zona de productos', 'Ancho %')).toHaveValue('40');
    expect(canvasEl(BLOCK)!.style.width).toBe('40%');
    const note = within(inspector()).getByText('La zona de productos debe medir al menos 40 % de ancho y 30 % de alto.');
    expect(note).toHaveAttribute('role', 'status');
    commit('Zona de productos', 'Ancho %', '60');
    expect(within(inspector()).queryByText(/La zona de productos debe medir/)).not.toBeInTheDocument();
  });

  it('la nota se explica sola si lo guardado queda por encima del máximo al cambiar la distribución', async () => {
    await onProducts();
    commit('Tamaño de la foto', 'Ancho %', '140'); // alternado admite 150
    expect(within(inspector()).queryByText(/El ancho máximo/)).not.toBeInTheDocument();
    fireEvent.click(inGroup('Distribución', 'Tarjetas'));
    // se dibuja recortada, pero lo guardado sigue siendo 140
    expect(sizeField('Tamaño de la foto', 'Ancho %')).toHaveValue('140');
    expect(within(inspector()).getByText(/El ancho máximo de la foto en esta zona es \d+ %\./)).toBeInTheDocument();
  });

  it('las secciones siguen en orden y al final solo quedan X % e Y % bajo «Posición»', async () => {
    await onProducts();
    const h = headings();
    expect(h).toEqual(expect.arrayContaining(['Tamaño de los productos', 'Foto del producto', 'Descripción', 'Precio', 'Agotados', 'Posición']));
    expect(h.indexOf('Tamaño de los productos')).toBe(0);
    expect(h.indexOf('Foto del producto')).toBeLessThan(h.indexOf('Descripción'));
    expect(h.indexOf('Descripción')).toBeLessThan(h.indexOf('Precio'));
    expect(h.indexOf('Precio')).toBeLessThan(h.indexOf('Agotados'));
    expect(h.at(-1)).toBe('Posición');
    expect(h).not.toContain('Posición y tamaño');
    expect(screen.getByLabelText('X %')).toBeInTheDocument();
    expect(screen.getByLabelText('Y %')).toBeInTheDocument();
    // el ancho y el alto de la zona ya no se repiten fuera de «Tamaño de los productos»
    expect(screen.getAllByLabelText('Alto %')).toHaveLength(2);
  });

  it('«Restaurar tamaños originales» deja los cuatro valores como los de fábrica', async () => {
    await onProducts();
    commit('Zona de productos', 'Ancho %', '70');
    commit('Zona de productos', 'Alto %', '50');
    commit('Tamaño de la foto', 'Ancho %', '70');
    commit('Tamaño de la foto', 'Alto %', '60');
    click('Restaurar tamaños originales');
    expect(sizeField('Zona de productos', 'Ancho %')).toHaveValue('100');
    expect(sizeField('Zona de productos', 'Alto %')).toHaveValue('85.2');
    expect(sizeField('Tamaño de la foto', 'Ancho %')).toHaveValue('100');
    expect(sizeField('Tamaño de la foto', 'Alto %')).toHaveValue('100');
  });

  it('con otro tipo de elemento el inspector sigue mostrando «Posición y tamaño» con X, Y, ancho y alto', async () => {
    await start();
    selectLayer(/^Banner/);
    expect(headings()).toContain('Posición y tamaño');
    for (const n of ['X %', 'Y %', 'Ancho %', 'Alto %']) expect(screen.getByLabelText(n)).toBeInTheDocument();
    expect(headings()).not.toContain('Tamaño de los productos');
  });
});

describe('bloque de productos: nombre del producto (feature 007)', () => {
  const inspector = () => screen.getByTestId('inspector');
  const headings = () => Array.from(inspector().querySelectorAll('.ed-heading')).map((h) => h.textContent);

  async function onProducts() {
    await start();
    goToPage('Productos');
    selectLayer(/^Productos/);
  }
  const nameTag = () => canvas().querySelector('[data-part="name"]');

  it('la sección «Nombre del producto» va entre la distribución y «Foto del producto»', async () => {
    await onProducts();
    const h = headings();
    expect(h).toContain('Nombre del producto');
    expect(h.indexOf('Nombre del producto')).toBeGreaterThan(h.indexOf('Tamaño de los productos'));
    expect(h.indexOf('Nombre del producto')).toBeLessThan(h.indexOf('Foto del producto'));
    const order = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(order(group('Distribución'), screen.getByText('Nombre del producto', { selector: '.ed-heading' }))).toBeTruthy();
  });

  it('el estilo se elige entre Separado y En la burbuja, y cambia el lienzo', async () => {
    await onProducts();
    // Neón Noche viene con el nombre separado
    expect(inGroup('Estilo del nombre', 'Separado')).toHaveAttribute('aria-pressed', 'true');
    expect(nameTag()).not.toBeNull();
    fireEvent.click(inGroup('Estilo del nombre', 'En la burbuja'));
    expect(inGroup('Estilo del nombre', 'En la burbuja')).toHaveAttribute('aria-pressed', 'true');
    expect(nameTag()).toBeNull();
    expect(canvas().querySelector('[data-part="bubble"] .pb-name')).not.toBeNull();
    fireEvent.click(inGroup('Estilo del nombre', 'Separado'));
    expect(nameTag()).not.toBeNull();
  });

  it('«Fondo del rótulo» y «Resplandor neón» solo aparecen con el estilo Separado', async () => {
    await onProducts();
    expect(group('Color del nombre')).toBeInTheDocument();
    expect(group('Fondo del rótulo')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Resplandor neón' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(inGroup('Estilo del nombre', 'En la burbuja'));
    expect(group('Color del nombre')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Fondo del rótulo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Resplandor neón' })).not.toBeInTheDocument();
  });

  it('los colores se eligen entre los de la paleta y cambian el rótulo', async () => {
    await onProducts();
    fireEvent.click(within(group('Color del nombre')).getByRole('button', { name: 'Acento 2' }));
    expect(within(group('Color del nombre')).getByRole('button', { name: 'Acento 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(getComputedStyle(nameTag() as HTMLElement).color).toBe('rgb(0, 255, 102)');
    fireEvent.click(within(group('Fondo del rótulo')).getByRole('button', { name: 'Transparente' }));
    expect(getComputedStyle(nameTag() as HTMLElement).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('el interruptor de resplandor se apaga y se prende', async () => {
    await onProducts();
    const glow = () => screen.getByRole('switch', { name: 'Resplandor neón' });
    fireEvent.click(glow());
    expect(glow()).toHaveAttribute('aria-checked', 'false');
    expect((nameTag() as HTMLElement).style.textShadow).toBe('');
    fireEvent.click(glow());
    expect(glow()).toHaveAttribute('aria-checked', 'true');
  });

  it('el estilo de agotado conserva su propio grupo «Estilo» (sin chocar con el del nombre)', async () => {
    await onProducts();
    expect(inGroup('Estilo', 'Sello')).toBeInTheDocument();
    expect(screen.getAllByRole('group', { name: 'Estilo' })).toHaveLength(1);
  });
});

describe('alinear a la página (feature 007)', () => {
  const LABELS = [
    'Alinear a la izquierda',
    'Centrar horizontalmente',
    'Alinear a la derecha',
    'Alinear arriba',
    'Centrar verticalmente',
    'Alinear abajo',
  ];

  it('con un elemento seleccionado muestra los seis botones en orden', async () => {
    await start();
    selectLayer(/^Banner/);
    const buttons = within(group('Alinear a la página')).getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(LABELS);
  });

  it('mueve el elemento en el lienzo y el campo X sigue la posición', async () => {
    await start();
    selectLayer(/^Banner/); // x 6, ancho 88
    fireEvent.click(inGroup('Alinear a la página', 'Alinear a la izquierda'));
    expect(canvasEl('neon-p2')!.style.left).toBe('0%');
    expect(screen.getByLabelText('X %')).toHaveValue('0');
    fireEvent.click(inGroup('Alinear a la página', 'Centrar horizontalmente'));
    expect(canvasEl('neon-p2')!.style.left).toBe('6%');
    fireEvent.click(inGroup('Alinear a la página', 'Alinear abajo'));
    expect(canvasEl('neon-p2')!.style.top).toBe('91.8%');
  });

  it('con el elemento bloqueado los seis quedan deshabilitados y explican por qué', async () => {
    await start();
    selectLayer(/^Banner/);
    click('Bloquear');
    for (const b of within(group('Alinear a la página')).getAllByRole('button')) {
      expect(b).toBeDisabled();
      expect(b).toHaveAttribute('title', 'Desbloquea el elemento para alinearlo');
    }
  });

  it('sin selección no se muestran', async () => {
    await start();
    expect(screen.queryByRole('group', { name: 'Alinear a la página' })).not.toBeInTheDocument();
  });
});

describe('altura de línea de un texto (feature 007)', () => {
  const lineHeightOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!.style.lineHeight;

  it('aparece después de Espaciado, de 0.8 a 2.5 en pasos de 0.05, y muestra 1.05 si el texto no la tiene', async () => {
    await start();
    selectLayer(/^Banner/);
    const labels = Array.from(screen.getByTestId('inspector').querySelectorAll('input[type="range"]')).map((i) => i.getAttribute('aria-label'));
    expect(labels.indexOf('Altura de línea')).toBe(labels.indexOf('Espaciado') + 1);
    expect(bounds('Altura de línea')).toEqual([0.8, 2.5]);
    expect(range('Altura de línea').step).toBe('0.05');
    expect(Number(range('Altura de línea').value)).toBe(1.05);
  });

  it('moverla cambia el texto en el lienzo y un deslizamiento continuo se deshace en un paso', async () => {
    await start();
    selectLayer(/^Banner/);
    fireEvent.change(range('Altura de línea'), { target: { value: '1.5' } });
    fireEvent.change(range('Altura de línea'), { target: { value: '2' } });
    expect(lineHeightOf('neon-p2')).toBe('2');
    click('Deshacer');
    expect(lineHeightOf('neon-p2')).toBe('1.05');
  });
});

describe('tachado de un texto (feature 007)', () => {
  const decorationOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!.style.textDecorationLine;
  const strike = () => screen.getByRole('switch', { name: 'Tachado' });

  it('aparece después de Mayúsculas, apagado si el texto no lo tiene', async () => {
    await start();
    selectLayer(/^Banner/);
    const switches = screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'));
    expect(switches.indexOf('Tachado')).toBe(switches.indexOf('Mayúsculas') + 1);
    expect(strike()).toHaveAttribute('aria-checked', 'false');
  });

  it('activarlo tacha el texto en el lienzo y deshacer lo quita', async () => {
    await start();
    selectLayer(/^Banner/);
    fireEvent.click(strike());
    expect(strike()).toHaveAttribute('aria-checked', 'true');
    expect(decorationOf('neon-p2')).toBe('line-through');
    click('Deshacer');
    expect(decorationOf('neon-p2')).toBe('');
  });
});
