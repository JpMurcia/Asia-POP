import { afterEach, describe, expect, it, vi } from 'vitest';
import { PALETTE_PRESETS } from '../../backend/src/catalog/template-presets';
import {
  canvas,
  canvasEl,
  fireEvent,
  goToPage,
  mockEditorApi,
  openElements,
  renderEditor,
  saveButton,
  screen,
  selectLayer,
  setField,
  status,
  waitFor,
  within,
} from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const NEON = { bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' };
const ROWS = { bg: 'Fondo', a1: 'Acento 1', a2: 'Acento 2', a3: 'Acento 3', ink: 'Texto', paper: 'Papel' } as const;

async function start() {
  const api = mockEditorApi();
  await renderEditor();
  click('Estilo');
  return api;
}

/** El valor hexadecimal de cada fila de la paleta. */
const palette = () =>
  Object.fromEntries(
    Object.entries(ROWS).map(([key, label]) => [key, (screen.getByLabelText(`${label} hexadecimal`) as HTMLInputElement).value]),
  );

/** Color de relleno calculado del texto de un elemento del lienzo. */
const colorOf = (id: string) => getComputedStyle(canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!).color;
const fontOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!.style.fontFamily;

/** Agrega un título (color Acento 1) y devuelve su id. */
function addTitle() {
  openElements();
  click('Agregar título');
  const ids = Array.from(canvas().querySelectorAll('[data-el-type="text"]')).map((n) => n.getAttribute('data-el-id')!);
  click('Estilo');
  return ids.find((id) => !['neon-p2', 'neon-p4', 'neon-p5'].includes(id))!;
}

describe('sección Estilo: paleta (FR-014, FR-015)', () => {
  it('muestra los seis colores de la plantilla con su valor y qué afectan', async () => {
    await start();
    expect(palette()).toEqual(NEON);
    for (const label of Object.values(ROWS)) expect(screen.getByLabelText(`Color ${label}`)).toBeInTheDocument();
    expect(screen.getByText('Anillo de las fotos')).toBeInTheDocument();
    expect(screen.getByText('Fondo de las páginas')).toBeInTheDocument();
  });

  it('cambiar un color recolorea todos los elementos que lo usan y no los de color personalizado', async () => {
    await start();
    const title = addTitle(); // usa Acento 1
    expect(colorOf(title)).toBe('rgb(255, 0, 122)');
    // otro texto con un color fijo #12AB34
    openElements();
    click('Agregar texto');
    fireEvent.change(within(screen.getByRole('group', { name: 'Relleno' })).getByLabelText('Color personalizado'), { target: { value: '#12ab34' } });
    const fixed = Array.from(canvas().querySelectorAll('[data-el-type="text"]'))
      .map((n) => n.getAttribute('data-el-id')!)
      .find((id) => colorOf(id) === 'rgb(18, 171, 52)')!;
    click('Estilo');

    setField('Acento 1 hexadecimal', '#00aaff');
    expect(colorOf(title)).toBe('rgb(0, 170, 255)');
    expect(colorOf(fixed)).toBe('rgb(18, 171, 52)');
    expect(palette().a1).toBe('#00AAFF'); // queda en mayúsculas
    expect(status()).toHaveTextContent('Cambios sin guardar');
  });

  it('el selector de color nativo también cambia la paleta', async () => {
    await start();
    fireEvent.change(screen.getByLabelText('Color Acento 2'), { target: { value: '#334455' } });
    expect(palette().a2).toBe('#334455');
  });

  it('un valor que no es #RRGGBB se rechaza, se avisa y conserva el anterior', async () => {
    await start();
    setField('Acento 1 hexadecimal', 'rosa');
    expect(screen.getByRole('alert')).toHaveTextContent('Debe ser un color en formato #RRGGBB.');
    expect(status()).toHaveTextContent('Todo guardado');
    fireEvent.blur(screen.getByLabelText('Acento 1 hexadecimal'));
    expect(palette().a1).toBe('#FF007A');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    for (const bad of ['#FFF', '#12345', '#1234567', '12AB34', '#12AB3G']) {
      setField('Acento 1 hexadecimal', bad);
      expect(status()).toHaveTextContent('Todo guardado');
    }
  });

  it('una paleta sugerida reemplaza los seis colores y se deshace', async () => {
    await start();
    expect(PALETTE_PRESETS.map((p) => p.name)).toEqual(['Neón Noche', 'Pop crema', 'Kawaii', 'Kraft', 'Matcha']);
    for (const preset of PALETTE_PRESETS) expect(screen.getByRole('button', { name: `Aplicar paleta ${preset.name}` })).toBeInTheDocument();
    click('Aplicar paleta Kawaii');
    expect(palette()).toEqual(PALETTE_PRESETS.find((p) => p.name === 'Kawaii')!.palette);
    expect(status()).toHaveTextContent('Cambios sin guardar');
    click('Deshacer');
    expect(palette()).toEqual(NEON);
    expect(status()).toHaveTextContent('Todo guardado');
  });

  it('"Restaurar colores originales" vuelve a la paleta del estilo base (neon: #11052C, #FF007A, #00FF66, #FF9900)', async () => {
    await start();
    setField('Acento 1 hexadecimal', '#00AAFF');
    setField('Fondo hexadecimal', '#223344');
    click('Restaurar colores originales');
    expect(palette()).toEqual(NEON);
    expect(status()).toHaveTextContent('Todo guardado');
    click('Deshacer');
    expect(palette().bg).toBe('#223344');
  });

  it('cambiar la paleta se guarda con el conjunto', async () => {
    const api = await start();
    setField('Acento 3 hexadecimal', '#ABCDEF');
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    const neon = (api.puts()[0]!.body!.templates as { id: string; palette: Record<string, string> }[])[0]!;
    expect(neon.palette.a3).toBe('#ABCDEF');
  });
});

describe('advertencias de contraste (FR-016)', () => {
  it('no hay advertencias con la paleta de fábrica', async () => {
    await start();
    expect(screen.queryByTestId('palette-warnings')).not.toBeInTheDocument();
  });

  it('un fondo claro avisa que el texto blanco puede no leerse, pero se puede guardar', async () => {
    const api = await start();
    setField('Fondo hexadecimal', '#F5F5F5');
    expect(screen.getByTestId('palette-warnings')).toHaveTextContent('El texto blanco puede no leerse');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
  });

  it('un acento igual al fondo avisa y nombra el acento', async () => {
    await start();
    setField('Acento 2 hexadecimal', '#11052D');
    expect(screen.getByTestId('palette-warnings')).toHaveTextContent(/acento 2/i);
  });

  it('evalúa solo la paleta: un color personalizado de un elemento no cuenta', async () => {
    await start();
    openElements();
    click('Agregar título');
    fireEvent.change(within(screen.getByRole('group', { name: 'Relleno' })).getByLabelText('Color personalizado'), { target: { value: '#11052D' } });
    click('Estilo');
    expect(screen.queryByTestId('palette-warnings')).not.toBeInTheDocument();
  });

  it('las advertencias desaparecen al corregir el color', async () => {
    await start();
    setField('Fondo hexadecimal', '#F5F5F5');
    expect(screen.getByTestId('palette-warnings')).toBeInTheDocument();
    click('Restaurar colores originales');
    expect(screen.queryByTestId('palette-warnings')).not.toBeInTheDocument();
  });
});

describe('sección Estilo: tipografía (FR-017)', () => {
  const pair = (name: string) => screen.getByRole('button', { name: `Tipografía ${name}` });

  it('ofrece los cinco pares y marca el de la plantilla', async () => {
    await start();
    for (const name of ['Fredoka + Poppins', 'Bungee + Poppins', 'Zen Maru Gothic + Zen Maru Gothic', 'DM Serif Display + Space Grotesk', 'Space Grotesk + Space Grotesk']) {
      expect(pair(name)).toBeInTheDocument();
    }
    expect(pair('Fredoka + Poppins')).toHaveAttribute('aria-pressed', 'true');
    expect(pair('Bungee + Poppins')).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir un par cambia títulos y cuerpo del lienzo', async () => {
    await start();
    const banner = () => fontOf('neon-p2'); // fuente de título
    const body = () => fontOf('neon-p4'); // "Domicilios": fuente de cuerpo
    expect(banner()).toContain('Fredoka');
    expect(body()).toContain('Poppins');
    fireEvent.click(pair('Zen Maru Gothic + Zen Maru Gothic'));
    expect(banner()).toContain('Zen Maru Gothic');
    expect(body()).toContain('Zen Maru Gothic');
    expect(pair('Zen Maru Gothic + Zen Maru Gothic')).toHaveAttribute('aria-pressed', 'true');
    expect(status()).toHaveTextContent('Cambios sin guardar');
    click('Deshacer');
    expect(banner()).toContain('Fredoka');
  });

  it('no cambia los elementos con una fuente específica', async () => {
    await start();
    openElements();
    click('Agregar título');
    fireEvent.change(screen.getByLabelText('Fuente'), { target: { value: 'grotesk' } });
    const id = Array.from(canvas().querySelectorAll('[data-el-type="text"]'))
      .map((n) => n.getAttribute('data-el-id')!)
      .find((i) => fontOf(i).includes('Space Grotesk'))!;
    click('Estilo');
    fireEvent.click(pair('Bungee + Poppins'));
    expect(fontOf('neon-p2')).toContain('Bungee');
    expect(fontOf(id)).toContain('Space Grotesk');
  });

  it('cada página usa los dos pares al cambiar de página', async () => {
    await start();
    fireEvent.click(pair('Bungee + Poppins'));
    goToPage('Portada de sección');
    selectLayer(/^Nombre de sección/);
    expect(screen.getByLabelText('Fuente')).toHaveValue('title');
    expect(within(screen.getByLabelText('Fuente')).getByRole('option', { name: 'Título · Bungee' })).toBeInTheDocument();
  });
});
