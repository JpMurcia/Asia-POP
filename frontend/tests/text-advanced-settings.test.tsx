import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasEl, fireEvent, mockEditorApi, renderEditor, screen, selectLayer } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 008: ajustes avanzados de texto en el inspector (altura de línea, espaciado y anclaje). */
const slider = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const field = (label: string) => screen.getByLabelText(`${label} (valor)`) as HTMLInputElement;
const textOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!;
const BANNER = 'neon-p2'; // el texto «Banner» de la portada de Neón Noche

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
