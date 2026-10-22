import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Template, WorkspaceState } from '../../backend/src/catalog/template';
import { draftBadge, draftText } from '../../backend/src/catalog/template-presets';
import { canvas, fireEvent, fontPanel, initialWorkspace, mockEditorApi, pickFont, renderEditor, screen, selectLayer, within } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 009: selector de fuente (cada familia en su tipografía, marca en la activa, buscador y guardado). */
const BANNER = /^Banner/;
const trigger = () => screen.getByRole('button', { name: /^Fuente: / });
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
const canUndo = () => !(screen.getByRole('button', { name: 'Deshacer' }) as HTMLButtonElement).disabled;
const fontOf = (id = 'neon-p2') => canvas().querySelector<HTMLElement>(`[data-el-id="${id}"] .tpl-text`)!.style.fontFamily;
const ALL = ['Fredoka', 'Poppins', 'Bungee', 'Zen Maru Gothic', 'Space Grotesk', 'DM Serif Display'];

function workspaceWithUsed(): WorkspaceState {
  const ws = initialWorkspace();
  const neon = ws.templates.find((t) => t.id === 'neon') as Template;
  neon.pages.portada.els.push({ ...draftText({ name: 'Con serif', text: 'Con serif', font: 'serif', x: 5, y: 80, w: 30, h: 4 }), id: 'con-serif' });
  return ws;
}
async function start(ws: WorkspaceState = initialWorkspace()) {
  mockEditorApi({}, ws);
  await renderEditor();
  selectLayer(BANNER);
}

describe('selector de fuente (US3)', () => {
  it('el botón muestra la fuente activa escrita en su tipografía y el panel está cerrado', async () => {
    await start();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger().getAttribute('aria-label')).toMatch(/^Fuente: Título · /);
    expect(trigger().style.fontFamily).toContain('Fredoka');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cada una de las seis familias se escribe con su propia tipografía', async () => {
    await start();
    const all = within(fontPanel().getByRole('region', { name: 'Todas las fuentes' }));
    for (const name of ALL) {
      expect(all.getByRole('button', { name }).style.fontFamily).toContain(name);
    }
    expect(all.getAllByRole('button')).toHaveLength(6);
  });

  it('«Fuentes de la plantilla» va primero: Título, Cuerpo y las familias que ya usan los elementos', async () => {
    await start(workspaceWithUsed());
    const dialog = fontPanel();
    const regions = dialog.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(regions).toEqual(['Fuentes de la plantilla', 'Todas las fuentes']);
    const own = within(dialog.getByRole('region', { name: 'Fuentes de la plantilla' })).getAllByRole('button').map((b) => b.textContent!.replace('✓', ''));
    expect(own).toEqual(['Título · Fredoka', 'Cuerpo · Poppins', 'DM Serif Display']);
  });

  it('la familia activa lleva marca de verificación y aria-pressed; Título también si el elemento sigue a la plantilla', async () => {
    await start();
    const title = fontPanel().getAllByRole('button', { name: 'Título · Fredoka' })[0]!;
    expect(title).toHaveAttribute('aria-pressed', 'true');
    expect(title).toHaveAttribute('data-check', 'true');
    expect(fontPanel().getAllByRole('button', { name: 'Cuerpo · Poppins' })[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir una familia la guarda como esa familia (un paso, y deshacer la restaura)', async () => {
    await start();
    pickFont('Bungee');
    expect(fontOf()).toContain('Bungee');
    expect(trigger()).toHaveAccessibleName('Fuente: Bungee');
    undo();
    expect(fontOf()).toContain('Fredoka');
    expect(canUndo()).toBe(false);
  });

  it('elegir «Cuerpo» o «Título» guarda la referencia, no la familia: sigue a la plantilla', async () => {
    const api = mockEditorApi({}, initialWorkspace());
    await renderEditor();
    selectLayer(BANNER);
    pickFont('Cuerpo · Poppins');
    expect(fontOf()).toContain('Poppins');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(api.puts()).toHaveLength(1));
    const saved = (api.puts()[0]!.body!.templates as Template[]).find((t) => t.id === 'neon')!;
    expect((saved.pages.portada.els.find((e) => e.id === 'neon-p2') as unknown as { font: string }).font).toBe('body');
  });

  it('una familia se guarda como esa familia', async () => {
    const api = mockEditorApi({}, initialWorkspace());
    await renderEditor();
    selectLayer(BANNER);
    pickFont('Space Grotesk');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(api.puts()).toHaveLength(1));
    const saved = (api.puts()[0]!.body!.templates as Template[]).find((t) => t.id === 'neon')!;
    expect((saved.pages.portada.els.find((e) => e.id === 'neon-p2') as unknown as { font: string }).font).toBe('grotesk');
  });

  it('elegir la fuente que ya está activa no agrega un paso de deshacer', async () => {
    await start();
    pickFont('Título · Fredoka');
    expect(canUndo()).toBe(false);
    pickFont('Bungee');
    pickFont('Bungee');
    undo();
    expect(canUndo()).toBe(false);
  });

  it.each([
    ['zen', ['Zen Maru Gothic']],
    ['DM', ['DM Serif Display']],
    ['TITULO', ['Título · Fredoka']],
  ])('buscar «%s» filtra por nombre sin importar mayúsculas ni tildes', async (typed, expected) => {
    await start();
    fontPanel();
    fireEvent.change(screen.getByLabelText('Buscar fuente'), { target: { value: typed } });
    const results = within(screen.getByRole('region', { name: 'Resultados de la búsqueda' }));
    expect(results.getAllByRole('button').map((b) => b.textContent!.replace('✓', ''))).toEqual(expected);
  });

  it('Enter en el buscador elige la primera coincidencia', async () => {
    await start();
    fontPanel();
    const search = screen.getByLabelText('Buscar fuente');
    fireEvent.change(search, { target: { value: 'bungee' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(fontOf()).toContain('Bungee');
  });

  it('una búsqueda sin coincidencias muestra un mensaje y «Limpiar búsqueda» restaura la lista', async () => {
    await start();
    fontPanel();
    fireEvent.change(screen.getByLabelText('Buscar fuente'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No hay fuentes con ese nombre')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(screen.getByRole('region', { name: 'Todas las fuentes' })).toBeInTheDocument();
  });

  it('las insignias usan el mismo selector', async () => {
    const ws = initialWorkspace();
    const neon = ws.templates.find((t) => t.id === 'neon') as Template;
    neon.pages.portada.els.push({ ...draftBadge({ name: 'Mi insignia', text: 'Nuevo', font: 'bungee' }), id: 'mi-insignia' });
    mockEditorApi({}, ws);
    await renderEditor();
    selectLayer(/^Mi insignia/);
    expect(trigger()).toHaveAccessibleName('Fuente: Bungee');
    pickFont('Poppins');
    expect(trigger()).toHaveAccessibleName('Fuente: Poppins');
  });

  it('con el elemento bloqueado el botón queda deshabilitado con su indicación', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(trigger()).toBeDisabled();
    expect(trigger()).toHaveAttribute('title', 'Desbloquea el elemento para cambiar este ajuste');
  });

  it('comparar todas las familias a la vez: las seis se ven en la misma pantalla', async () => {
    await start();
    const dialog = fontPanel();
    for (const name of ALL) expect(dialog.getAllByRole('button', { name }).length).toBeGreaterThan(0);
  });
});
