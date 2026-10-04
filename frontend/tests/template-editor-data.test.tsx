import { afterEach, describe, expect, it, vi } from 'vitest';
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
const group = (name: string) => screen.getByRole('group', { name });
const x = (n: number) => 'x'.repeat(n);

async function start() {
  const api = mockEditorApi();
  await renderEditor();
  click('Datos');
  return api;
}

const titles = () => screen.queryAllByLabelText('Título de la política') as HTMLInputElement[];
const bodies = () => screen.queryAllByLabelText('Texto de la política') as HTMLTextAreaElement[];
const setBody = (i: number, value: string) => fireEvent.change(bodies()[i]!, { target: { value } });

describe('sección Datos (FR-023)', () => {
  it('muestra el nombre de la tienda, el banner, los dos teléfonos, la dirección y las políticas del negocio', async () => {
    await start();
    expect(screen.getByLabelText('Nombre de la tienda')).toHaveValue('ASIANPOP MARKET+');
    expect(screen.getByLabelText('Texto del banner de portada')).toHaveValue('Catálogo de productos');
    expect(screen.getByLabelText('Teléfono 1')).toHaveValue('310 669 0585');
    expect(screen.getByLabelText('Teléfono 2')).toHaveValue('318 807 0709');
    expect(screen.getByLabelText('Dirección')).toHaveValue('Cra 10 # 18-15 centro');
    expect(titles().map((t) => t.value)).toEqual([
      'Pedidos y Anticipación',
      'Pagos y Cancelaciones',
      'Entregas y Envíos',
      'Conservación (¡Muy Importante!)',
    ]);
  });

  it('el banner explica que se puede cambiar solo para una generación', async () => {
    await start();
    expect(screen.getByText(/En Generar catálogo se puede cambiar solo para esa vez/)).toBeInTheDocument();
  });

  it('cambiar un dato cuenta como cambio sin guardar y se puede deshacer', async () => {
    await start();
    setField('Teléfono 2', '300 111 2222');
    expect(status()).toHaveTextContent('Cambios sin guardar');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByLabelText('Teléfono 2')).toHaveValue('318 807 0709');
    expect(status()).toHaveTextContent('Todo guardado');
  });
});

describe('los datos se reflejan al instante (FR-004)', () => {
  it('editar un teléfono actualiza el lienzo', async () => {
    await start();
    expect(canvasEl('neon-p5')).toHaveTextContent('310 669 0585 · 318 807 0709');
    setField('Teléfono 2', '300 111 2222');
    expect(canvasEl('neon-p5')).toHaveTextContent('310 669 0585 · 300 111 2222');
  });

  it('editar un teléfono actualiza la vista previa y las miniaturas', async () => {
    await start();
    setField('Teléfono 1', '311 000 0000');
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa' }));
    expect(screen.getByTestId('preview-portada')).toHaveTextContent('311 000 0000 · 318 807 0709');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByTestId('thumb-portada')).toHaveTextContent('311 000 0000');
  });

  it('con el segundo teléfono vacío, {telefonos} muestra solo uno, sin separador sobrante', async () => {
    await start();
    setField('Teléfono 2', '');
    expect(canvasEl('neon-p5')!.textContent).toBe('310 669 0585');
    setField('Teléfono 1', '');
    setField('Teléfono 2', '318 807 0709');
    expect(canvasEl('neon-p5')!.textContent).toBe('318 807 0709');
  });

  it('el banner y la dirección se reflejan en la portada', async () => {
    await start();
    setField('Texto del banner de portada', 'Navidad 2026');
    expect(canvas()).toHaveTextContent('Navidad 2026');
    goToPage('Productos');
    setField('Dirección', 'Calle 1 # 2-3');
    expect(canvas()).toHaveTextContent('Calle 1 # 2-3');
  });

  it('las políticas del bloque de políticas siguen a lo que se escribe', async () => {
    await start();
    fireEvent.change(titles()[0]!, { target: { value: 'Garantía total' } });
    goToPage('Políticas');
    expect(canvas()).toHaveTextContent('Garantía total');
  });
});

describe('límites y contadores', () => {
  it('un banner de 80 caracteres es válido; uno de 81 pone el contador en alerta y deshabilita Guardar', async () => {
    await start();
    setField('Texto del banner de portada', x(80));
    expect(screen.getByTestId('count-coverTitle')).toHaveTextContent('80/80');
    expect(screen.getByTestId('count-coverTitle')).not.toHaveAttribute('data-alert');
    expect(saveButton()).toBeEnabled();

    setField('Texto del banner de portada', x(81));
    expect(screen.getByTestId('count-coverTitle')).toHaveTextContent('81/80');
    expect(screen.getByTestId('count-coverTitle')).toHaveAttribute('data-alert', 'true');
    expect(screen.getByText('El texto del banner: máximo 80 caracteres.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    setField('Texto del banner de portada', x(80));
    expect(saveButton()).toBeEnabled();
  });

  it('un banner vacío no se puede guardar', async () => {
    await start();
    setField('Texto del banner de portada', '  ');
    expect(screen.getByText('El texto del banner no puede estar vacío.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('el contador de políticas suma los caracteres y avisa al pasar de 3500', async () => {
    await start();
    expect(screen.getByTestId('terms-count')).toHaveTextContent(/^\d+ \/ 3500 caracteres$/);
    expect(screen.getByTestId('terms-count')).not.toHaveAttribute('data-alert');
    for (let i = 0; i < 3; i++) setBody(i, x(1200)); // 3 × 1200 + lo que tenga la cuarta
    expect(screen.getByTestId('terms-count')).toHaveTextContent(/\/ 3500 caracteres · no caben en una página$/);
    expect(screen.getByTestId('terms-count')).toHaveAttribute('data-alert', 'true');
    expect(saveButton()).toBeDisabled();
    setBody(0, x(100));
    expect(screen.getByTestId('terms-count')).not.toHaveAttribute('data-alert');
    expect(saveButton()).toBeEnabled();
  });

  it('un texto de política de más de 1200 caracteres no se puede guardar', async () => {
    await start();
    setBody(0, x(1201));
    expect(saveButton()).toBeDisabled();
    expect(screen.getByText('El texto de la política 1: máximo 1200 caracteres.')).toBeInTheDocument();
  });

  it('un título de política vacío no se puede guardar', async () => {
    await start();
    fireEvent.change(titles()[1]!, { target: { value: '' } });
    expect(screen.getByText('El título de la política 2 no puede estar vacío.')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it('el aviso de la barra explica por qué no se puede guardar', async () => {
    await start();
    setField('Texto del banner de portada', x(81));
    expect(saveButton()).toHaveAttribute('title', 'El texto del banner: máximo 80 caracteres.');
  });
});

describe('agregar y quitar políticas', () => {
  it('agregar crea una política con título para completar', async () => {
    await start();
    click('Agregar política');
    expect(titles()).toHaveLength(5);
    expect(titles().at(-1)!.value).toBe('Nueva política');
    expect(bodies().at(-1)!.value).toBe('');
    expect(status()).toHaveTextContent('Cambios sin guardar');
  });

  it('quitar saca esa política y las demás conservan su orden', async () => {
    await start();
    click('Quitar política 2');
    expect(titles().map((t) => t.value)).toEqual(['Pedidos y Anticipación', 'Entregas y Envíos', 'Conservación (¡Muy Importante!)']);
  });

  it('una política agregada aparece en la página Políticas', async () => {
    await start();
    click('Agregar política');
    fireEvent.change(titles().at(-1)!, { target: { value: 'Garantía' } });
    setBody(titles().length - 1, 'Cambios dentro de 5 días.');
    goToPage('Políticas');
    expect(canvas()).toHaveTextContent('Garantía');
    expect(canvas()).toHaveTextContent('Cambios dentro de 5 días.');
  });

  it('hay un máximo de 10 políticas', async () => {
    await start();
    for (let i = 0; i < 6; i++) click('Agregar política');
    expect(titles()).toHaveLength(10);
    expect(screen.getByRole('button', { name: 'Agregar política' })).toBeDisabled();
    expect(screen.getByText(/Máximo 10 políticas/)).toBeInTheDocument();
  });

  it('quitar todas deja la lista vacía y se puede guardar', async () => {
    await start();
    for (let i = 0; i < 4; i++) click('Quitar política 1');
    expect(titles()).toHaveLength(0);
    expect(saveButton()).toBeEnabled();
  });
});

describe('datos insertables (FR-024)', () => {
  it('en un texto: el chip agrega el marcador', async () => {
    await start();
    openElements();
    click('Agregar texto');
    fireEvent.click(within(group('Insertar dato')).getByRole('button', { name: 'Dirección' }));
    expect(screen.getByLabelText('Texto')).toHaveValue('Escribe aquí {direccion}');
  });

  it('en una insignia: el chip agrega el marcador', async () => {
    await start();
    openElements();
    click('Insignia');
    fireEvent.click(within(group('Insertar dato')).getByRole('button', { name: 'Tienda' }));
    expect(screen.getByLabelText('Texto')).toHaveValue('NUEVO {tienda}');
    expect(canvas()).toHaveTextContent('NUEVO ASIANPOP MARKET+');
  });

  it('en el pie: el chip agrega el marcador', async () => {
    await start();
    goToPage('Productos');
    selectLayer(/^Pie de página/);
    fireEvent.click(within(group('Insertar dato')).getByRole('button', { name: 'Banner' }));
    expect(screen.getByLabelText('Contenido')).toHaveValue('{telefonos} · {direccion} {banner}');
  });

  it('en Elementos, "Datos del catálogo" crea un texto con el marcador y lo selecciona', async () => {
    await start();
    openElements();
    fireEvent.click(within(group('Datos del catálogo')).getByRole('button', { name: 'Teléfonos' }));
    expect(screen.getByLabelText('Texto')).toHaveValue('{telefonos}');
    expect(screen.getByTestId('inspector')).toHaveTextContent('Teléfonos');
    const added = Array.from(canvas().querySelectorAll('[data-el-type="text"]')).filter((n) => n.textContent === '310 669 0585 · 318 807 0709');
    expect(added.length).toBeGreaterThanOrEqual(2); // el de la plantilla y el nuevo
  });

  it.each([
    ['Banner', '{banner}'],
    ['Sección', '{seccion}'],
    ['Teléfonos', '{telefonos}'],
    ['Dirección', '{direccion}'],
    ['Tienda', '{tienda}'],
  ])('el chip %s crea un texto con %s', async (label, marker) => {
    await start();
    openElements();
    fireEvent.click(within(group('Datos del catálogo')).getByRole('button', { name: label }));
    expect(screen.getByLabelText('Texto')).toHaveValue(marker);
  });

  it('{seccion} queda vacío en Portada y muestra el nombre de la sección de muestra en la portada de sección', async () => {
    await start();
    openElements();
    fireEvent.click(within(group('Datos del catálogo')).getByRole('button', { name: 'Sección' }));
    const textOf = () => Array.from(canvas().querySelectorAll<HTMLElement>('[data-el-type="text"]')).map((n) => n.textContent);
    expect(textOf()).toContain(''); // Portada: no hay sección
    expect(textOf()).not.toContain('RAMEN');
    goToPage('Portada de sección');
    openElements();
    fireEvent.click(within(group('Datos del catálogo')).getByRole('button', { name: 'Sección' }));
    expect(textOf().filter((t) => t === 'RAMEN').length).toBeGreaterThanOrEqual(2); // el de la plantilla y el nuevo
  });
});

describe('guardar los datos', () => {
  it('se envían con las plantillas', async () => {
    const api = await start();
    setField('Teléfono 2', '300 111 2222');
    click('Agregar política');
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    const business = api.puts()[0]!.body!.business as { phone2: string; terms: { title: string }[] };
    expect(business.phone2).toBe('300 111 2222');
    expect(business.terms).toHaveLength(5);
    await waitFor(() => expect(status()).toHaveTextContent('Todo guardado'));
  });

  it('un 422 de los datos se muestra y conserva lo escrito', async () => {
    mockEditorApi({
      'PUT /api/settings/templates': () =>
        new Response(JSON.stringify({ error: 'invalid_business', message: 'Los datos del negocio no son válidos.', details: [{ field: 'phone1', message: 'Máximo 30 caracteres.' }] }), { status: 422 }),
    });
    await renderEditor();
    click('Datos');
    setField('Teléfono 1', '311 000 0000');
    fireEvent.click(saveButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Máximo 30 caracteres.');
    expect(screen.getByLabelText('Teléfono 1')).toHaveValue('311 000 0000');
  });
});
