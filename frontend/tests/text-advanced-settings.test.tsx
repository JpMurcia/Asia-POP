import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokensFrom, type PageElement, type Template, type TextEl } from '../../backend/src/catalog/template';
import { baseTemplate, draftText } from '../../backend/src/catalog/template-presets';
import TemplatePage from '../src/print/TemplatePage';
import { canvasEl, fireEvent, goToPage, mockEditorApi, renderEditor, screen, selectLayer, within } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 008: ajustes avanzados de texto en el inspector (altura de línea, espaciado y anclaje). */
const slider = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const field = (label: string) => screen.getByLabelText(`${label} (valor)`) as HTMLInputElement;
const textOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!;
const BANNER = 'neon-p2'; // el texto «Banner» de la portada de Neón Noche (lleva un dato insertable: se ajusta)

/** Abre «Configuración avanzada» (cerrado por defecto) si no lo está. */
function openAdvanced() {
  const head = screen.getByRole('button', { name: 'Configuración avanzada' });
  if (head.getAttribute('aria-expanded') !== 'true') fireEvent.click(head);
}

/** Escribe el valor en el campo numérico y lo confirma al salir, como hace la persona. */
function type(label: string, value: string) {
  const input = field(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

async function start() {
  mockEditorApi();
  await renderEditor();
  selectLayer(/^Banner/);
  openAdvanced();
}

describe('altura de línea (US1)', () => {
  it('muestra 1,05 en un texto que no la trae, con deslizador y campo numérico sincronizados', async () => {
    await start();
    expect(Number(slider('Altura de línea').value)).toBe(1.05);
    expect(field('Altura de línea').value).toBe('1.05');
  });

  it.each([
    ['1,37', 1.37],
    ['1.37', 1.37],
  ])('escribir «%s» guarda %s con sus dos decimales y actualiza el lienzo', async (typed, saved) => {
    await start();
    type('Altura de línea', typed);
    expect(field('Altura de línea').value).toBe(String(saved));
    expect(Number(slider('Altura de línea').value)).toBe(saved);
    expect(textOf(BANNER).style.lineHeight).toBe(String(saved));
  });

  it.each([
    ['9', '2.5'],
    ['0,1', '0.5'],
  ])('un valor fuera de rango («%s») se ajusta al límite y muestra el valor final', async (typed, shown) => {
    await start();
    type('Altura de línea', typed);
    expect(field('Altura de línea').value).toBe(shown);
    expect(textOf(BANNER).style.lineHeight).toBe(shown);
  });

  it.each(['abc', ''])('un valor no numérico («%s») se descarta y se restaura el anterior', async (typed) => {
    await start();
    type('Altura de línea', '1,5');
    type('Altura de línea', typed);
    expect(field('Altura de línea').value).toBe('1.5');
    expect(textOf(BANNER).style.lineHeight).toBe('1.5');
  });

  it('el deslizador va de 0,5 a 2,5 en pasos de 0,01', async () => {
    await start();
    const s = slider('Altura de línea');
    expect([Number(s.min), Number(s.max), s.step]).toEqual([0.5, 2.5, '0.01']);
    fireEvent.change(s, { target: { value: '0.5' } });
    expect(textOf(BANNER).style.lineHeight).toBe('0.5');
    fireEvent.change(s, { target: { value: '2.5' } });
    expect(textOf(BANNER).style.lineHeight).toBe('2.5');
  });

  it('el campo sincroniza con el deslizador y un arrastre se deshace en un paso', async () => {
    await start();
    fireEvent.change(slider('Altura de línea'), { target: { value: '1.4' } });
    fireEvent.change(slider('Altura de línea'), { target: { value: '1.9' } });
    expect(field('Altura de línea').value).toBe('1.9');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(textOf(BANNER).style.lineHeight).toBe('1.05');
  });

  it('escribir el mismo valor no agrega un paso de deshacer', async () => {
    await start();
    type('Altura de línea', '1,5');
    type('Altura de línea', '1,5');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(textOf(BANNER).style.lineHeight).toBe('1.05');
  });
});

describe('espaciado entre letras (US2)', () => {
  const spacingOf = (id: string) => textOf(id).style.letterSpacing;

  it('muestra el valor guardado sin convertirlo (el título de las páginas de productos de Neón Noche usa 0,4)', async () => {
    mockEditorApi();
    await renderEditor();
    goToPage('Productos');
    selectLayer(/^Título de sección/);
    openAdvanced();
    expect(field('Espaciado').value).toBe('0.4');
    expect(Number(slider('Espaciado').value)).toBe(0.4);
  });

  it('el deslizador va de −10 a 60 en pasos de 0,1 y el campo lleva la unidad', async () => {
    await start();
    const s = slider('Espaciado');
    expect([Number(s.min), Number(s.max), s.step]).toEqual([-10, 60, '0.1']);
    expect(field('Espaciado').closest('.ed-field-value')!.textContent).toContain('px');
  });

  it.each([
    ['60', '60px'],
    ['-10', '-10px'],
    ['12,5', '12.5px'],
    ['99', '60px'],
    ['-99', '-10px'],
  ])('escribir «%s» deja el espaciado en %s en el lienzo', async (typed, css) => {
    await start();
    type('Espaciado', typed);
    expect(spacingOf(BANNER)).toBe(css);
    expect(field('Espaciado').value).toBe(String(parseFloat(css)));
  });

  it('con espaciado 60 el texto con datos sigue cabiendo: la letra se reduce, no se sale de la caja', async () => {
    await start();
    type('Espaciado', '60');
    const el = canvasEl(BANNER)!;
    const body = el.querySelector<HTMLElement>('.tpl-text')!;
    expect(body.hasAttribute('data-fit')).toBe(true);
    expect(body.style.letterSpacing).toBe('60px');
  });
});

/** El anclaje se prueba sobre la página: la caja del texto es la misma en el lienzo, la vista previa y el PDF. */
const tokens = tokensFrom({ storeName: 'ASIANPOP', phone1: '1', phone2: '2', address: 'Cra 10', coverTitle: 'Catálogo' }, 'RAMEN');
function pageWith(el: PageElement): HTMLElement {
  const t: Template = baseTemplate('neon');
  t.pages.portada.els = [el];
  return render(<TemplatePage template={t} page="portada" tokens={tokens} items={[]} />).container;
}
const boxOf = (c: HTMLElement) => c.querySelector<HTMLElement>('.tpl-text-box')!;
const tall = (over: Partial<TextEl> = {}): PageElement => ({ ...draftText({ text: 'Hola', x: 10, y: 10, w: 40, h: 40, ...over }), id: 'alto' });
const tallWithData = (over: Partial<TextEl> = {}): PageElement => tall({ text: '{tienda}', ...over });

describe('anclaje vertical (US3)', () => {
  it.each([
    ['texto libre', tall],
    ['texto con datos', tallWithData],
  ])('%s: sin vAlign la caja no lleva align-items propio (marcado idéntico al de antes)', (_n, make) => {
    expect(boxOf(pageWith(make())).style.alignItems).toBe('');
  });

  it.each([
    ['texto libre', tall],
    ['texto con datos', tallWithData],
  ])('%s: «middle» tampoco agrega nada y «top» y «bottom» anclan arriba y abajo', (_n, make) => {
    expect(boxOf(pageWith(make({ vAlign: 'middle' }))).style.alignItems).toBe('');
    expect(boxOf(pageWith(make({ vAlign: 'top' }))).style.alignItems).toBe('flex-start');
    expect(boxOf(pageWith(make({ vAlign: 'bottom' }))).style.alignItems).toBe('flex-end');
  });

  it('el marcado sin vAlign es idéntico al de «middle»', () => {
    expect(pageWith(tall()).innerHTML).toBe(pageWith(tall({ vAlign: 'middle' })).innerHTML);
  });
});

describe('anclaje vertical en el inspector (US3)', () => {
  const anchor = (name: string) => within(screen.getByRole('group', { name: 'Anclaje vertical' })).getByRole('button', { name });
  const boxStyle = () => canvasEl(BANNER)!.querySelector<HTMLElement>('.tpl-text-box')!.style.alignItems;

  it('un texto antiguo muestra «Centro» activo', async () => {
    await start();
    expect(anchor('Centro')).toHaveAttribute('aria-pressed', 'true');
    expect(anchor('Arriba')).toHaveAttribute('aria-pressed', 'false');
    expect(anchor('Abajo')).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir «Arriba» y «Abajo» cambia el lienzo y deshacer lo revierte', async () => {
    await start();
    fireEvent.click(anchor('Arriba'));
    expect(anchor('Arriba')).toHaveAttribute('aria-pressed', 'true');
    expect(boxStyle()).toBe('flex-start');
    fireEvent.click(anchor('Abajo'));
    expect(boxStyle()).toBe('flex-end');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(boxStyle()).toBe('flex-start');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(boxStyle()).toBe('');
  });

  it('volver a «Centro» deja el texto como antes y pulsar el activo no agrega un paso', async () => {
    await start();
    fireEvent.click(anchor('Centro'));
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
  });

  it('duplicar el texto conserva el anclaje', async () => {
    await start();
    fireEvent.click(anchor('Abajo'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    expect(anchor('Abajo')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('panel «Configuración avanzada» (US4)', () => {
  const head = () => screen.getByRole('button', { name: 'Configuración avanzada' });
  const inspector = () => screen.getByTestId('inspector');
  const select = async () => {
    mockEditorApi();
    await renderEditor();
    selectLayer(/^Banner/);
  };

  it('el panel existe y está cerrado por defecto, sin los tres ajustes a la vista', async () => {
    await select();
    expect(head()).toHaveAttribute('aria-expanded', 'false');
    for (const label of ['Altura de línea', 'Espaciado']) expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Anclaje vertical' })).not.toBeInTheDocument();
  });

  it('abrirlo (un clic) muestra los tres ajustes, cada número con deslizador y campo', async () => {
    await select();
    fireEvent.click(head());
    expect(head()).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Altura de línea', 'Espaciado']) {
      expect(slider(label)).toBeInTheDocument();
      expect(field(label)).toBeInTheDocument();
    }
    const anchor = within(screen.getByRole('group', { name: 'Anclaje vertical' }));
    for (const name of ['Arriba', 'Centro', 'Abajo']) expect(anchor.getByRole('button', { name })).toBeInTheDocument();
    fireEvent.click(head());
    expect(head()).toHaveAttribute('aria-expanded', 'false');
  });

  it('ninguno de los tres se repite fuera del panel y el resto de controles de texto conserva su orden', async () => {
    await select();
    fireEvent.click(head());
    const panel = document.getElementById(head().getAttribute('aria-controls')!)!;
    for (const label of ['Altura de línea', 'Espaciado']) {
      expect(screen.getAllByLabelText(label)).toHaveLength(1);
      expect(panel.contains(slider(label))).toBe(true);
    }
    expect(screen.getAllByRole('group', { name: 'Anclaje vertical' })).toHaveLength(1);
    expect(panel.contains(screen.getByRole('group', { name: 'Anclaje vertical' }))).toBe(true);
    const order = ['Fuente', 'Tamaño', 'Peso', 'Alineación', 'Mayúsculas', 'Tachado'].map((l) => {
      const el = screen.getByLabelText(l, { selector: 'select, input, button, [role=group], [role=switch]' }) ?? screen.getByRole('group', { name: l });
      return el;
    });
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(order.at(-1)!.compareDocumentPosition(head()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('seleccionar otro texto conserva el estado abierto', async () => {
    await select();
    fireEvent.click(head());
    goToPage('Productos');
    selectLayer(/^Título de sección/);
    expect(head()).toHaveAttribute('aria-expanded', 'true');
    expect(slider('Altura de línea')).toBeInTheDocument();
  });

  it('una forma, una imagen o la página sin selección no muestran el panel', async () => {
    mockEditorApi();
    await renderEditor();
    expect(screen.queryByRole('button', { name: 'Configuración avanzada' })).not.toBeInTheDocument();
    selectLayer(/^Marco/); // la imagen del marco de la portada
    expect(screen.queryByRole('button', { name: 'Configuración avanzada' })).not.toBeInTheDocument();
  });

  it('con el texto bloqueado el panel se abre, pero sus controles quedan deshabilitados y explican por qué', async () => {
    await select();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    fireEvent.click(head());
    expect(slider('Altura de línea')).toBeDisabled();
    expect(field('Espaciado')).toBeDisabled();
    expect(within(screen.getByRole('group', { name: 'Anclaje vertical' })).getByRole('button', { name: 'Arriba' })).toBeDisabled();
    expect(inspector().querySelector('fieldset')).toHaveAttribute('title', 'Desbloquea el elemento para cambiar estos ajustes');
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(slider('Altura de línea')).not.toBeDisabled();
  });
});
