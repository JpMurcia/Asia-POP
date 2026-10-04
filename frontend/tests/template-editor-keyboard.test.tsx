import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  canvas,
  canvasEl,
  fireEvent,
  goToPage,
  layers,
  mockEditorApi,
  renderEditor,
  screen,
  selectLayer,
  within,
} from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** El Banner de Neón Noche es un texto libre en x = 6 %, y = 27,5 %. */
const BANNER = 'neon-p2';
const left = () => canvasEl(BANNER)!.style.left;
const top = () => canvasEl(BANNER)!.style.top;
const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.body, { key: k, ...init });

async function withBannerSelected() {
  mockEditorApi();
  await renderEditor();
  selectLayer(/^Banner/);
}

describe('atajos de teclado (FR-008)', () => {
  describe('flechas', () => {
    it('mueven el elemento 0,5 % de la página', async () => {
      await withBannerSelected();
      key('ArrowRight');
      expect(left()).toBe('6.5%');
      key('ArrowLeft');
      key('ArrowLeft');
      expect(left()).toBe('5.5%');
      key('ArrowDown');
      expect(top()).toBe('28%');
      key('ArrowUp');
      key('ArrowUp');
      expect(top()).toBe('27%');
    });

    it('con Mayús mueven 2 %', async () => {
      await withBannerSelected();
      key('ArrowRight', { shiftKey: true });
      expect(left()).toBe('8%');
      key('ArrowDown', { shiftKey: true });
      expect(top()).toBe('29.5%');
    });

    it('un movimiento seguido con flechas se deshace de una vez (acción continua)', async () => {
      await withBannerSelected();
      for (let i = 0; i < 4; i++) key('ArrowRight');
      expect(left()).toBe('8%');
      key('z', { ctrlKey: true });
      expect(left()).toBe('6%');
    });

    it('no mueven un elemento fijo', async () => {
      mockEditorApi();
      await renderEditor();
      selectLayer(/^Marco/); // la imagen del marco nace bloqueada
      const frame = canvasEl('neon-p1')!;
      const before = frame.style.left;
      key('ArrowRight');
      expect(frame.style.left).toBe(before);
    });

    it('sin selección no hacen nada', async () => {
      mockEditorApi();
      await renderEditor();
      key('ArrowRight');
      expect(left()).toBe('6%');
    });
  });

  describe('eliminar con Supr', () => {
    it('elimina el elemento seleccionado', async () => {
      await withBannerSelected();
      key('Delete');
      expect(canvasEl(BANNER)).toBeNull();
      expect(within(layers()).queryByRole('button', { name: /^Banner/ })).not.toBeInTheDocument();
    });

    it('Retroceso también lo elimina', async () => {
      await withBannerSelected();
      key('Backspace');
      expect(canvasEl(BANNER)).toBeNull();
    });

    it('un bloque automático no se elimina y se explica por qué', async () => {
      mockEditorApi();
      await renderEditor();
      goToPage('Productos');
      selectLayer(/^Productos/);
      key('Delete');
      expect(canvas().querySelector('[data-el-type="products"]')).not.toBeNull();
      expect(screen.getByTestId('toast')).toHaveTextContent(/obligatorio/i);
    });
  });

  describe('duplicar con Ctrl+D', () => {
    it('crea una copia desplazada, la selecciona y evita el atajo del navegador', async () => {
      await withBannerSelected();
      const texts = canvas().querySelectorAll('[data-el-type="text"]').length;
      const event = new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      // la copia queda seleccionada; sin selección se ve la lista de capas
      key('Escape');
      expect(within(layers()).getByRole('button', { name: /^Banner copia/ })).toBeInTheDocument();
      expect(canvas().querySelectorAll('[data-el-type="text"]')).toHaveLength(texts + 1);
    });

    it('con Cmd (Mac) también duplica', async () => {
      await withBannerSelected();
      key('d', { metaKey: true });
      key('Escape');
      expect(within(layers()).getByRole('button', { name: /^Banner copia/ })).toBeInTheDocument();
    });

    it('un bloque automático no se duplica', async () => {
      mockEditorApi();
      await renderEditor();
      goToPage('Productos');
      selectLayer(/^Productos/);
      key('d', { ctrlKey: true });
      expect(canvas().querySelectorAll('[data-el-type="products"]')).toHaveLength(1);
      expect(screen.getByTestId('toast')).toHaveTextContent(/un bloque de este tipo/i);
    });
  });

  describe('deshacer y rehacer', () => {
    it('Ctrl+Z deshace; Ctrl+Mayús+Z y Ctrl+Y rehacen', async () => {
      await withBannerSelected();
      key('Delete');
      expect(canvasEl(BANNER)).toBeNull();
      key('z', { ctrlKey: true });
      expect(canvasEl(BANNER)).not.toBeNull();
      key('z', { ctrlKey: true, shiftKey: true });
      expect(canvasEl(BANNER)).toBeNull();
      key('z', { ctrlKey: true });
      expect(canvasEl(BANNER)).not.toBeNull();
      key('y', { ctrlKey: true });
      expect(canvasEl(BANNER)).toBeNull();
    });

    it('con Mayús la tecla llega en mayúscula y también rehace', async () => {
      await withBannerSelected();
      key('Delete');
      key('z', { ctrlKey: true });
      key('Z', { ctrlKey: true, shiftKey: true });
      expect(canvasEl(BANNER)).toBeNull();
    });

    it('evitan el atajo del navegador', async () => {
      await withBannerSelected();
      const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe('Esc', () => {
    it('anula la selección', async () => {
      await withBannerSelected();
      expect(screen.getByTestId('selection')).toBeInTheDocument();
      key('Escape');
      expect(screen.queryByTestId('selection')).not.toBeInTheDocument();
    });
  });

  describe('mientras el usuario escribe en un campo', () => {
    it('ningún atajo actúa en un campo de texto (textarea, input y select)', async () => {
      await withBannerSelected();
      const texts = canvas().querySelectorAll('[data-el-type="text"]').length;
      const text = screen.getByLabelText('Texto') as HTMLTextAreaElement; // el contenido del texto seleccionado
      const name = screen.getByLabelText('Nombre de la plantilla');
      const font = screen.getByLabelText('Fuente');
      for (const field of [text, name, font]) {
        fireEvent.keyDown(field, { key: 'Delete' });
        fireEvent.keyDown(field, { key: 'Backspace' });
        fireEvent.keyDown(field, { key: 'ArrowRight' });
        fireEvent.keyDown(field, { key: 'd', ctrlKey: true });
        fireEvent.keyDown(field, { key: 'z', ctrlKey: true });
        fireEvent.keyDown(field, { key: 'Escape' });
      }
      expect(canvasEl(BANNER)).not.toBeNull();
      expect(left()).toBe('6%');
      expect(screen.getByTestId('selection')).toBeInTheDocument();
      expect(canvas().querySelectorAll('[data-el-type="text"]')).toHaveLength(texts); // nadie duplicó ni eliminó
    });

    it('un campo de rango del inspector tampoco deja pasar las flechas', async () => {
      await withBannerSelected();
      fireEvent.keyDown(screen.getByLabelText('Tamaño'), { key: 'ArrowRight' });
      expect(left()).toBe('6%');
    });
  });
});
