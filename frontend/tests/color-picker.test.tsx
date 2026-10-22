import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Template, WorkspaceState } from '../../backend/src/catalog/template';
import { BASE_TEMPLATES, draftText } from '../../backend/src/catalog/template-presets';
import { FREE_COLORS_SHOWN } from '../src/pages/TemplateEditor/ColorPicker';
import { usedColors } from '../src/pages/TemplateEditor/template-colors';
import { canvas, colorPanel, fireEvent, initialWorkspace, mockEditorApi, openElements, pickColor, renderEditor, screen, selectLayer, within } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 009: selector de color del inspector (colores de la plantilla, formato guardado y deshacer). */
const group = (name: string) => screen.getByRole('group', { name });
const trigger = (field: string) => within(group(field)).getByRole('button', { name: new RegExp(`^${field}: `) });
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
const canUndo = () => !(screen.getByRole('button', { name: 'Deshacer' }) as HTMLButtonElement).disabled;
const BANNER = /^Banner/;
/** Colores libres que Neón Noche ya usa de fábrica (títulos, fondos…): se suman a los que agrega cada prueba. */
const FACTORY_FREE = usedColors(BASE_TEMPLATES.find((t) => t.id === 'neon')!).length;
const textColor = (id = 'neon-p2') => getComputedStyle(canvas().querySelector<HTMLElement>(`[data-el-id="${id}"] .tpl-text`)!).color;

/** Neón Noche con dos colores libres usados en distintos elementos de la portada. */
function workspaceWithFree(free: string[] = ['#E91E8C', '#33AACC']): WorkspaceState {
  const ws = initialWorkspace();
  const neon = ws.templates.find((t) => t.id === 'neon') as Template;
  neon.pages.portada.els.push(
    ...free.map((color, i) => ({ ...draftText({ name: `Libre ${i + 1}`, text: `Libre ${i + 1}`, color, x: 5, y: 80 + i, w: 20, h: 3 }), id: `libre-${i + 1}` })),
  );
  return ws;
}
async function start(ws: WorkspaceState = workspaceWithFree()) {
  mockEditorApi({}, ws);
  await renderEditor();
  selectLayer(BANNER);
}

describe('selector de color: colores de la plantilla (US1)', () => {
  it('el botón muestra el color activo y el panel está cerrado por defecto', async () => {
    await start();
    expect(trigger('Relleno')).toHaveAttribute('aria-expanded', 'false');
    expect(trigger('Relleno')).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('«Colores de la plantilla» trae la paleta y los dos libres, sin repetir ninguno', async () => {
    await start();
    const panel = colorPanel('Relleno');
    const section = within(screen.getByRole('region', { name: 'Colores de la plantilla' }));
    for (const name of ['Fondo', 'Acento 1', 'Acento 2', 'Acento 3', 'Texto de la paleta', 'Papel', '#E91E8C', '#33AACC']) {
      expect(section.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(section.getAllByRole('button')).toHaveLength(8 + FACTORY_FREE);
    expect(panel.getByRole('region', { name: 'Colores básicos' })).toBeInTheDocument();
  });

  it('un libre repetido en varios elementos o escrito de otra forma aparece una sola vez', async () => {
    const ws = workspaceWithFree(['#e91e8c', '#E91E8C', '#abc', '#AABBCC']);
    await start(ws);
    colorPanel('Relleno');
    const section = within(screen.getByRole('region', { name: 'Colores de la plantilla' }));
    expect(section.getAllByRole('button')).toHaveLength(6 + 2 + FACTORY_FREE);
    expect(section.getAllByRole('button', { name: '#E91E8C' })).toHaveLength(1);
    expect(section.getAllByRole('button', { name: '#AABBCC' })).toHaveLength(1);
  });

  it('sin libres añadidos, el grupo trae la paleta y solo los libres que la plantilla ya usa de fábrica', async () => {
    await start(initialWorkspace());
    colorPanel('Relleno');
    const section = within(screen.getByRole('region', { name: 'Colores de la plantilla' }));
    expect(section.getAllByRole('button')).toHaveLength(6 + FACTORY_FREE);
  });

  it('elegir un color libre lo guarda como #RRGGBB en mayúsculas, con un paso de deshacer, y lo marca', async () => {
    await start();
    const before = textColor();
    pickColor('Relleno', '#E91E8C');
    expect(textColor()).toBe('rgb(233, 30, 140)');
    expect(within(screen.getByRole('region', { name: 'Colores de la plantilla' })).getByRole('button', { name: '#E91E8C' })).toHaveAttribute('aria-pressed', 'true');
    expect(trigger('Relleno')).toHaveAccessibleName('Relleno: #E91E8C');
    undo();
    expect(textColor()).toBe(before);
  });

  it('elegir un color de la paleta lo guarda como clave: sigue a la paleta si esta cambia', async () => {
    const { puts } = (() => {
      const api = mockEditorApi({}, workspaceWithFree());
      return { puts: api.puts };
    })();
    await renderEditor();
    selectLayer(BANNER);
    pickColor('Relleno', 'Acento 2');
    expect(textColor()).toBe('rgb(0, 255, 102)');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(puts()).toHaveLength(1));
    const saved = (puts()[0]!.body!.templates as Template[]).find((t) => t.id === 'neon')!;
    const banner = saved.pages.portada.els.find((e) => e.id === 'neon-p2') as unknown as { color: string };
    expect(banner.color).toBe('a2');
  });

  it('un color libre guardado se guarda tal cual, en mayúsculas', async () => {
    const api = mockEditorApi({}, workspaceWithFree());
    await renderEditor();
    selectLayer(BANNER);
    pickColor('Relleno', '#33AACC');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(api.puts()).toHaveLength(1));
    const saved = (api.puts()[0]!.body!.templates as Template[]).find((t) => t.id === 'neon')!;
    expect((saved.pages.portada.els.find((e) => e.id === 'neon-p2') as unknown as { color: string }).color).toBe('#33AACC');
  });

  it('elegir el color que ya está activo no agrega un paso de deshacer', async () => {
    await start();
    pickColor('Relleno', 'Acento 2');
    undo();
    expect(canUndo()).toBe(false);
    pickColor('Relleno', 'Acento 2');
    pickColor('Relleno', 'Acento 2');
    undo();
    expect(canUndo()).toBe(false);
  });

  it('«Ninguno» y «Transparente» siguen disponibles donde existen y se marcan', async () => {
    await start();
    // el contorno de un texto admite «Ninguno»
    pickColor('Contorno', 'Acento 1');
    colorPanel('Contorno');
    expect(screen.getByRole('button', { name: 'Ninguno' })).toHaveAttribute('aria-pressed', 'false');
    pickColor('Contorno', 'Ninguno');
    expect(screen.getByRole('button', { name: 'Ninguno' })).toHaveAttribute('aria-pressed', 'true');
    expect(trigger('Contorno')).toHaveAccessibleName('Contorno: Ninguno');
    // el relleno de un texto no tiene opción especial
    colorPanel('Relleno');
    expect(screen.queryByRole('button', { name: 'Transparente' })).not.toBeInTheDocument();
  });

  it('el selector gráfico sigue disponible y arrastrarlo es un solo paso de deshacer', async () => {
    await start();
    const picker = colorPanel('Relleno').getByLabelText('Color personalizado');
    fireEvent.change(picker, { target: { value: '#112233' } });
    fireEvent.change(picker, { target: { value: '#445566' } });
    expect(textColor()).toBe('rgb(68, 85, 102)');
    undo();
    expect(textColor()).not.toBe('rgb(68, 85, 102)');
    expect(canUndo()).toBe(false);
  });

  it('con más de 18 libres muestra 18 y «Ver todos (N)» despliega el resto', async () => {
    const many = Array.from({ length: 22 }, (_, i) => `#${(0x100000 + i * 0x010203).toString(16).toUpperCase().padStart(6, '0')}`);
    await start(workspaceWithFree(many));
    colorPanel('Relleno');
    const section = () => within(screen.getByRole('region', { name: 'Colores de la plantilla' }));
    expect(section().getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.startsWith('#'))).toHaveLength(FREE_COLORS_SHOWN);
    fireEvent.click(screen.getByRole('button', { name: `Ver todos (${22 + FACTORY_FREE})` }));
    expect(section().getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.startsWith('#'))).toHaveLength(22 + FACTORY_FREE);
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
    expect(section().getAllByRole('button').filter((b) => b.getAttribute('aria-label')?.startsWith('#'))).toHaveLength(FREE_COLORS_SHOWN);
  });

  it('el fondo de la página usa el mismo selector', async () => {
    mockEditorApi({}, workspaceWithFree());
    await renderEditor();
    fireEvent.click(within(group('Fondo')).getByRole('button', { name: 'Color' }));
    pickColor('Color', 'Acento 2');
    expect(canvas().querySelector<HTMLElement>('.tpl-page')!.style.backgroundColor).toBe('rgb(0, 255, 102)');
  });

  it('con el elemento bloqueado el botón queda deshabilitado con su indicación', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(trigger('Relleno')).toBeDisabled();
    expect(trigger('Relleno')).toHaveAttribute('title', 'Desbloquea el elemento para cambiar este ajuste');
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(trigger('Relleno')).not.toBeDisabled();
  });

  it('cambiar la paleta actualiza de inmediato la muestra del color de la paleta activo', async () => {
    await start();
    pickColor('Relleno', 'Acento 2');
    const swatch = () => within(trigger('Relleno')).getByText('Acento 2').previousElementSibling as HTMLElement;
    const before = swatch().style.background;
    expect(before).not.toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Estilo' }));
    const hex = screen.getByLabelText('Acento 2 hexadecimal');
    fireEvent.change(hex, { target: { value: '#123456' } });
    fireEvent.blur(hex);
    expect(swatch().style.background).toBe('rgb(18, 52, 86)');
  });
});

describe('selector de color: sin pérdida de capacidades', () => {
  it('cada propiedad de color de un texto nuevo abre un selector con la paleta', async () => {
    mockEditorApi();
    await renderEditor();
    openElements();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar título' }));
    for (const field of ['Relleno', 'Contorno', 'Resplandor neón']) {
      const panel = colorPanel(field);
      for (const name of ['Acento 1', 'Acento 2', 'Acento 3', 'Papel']) expect(panel.getAllByRole('button', { name }).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    }
    expect(BASE_TEMPLATES.length).toBeGreaterThan(0);
  });
});
