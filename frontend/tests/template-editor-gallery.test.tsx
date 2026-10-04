import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canvasEl,
  fireEvent,
  mockEditorApi,
  renderEditor,
  saveButton,
  screen,
  selectLayer,
  setField,
  status,
  waitFor,
  within,
} from './editor-helpers';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const BASES = ['Neón Noche', 'Pop crema', 'Kawaii pastel', 'Kraft minimal'];

async function start() {
  const api = mockEditorApi();
  await renderEditor();
  return api;
}

const openGallery = () => click('Vista Plantillas');
const openEditorView = () => click('Vista Editor');
const cards = () => screen.getAllByTestId('gallery-card');
const card = (name: string) => cards().find((c) => c.getAttribute('aria-label') === name)!;
const cardNames = () => cards().map((c) => c.getAttribute('aria-label'));
const nameInput = () => screen.getByLabelText('Nombre de la plantilla') as HTMLInputElement;

/** Un cambio cualquiera en la plantilla abierta: mueve X del Banner (de Neón Noche). */
function edit(x = '20') {
  if (screen.queryByTestId('layers')) selectLayer(/^Banner/);
  setField('X %', x);
}

describe('galería de plantillas (FR-019)', () => {
  it('muestra una tarjeta por plantilla con miniaturas de portada y productos, nombre, cinco puntos, par tipográfico y marca', async () => {
    await start();
    openGallery();
    expect(cardNames()).toEqual(BASES);
    for (const c of cards()) {
      expect(within(c).getByTestId('gallery-thumb-portada')).toBeInTheDocument();
      expect(within(c).getByTestId('gallery-thumb-productos')).toBeInTheDocument();
      expect(within(c).getAllByTestId('palette-dot')).toHaveLength(5);
    }
    expect(within(card('Neón Noche')).getByText('Fredoka + Poppins')).toBeInTheDocument();
    // el par de cada plantilla ("Título + Cuerpo"); las miniaturas también tienen un "+" (ASIANPOP MARKET+), sin espacios
    expect(within(card('Kraft minimal')).getByText(/^[\p{L} ]+ \+ [\p{L} ]+$/u)).toBeInTheDocument();
    expect(within(card('Neón Noche')).getByText('Predeterminada')).toBeInTheDocument();
    expect(screen.getAllByText('Predeterminada')).toHaveLength(1);
  });

  it('los puntos llevan los colores de la paleta (fondo, tres acentos y papel)', async () => {
    await start();
    openGallery();
    const dots = within(card('Neón Noche')).getAllByTestId('palette-dot').map((d) => d.style.background);
    expect(dots).toEqual(['rgb(17, 5, 44)', 'rgb(255, 0, 122)', 'rgb(0, 255, 102)', 'rgb(255, 153, 0)', 'rgb(244, 239, 232)']);
  });

  it('la vista de galería no muestra el lienzo ni el inspector; Editor vuelve a ellos', async () => {
    await start();
    openGallery();
    expect(screen.queryByTestId('canvas-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspector')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vista Plantillas' })).toHaveAttribute('aria-pressed', 'true');
    openEditorView();
    expect(screen.getByTestId('canvas-page')).toBeInTheDocument();
    expect(screen.getByTestId('inspector')).toBeInTheDocument();
  });

  it('alternar Editor y Plantillas conserva los cambios', async () => {
    await start();
    edit();
    openGallery();
    expect(status()).toHaveTextContent('Cambios sin guardar');
    openEditorView();
    expect(status()).toHaveTextContent('Cambios sin guardar');
    expect(canvasEl('neon-p2')!.style.left).toBe('20%');
  });
});

describe('crear una plantilla (FR-020)', () => {
  it.each(BASES)('"Nueva plantilla" desde %s la crea como "Nueva · %s" y la abre', async (base) => {
    await start();
    openGallery();
    click(`Nueva plantilla desde ${base}`);
    expect(screen.getByTestId('canvas-page')).toBeInTheDocument();
    expect(nameInput().value).toBe(`Nueva · ${base}`);
    expect(status()).toHaveTextContent('Cambios sin guardar');
    openGallery();
    expect(cards()).toHaveLength(5);
    expect(cardNames().at(-1)).toBe(`Nueva · ${base}`);
  });

  it('la nueva parte de la paleta de fábrica del estilo, no de la plantilla guardada', async () => {
    await start();
    openGallery();
    click('Nueva plantilla desde Neón Noche');
    openGallery();
    const dots = within(cards().at(-1)!).getAllByTestId('palette-dot').map((d) => d.style.background);
    expect(dots[0]).toBe('rgb(17, 5, 44)');
  });

  it('no queda como predeterminada', async () => {
    await start();
    openGallery();
    click('Nueva plantilla desde Pop crema');
    openGallery();
    expect(within(cards().at(-1)!).queryByText('Predeterminada')).not.toBeInTheDocument();
    expect(within(card('Neón Noche')).getByText('Predeterminada')).toBeInTheDocument();
  });
});

describe('duplicar, usar al generar y eliminar', () => {
  it('Duplicar crea "<nombre> (copia)" independiente del original', async () => {
    await start();
    openGallery();
    fireEvent.click(within(card('Neón Noche')).getByRole('button', { name: 'Duplicar' }));
    expect(cardNames()).toEqual([...BASES, 'Neón Noche (copia)']);
    expect(screen.queryByTestId('canvas-page'), 'sigue en la galería').not.toBeInTheDocument();

    fireEvent.click(within(card('Neón Noche (copia)')).getByRole('button', { name: 'Editar' }));
    expect(nameInput().value).toBe('Neón Noche (copia)');
    edit('33');
    expect(canvasEl('neon-p2')!.style.left).toBe('33%');
    openGallery();
    fireEvent.click(within(card('Neón Noche')).getByRole('button', { name: 'Editar' }));
    expect(nameInput().value).toBe('Neón Noche');
    expect(canvasEl('neon-p2')!.style.left, 'el original no cambió').toBe('6%');
  });

  it('un nombre de 60 caracteres sigue cabiendo al duplicar', async () => {
    await start();
    setField('Nombre de la plantilla', 'N'.repeat(60));
    openGallery();
    fireEvent.click(within(card('N'.repeat(60))).getByRole('button', { name: 'Duplicar' }));
    const copy = cardNames().at(-1)!;
    expect(copy.length).toBeLessThanOrEqual(60);
    expect(copy.endsWith(' (copia)')).toBe(true);
  });

  it('"Usar al generar" mueve la marca Predeterminada', async () => {
    await start();
    openGallery();
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Usar al generar' }));
    expect(within(card('Pop crema')).getByText('Predeterminada')).toBeInTheDocument();
    expect(within(card('Neón Noche')).queryByText('Predeterminada')).not.toBeInTheDocument();
    expect(screen.getAllByText('Predeterminada')).toHaveLength(1);
    expect(status()).toHaveTextContent('Cambios sin guardar');
    expect(screen.getByTestId('toast')).toHaveTextContent('Pop crema se usará al generar');
  });

  it('la predeterminada no ofrece Eliminar ni Usar al generar', async () => {
    await start();
    openGallery();
    const def = card('Neón Noche');
    expect(within(def).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
    expect(within(def).queryByRole('button', { name: 'Usar al generar' })).not.toBeInTheDocument();
    expect(within(def).getByRole('button', { name: 'Duplicar' })).toBeInTheDocument();
    expect(within(def).getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(within(card('Kraft minimal')).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
  });

  it('Eliminar pide confirmación con el nombre y, si se rechaza, no hace nada', async () => {
    await start();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    openGallery();
    fireEvent.click(within(card('Kraft minimal')).getByRole('button', { name: 'Eliminar' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0]).toContain('Kraft minimal');
    expect(cardNames()).toEqual(BASES);
    expect(status()).toHaveTextContent('Todo guardado');
  });

  it('Eliminar con confirmación quita la plantilla', async () => {
    await start();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openGallery();
    fireEvent.click(within(card('Kraft minimal')).getByRole('button', { name: 'Eliminar' }));
    expect(cardNames()).toEqual(['Neón Noche', 'Pop crema', 'Kawaii pastel']);
    expect(status()).toHaveTextContent('Cambios sin guardar');
  });

  it('eliminar la plantilla que se está editando abre la predeterminada y lo avisa', async () => {
    await start();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openGallery();
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Editar' }));
    openGallery();
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Eliminar' }));
    expect(screen.getByTestId('toast')).toHaveTextContent(/Pop crema/);
    expect(screen.getByTestId('toast')).toHaveTextContent(/Neón Noche/);
    openEditorView();
    expect(nameInput().value).toBe('Neón Noche');
  });

  it('crear, duplicar y eliminar reinician el historial', async () => {
    await start();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const undo = () => screen.getByRole('button', { name: 'Deshacer' });

    edit();
    expect(undo()).toBeEnabled();
    openGallery();
    fireEvent.click(within(card('Neón Noche')).getByRole('button', { name: 'Duplicar' }));
    openEditorView();
    expect(undo(), 'tras duplicar').toBeDisabled();

    edit('25');
    expect(undo()).toBeEnabled();
    openGallery();
    click('Nueva plantilla desde Kraft minimal');
    expect(undo(), 'tras crear').toBeDisabled();

    openGallery();
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Editar' }));
    edit('27');
    openGallery();
    fireEvent.click(within(card('Kawaii pastel')).getByRole('button', { name: 'Eliminar' }));
    openEditorView();
    expect(undo(), 'tras eliminar').toBeDisabled();
  });

  it('cambiar de plantilla con Editar reinicia el historial y no pierde los cambios sin guardar de la anterior', async () => {
    await start();
    edit('21');
    openGallery();
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Editar' }));
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
    expect(status()).toHaveTextContent('Cambios sin guardar');
    openGallery();
    fireEvent.click(within(card('Neón Noche')).getByRole('button', { name: 'Editar' }));
    expect(canvasEl('neon-p2')!.style.left).toBe('21%');
  });
});

describe('nombre de la plantilla (FR-018)', () => {
  it('renombrar desde la barra superior actualiza la galería', async () => {
    await start();
    setField('Nombre de la plantilla', 'Navidad');
    openGallery();
    expect(cardNames()).toEqual(['Navidad', 'Pop crema', 'Kawaii pastel', 'Kraft minimal']);
  });

  it('un nombre vacío no se puede guardar y se avisa; al escribir uno válido se puede', async () => {
    await start();
    setField('Nombre de la plantilla', '');
    expect(screen.getByRole('alert')).toHaveTextContent('El nombre no puede estar vacío.');
    expect(saveButton()).toBeDisabled();
    setField('Nombre de la plantilla', '   ');
    expect(saveButton()).toBeDisabled();
    setField('Nombre de la plantilla', 'Otoño');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  it('la barra superior no deja guardar si otra plantilla quedó sin nombre', async () => {
    await start();
    setField('Nombre de la plantilla', '');
    openGallery();
    expect(saveButton()).toBeDisabled();
  });

  it('el nombre admite hasta 60 caracteres', async () => {
    await start();
    expect(nameInput().maxLength).toBe(60);
  });
});

describe('barra superior: plantilla predeterminada', () => {
  it('muestra "Predeterminada" (sin acción) en la predeterminada y "Usar al generar" en las demás', async () => {
    await start();
    expect(screen.getByRole('button', { name: 'Predeterminada' })).toBeDisabled();
    openGallery();
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Editar' }));
    click('Usar al generar');
    expect(screen.getByTestId('toast')).toHaveTextContent('Pop crema se usará al generar');
    expect(screen.getByRole('button', { name: 'Predeterminada' })).toBeDisabled();
  });

  it('en la galería la barra no muestra nombre, historial ni Vista previa', async () => {
    await start();
    openGallery();
    expect(screen.queryByLabelText('Nombre de la plantilla')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deshacer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vista previa' })).not.toBeInTheDocument();
  });
});

describe('panel Plantillas', () => {
  it('es el panel que se abre por defecto: lista las plantillas con su marca', async () => {
    await start();
    const panel = screen.getByTestId('templates-panel');
    expect(within(panel).getAllByTestId('panel-template')).toHaveLength(4);
    expect(within(panel).getByText('Predeterminada')).toBeInTheDocument();
    expect(within(panel).getAllByTestId('palette-dot')).toHaveLength(20);
  });

  it('elegir una plantilla de la lista la abre en el editor', async () => {
    await start();
    fireEvent.click(within(screen.getByTestId('templates-panel')).getByRole('button', { name: /Kawaii pastel/ }));
    expect(nameInput().value).toBe('Kawaii pastel');
    expect(within(screen.getByTestId('templates-panel')).getByRole('button', { name: /Kawaii pastel/ })).toHaveAttribute('aria-current', 'true');
  });

  it('"Ver todas" y "Nueva plantilla" llevan a la galería', async () => {
    await start();
    click('Ver todas');
    expect(screen.getByRole('button', { name: 'Vista Plantillas' })).toHaveAttribute('aria-pressed', 'true');
    openEditorView();
    fireEvent.click(within(screen.getByTestId('templates-panel')).getByRole('button', { name: 'Nueva plantilla' }));
    expect(screen.getByRole('button', { name: 'Vista Plantillas' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('guardar con varias plantillas', () => {
  it('envía las nuevas, las duplicadas, la predeterminada nueva y sin las eliminadas', async () => {
    const api = await start();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openGallery();
    click('Nueva plantilla desde Kawaii pastel');
    openGallery();
    fireEvent.click(within(card('Neón Noche')).getByRole('button', { name: 'Duplicar' }));
    fireEvent.click(within(card('Pop crema')).getByRole('button', { name: 'Usar al generar' }));
    fireEvent.click(within(card('Kraft minimal')).getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    const body = api.puts()[0]!.body as { defaultId: string; templates: { id: string; name: string; base: string }[] };
    expect(body.defaultId).toBe('pop');
    expect(body.templates.map((t) => t.name)).toEqual(['Neón Noche', 'Pop crema', 'Kawaii pastel', 'Nueva · Kawaii pastel', 'Neón Noche (copia)']);
    const created = body.templates.find((t) => t.name === 'Nueva · Kawaii pastel')!;
    expect(created.base).toBe('kawaii');
    expect(created.id).toMatch(/^t[0-9a-z]+$/);
    expect(new Set(body.templates.map((t) => t.id)).size).toBe(5);
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
  });
});
