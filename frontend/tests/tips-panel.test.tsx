import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canvasEl,
  fireEvent,
  goToPage,
  mockEditorApi,
  renderEditor,
  screen,
  selectLayer,
  setField,
  status,
  within,
} from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

const TITLES = [
  'Más espacio para los productos.',
  'El nombre en neón.',
  'Si un texto no cabe,',
  'Contraste.',
  'Mover y cambiar el tamaño.',
  'Vista previa.',
  'Guardar.',
];

const tipsButton = () => screen.getByRole('button', { name: 'Consejos' });
const open = () => fireEvent.click(tipsButton());
const dialog = () => screen.getByRole('dialog', { name: 'Consejos para Apariencia' });

async function start() {
  mockEditorApi();
  await renderEditor();
}

describe('botón «Consejos» de Apariencia', () => {
  it('está en la barra superior en la vista Editor y en la vista Plantillas, con aria-haspopup="dialog"', async () => {
    await start();
    expect(tipsButton()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(tipsButton()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Vista Plantillas' }));
    expect(tipsButton()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vista Editor' }));
    expect(tipsButton()).toBeInTheDocument();
  });

  it('queda entre el estado de guardado y «Vista previa»', async () => {
    await start();
    const order = (a: Element, b: Element) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(order(status(), tipsButton())).toBeTruthy();
    expect(order(tipsButton(), screen.getByRole('button', { name: 'Vista previa' }))).toBeTruthy();
  });

  it('al pulsarlo abre un diálogo con título y los 7 consejos, en orden', async () => {
    await start();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    open();
    const d = dialog();
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByRole('heading', { name: 'Consejos para Apariencia' })).toBeInTheDocument();
    const tips = within(d).getAllByRole('listitem');
    expect(tips).toHaveLength(7);
    tips.forEach((li, i) => expect(li, `consejo ${i + 1}`).toHaveTextContent(TITLES[i]!));
    expect(tipsButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('los consejos describen lo que existe: tamaño de los productos, nombre en neón, aviso de texto, contraste, desbloquear, vista previa y guardar', async () => {
    await start();
    open();
    const text = dialog().textContent ?? '';
    for (const phrase of [
      'Tamaño de los productos',
      'Nombre del producto',
      'el bloque lo avisa',
      'casi no se distingue del fondo',
      'Desbloquear',
      'Vista previa',
      'Un solo «Guardar» aplica todas las plantillas',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
  });
});

describe('cerrar el panel', () => {
  it('con «Cerrar» y el foco vuelve al botón «Consejos»', async () => {
    await start();
    open();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(tipsButton());
  });

  it('con Esc y el foco vuelve al botón', async () => {
    await start();
    open();
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(tipsButton());
  });

  it('pulsando fuera del panel y el foco vuelve al botón', async () => {
    await start();
    open();
    fireEvent.click(screen.getByTestId('tips-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(tipsButton());
  });

  it('pulsar dentro del panel no lo cierra', async () => {
    await start();
    open();
    fireEvent.click(within(dialog()).getByText('Contraste.'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('se puede abrir otra vez después de cerrarlo', async () => {
    await start();
    open();
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    open();
    expect(dialog()).toBeInTheDocument();
  });
});

describe('foco del panel', () => {
  it('al abrir, el foco entra al panel (en «Cerrar»)', async () => {
    await start();
    open();
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(within(dialog()).getByRole('button', { name: 'Cerrar' }));
  });

  it('Tab y Mayús+Tab circulan dentro del panel y no salen de él', async () => {
    await start();
    open();
    const d = dialog();
    const focusables = Array.from(d.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    expect(focusables.length).toBeGreaterThanOrEqual(1);
    const first = focusables[0]!;
    const last = focusables.at(-1)!;
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    // con el foco fuera del panel, Tab lo trae de vuelta
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(d, { key: 'Tab' });
    expect(d.contains(document.activeElement)).toBe(true);
  });
});

describe('no toca el estado del editor', () => {
  it('con cambios sin guardar, abrirlo y cerrarlo deja «Cambios sin guardar», el historial y la selección como estaban', async () => {
    await start();
    selectLayer(/^Banner/);
    setField('X %', '20');
    expect(status()).toHaveTextContent('Cambios sin guardar');
    const undoBefore = screen.getByRole('button', { name: 'Deshacer' });
    expect(undoBefore).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
    expect(screen.getByTestId('selection')).toBeInTheDocument();

    open();
    fireEvent.keyDown(dialog(), { key: 'Escape' });

    expect(status()).toHaveTextContent('Cambios sin guardar');
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rehacer' })).toBeDisabled();
    expect(screen.getByTestId('selection')).toBeInTheDocument();
    expect(canvasEl('neon-p2')!.style.left).toBe('20%');
    // Deshacer sigue devolviendo el cambio
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(canvasEl('neon-p2')!.style.left).toBe('6%');
  });

  it('sin cambios, abrirlo no los inventa', async () => {
    await start();
    open();
    expect(status()).toHaveTextContent('Todo guardado');
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
  });

  it('funciona también con un bloque de productos seleccionado, sin cambiar su tamaño', async () => {
    await start();
    goToPage('Productos');
    selectLayer(/^Productos/);
    open();
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(status()).toHaveTextContent('Todo guardado');
    expect(screen.getByTestId('selection')).toBeInTheDocument();
  });
});

describe('atajos del editor con el panel abierto', () => {
  it('Supr, Ctrl+D, las flechas y Ctrl+Z no actúan mientras está abierto', async () => {
    await start();
    selectLayer(/^Banner/);
    setField('X %', '20');
    open();
    const before = canvasEl('neon-p2')!.style.left;
    const elements = document.querySelectorAll('[data-el-id]').length;
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'd', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(canvasEl('neon-p2')).not.toBeNull();
    expect(canvasEl('neon-p2')!.style.left).toBe(before);
    expect(document.querySelectorAll('[data-el-id]').length).toBe(elements);
  });

  it('sin el panel abierto los atajos siguen funcionando', async () => {
    await start();
    selectLayer(/^Banner/);
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(canvasEl('neon-p2')).toBeNull();
  });

  it('al cerrar el panel los atajos vuelven a funcionar', async () => {
    await start();
    selectLayer(/^Banner/);
    open();
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(canvasEl('neon-p2')).not.toBeNull();
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(canvasEl('neon-p2')).toBeNull();
  });
});
