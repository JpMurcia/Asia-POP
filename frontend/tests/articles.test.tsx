import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifySummaryChanged } from '../src/hooks/usePanelSummary';
import Articles from '../src/pages/Articles';

vi.mock('../src/hooks/usePanelSummary', () => ({ notifySummaryChanged: vi.fn() }));

/** Pantalla Artículos de Alegra (feature 006). Contrato: specs/006-omit-alegra-articles/contracts/articles-ui.md §2. */

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

type Handler = (body: unknown) => Response | Promise<Response>;

function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ key, body });
      const handler = routes[key];
      return handler ? handler(body) : json(404, { error: 'not_found', message: 'no' });
    }),
  );
  return calls;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/articulos']}>
      <Articles />
    </MemoryRouter>,
  );

const row = (over: Record<string, unknown> = {}) => ({
  itemId: '1',
  name: 'Ramen picante',
  sectionKey: 'alegra:c1',
  sectionName: 'RAMEN',
  price: 9000,
  soldOut: false,
  omitted: false,
  bundles: [],
  ...over,
});

const items = () => [
  row(),
  row({ itemId: '2', name: 'Jamón serrano', sectionKey: 'alegra:c2', sectionName: 'SNACKS', price: 15000, soldOut: true }),
  row({ itemId: '3', name: 'Palillos', sectionKey: null, sectionName: null, price: 800 }),
];

const list = (rows = items()) => ({ 'GET /api/catalog/articles': () => json(200, { items: rows }) });
const rowOf = (name: string) => screen.getByText(name).closest('li')!;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(notifySummaryChanged).mockClear();
});

describe('Artículos de Alegra: la lista', () => {
  it('muestra el título, el subtítulo y la nota de que no cambia nada en Alegra', async () => {
    mockApi(list());
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Artículos de Alegra' })).toBeInTheDocument();
    expect(screen.getByText('Elige los artículos de Alegra que no quieres en el catálogo.')).toBeInTheDocument();
    expect(screen.getByText(/Omitir un artículo solo se guarda aquí: no cambia nada en Alegra/)).toBeInTheDocument();
    expect(screen.getByText(/quedan fuera de todos los catálogos hasta que los vuelvas a incluir/)).toBeInTheDocument();
  });

  it('mientras llega la lista se anuncia «Cargando…» sin ruido visual hasta que pasa el umbral de la pantalla de carga', async () => {
    mockApi({ 'GET /api/catalog/articles': () => new Promise<Response>(() => undefined) });
    renderPage();
    expect(await screen.findByText('Cargando…')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
  });

  it('cada fila muestra nombre, sección o «Sin categoría», precio con formato y «Agotado» solo si está agotado', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).toHaveTextContent('RAMEN');
    expect(rowOf('Ramen picante')).toHaveTextContent('$9.000');
    expect(within(rowOf('Ramen picante')).queryByText('Agotado')).not.toBeInTheDocument();
    expect(rowOf('Jamón serrano')).toHaveTextContent('SNACKS');
    expect(rowOf('Jamón serrano')).toHaveTextContent('$15.000');
    expect(within(rowOf('Jamón serrano')).getByText('Agotado')).toBeInTheDocument();
    expect(rowOf('Palillos')).toHaveTextContent('Sin categoría');
    expect(rowOf('Palillos')).toHaveTextContent('$800');
  });

  it('buscar no distingue mayúsculas ni tildes («jamon» encuentra «Jamón serrano»)', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'JAMON' } });
    expect(screen.getByText('Jamón serrano')).toBeInTheDocument();
    expect(screen.queryByText('Ramen picante')).not.toBeInTheDocument();
    expect(screen.queryByText('Palillos')).not.toBeInTheDocument();
  });

  it('sin coincidencias dice «Ningún artículo coincide con los filtros.»', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún artículo coincide con los filtros.')).toBeInTheDocument();
  });

  it('si Alegra no tiene artículos activos lo dice', async () => {
    mockApi(list([]));
    renderPage();
    expect(await screen.findByText('Alegra no tiene artículos activos.')).toBeInTheDocument();
  });
});

describe('Artículos de Alegra: omitir y volver a incluir', () => {
  it('«Omitir» cambia la fila al instante, antes de que responda el servidor, y luego envía PUT', async () => {
    let finish: (r: Response) => void = () => undefined;
    const calls = mockApi({
      ...list(),
      'PUT /api/catalog/omitted/1': () => new Promise<Response>((resolve) => (finish = resolve)),
    });
    renderPage();
    await screen.findByText('Ramen picante');

    fireEvent.click(screen.getByRole('button', { name: 'Omitir Ramen picante' }));
    // Con la petición todavía pendiente la fila ya está omitida
    expect(within(rowOf('Ramen picante')).getByText('Omitido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a incluir Ramen picante' })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'PUT /api/catalog/omitted/1')).toBe(true);

    finish(json(204));
    await waitFor(() => expect(notifySummaryChanged).toHaveBeenCalled());
    expect(within(rowOf('Ramen picante')).getByText('Omitido')).toBeInTheDocument();
  });

  it('«Volver a incluir» envía DELETE y quita la etiqueta', async () => {
    const calls = mockApi({
      ...list([row({ omitted: true })]),
      'DELETE /api/catalog/omitted/1': () => json(204),
    });
    renderPage();
    await screen.findByText('Ramen picante');
    expect(within(rowOf('Ramen picante')).getByText('Omitido')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver a incluir Ramen picante' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/catalog/omitted/1')).toBe(true));
    expect(within(rowOf('Ramen picante')).queryByText('Omitido')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Omitir Ramen picante' })).toBeInTheDocument();
    await waitFor(() => expect(notifySummaryChanged).toHaveBeenCalled());
  });

  it('si el servidor falla, la fila vuelve a su estado y se avisa (FR-002)', async () => {
    mockApi({
      ...list(),
      'PUT /api/catalog/omitted/1': () => json(500, { error: 'error', message: 'Ocurrió un error inesperado.' }),
    });
    renderPage();
    await screen.findByText('Ramen picante');

    fireEvent.click(screen.getByRole('button', { name: 'Omitir Ramen picante' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo guardar el cambio. Inténtalo de nuevo.');
    expect(within(rowOf('Ramen picante')).queryByText('Omitido')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Omitir Ramen picante' })).toBeInTheDocument();
    expect(notifySummaryChanged).not.toHaveBeenCalled();
  });

  it('el identificador viaja codificado en la dirección', async () => {
    const calls = mockApi({
      ...list([row({ itemId: 'a/b c' })]),
      'PUT /api/catalog/omitted/a%2Fb%20c': () => json(204),
    });
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.click(screen.getByRole('button', { name: 'Omitir Ramen picante' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /api/catalog/omitted/a%2Fb%20c')).toBe(true));
  });
});

describe('Artículos de Alegra: errores de Alegra (FR-015)', () => {
  it('sin conexión configurada muestra el mensaje, el enlace a la conexión y «Reintentar», sin lista', async () => {
    let calls = 0;
    mockApi({
      'GET /api/catalog/articles': () => {
        calls += 1;
        return calls === 1
          ? json(422, { error: 'alegra_not_configured', message: 'Primero configura la conexión con Alegra.' })
          : json(200, { items: items() });
      },
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Primero configura la conexión con Alegra.');
    expect(screen.getByRole('link', { name: 'Revisa la conexión con Alegra' })).toHaveAttribute('href', '/alegra');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Ramen picante')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con Alegra caído muestra el mensaje del servidor', async () => {
    mockApi({
      'GET /api/catalog/articles': () => json(502, { error: 'alegra_unreachable', message: 'No se pudo conectar con Alegra.' }),
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo conectar con Alegra.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('Artículos de Alegra: resumen y vistas «Todos» / «Omitidos» (US2)', () => {
  const summary = () => screen.getByText(/artículos? ·/);

  it('el resumen cuenta los artículos y los omitidos, con singulares', async () => {
    mockApi(list([row({ omitted: true })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(summary()).toHaveTextContent('1 artículo · 1 omitido');
  });

  it('el resumen se actualiza al omitir y al volver a incluir', async () => {
    mockApi({
      ...list(),
      'PUT /api/catalog/omitted/1': () => json(204),
      'DELETE /api/catalog/omitted/1': () => json(204),
    });
    renderPage();
    await screen.findByText('Ramen picante');
    expect(summary()).toHaveTextContent('3 artículos · 0 omitidos');

    fireEvent.click(screen.getByRole('button', { name: 'Omitir Ramen picante' }));
    expect(summary()).toHaveTextContent('3 artículos · 1 omitido');
    fireEvent.click(screen.getByRole('button', { name: 'Volver a incluir Ramen picante' }));
    expect(summary()).toHaveTextContent('3 artículos · 0 omitidos');
  });

  it('el resumen avisa a los lectores de pantalla (aria-live)', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    expect(summary()).toHaveAttribute('aria-live', 'polite');
  });

  it('las vistas son dos botones de opción con sus conteos y «Todos» viene marcada', async () => {
    mockApi(list([row({ omitted: true }), row({ itemId: '2', name: 'Jamón serrano' }), row({ itemId: '3', name: 'Palillos' })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(screen.getByRole('radio', { name: 'Todos (3)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Omitidos (1)' })).not.toBeChecked();
  });

  it('«Omitidos» muestra solo los omitidos', async () => {
    mockApi(list([row({ omitted: true }), row({ itemId: '2', name: 'Jamón serrano' })]));
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.click(screen.getByRole('radio', { name: 'Omitidos (1)' }));
    expect(screen.getByText('Ramen picante')).toBeInTheDocument();
    expect(screen.queryByText('Jamón serrano')).not.toBeInTheDocument();
  });

  it('los conteos de las vistas siguen la búsqueda y la categoría elegidas', async () => {
    mockApi(
      list([
        row({ omitted: true }),
        row({ itemId: '2', name: 'Ramen suave' }),
        row({ itemId: '3', name: 'Jamón serrano', sectionKey: 'alegra:c2', sectionName: 'SNACKS', omitted: true }),
      ]),
    );
    renderPage();
    await screen.findByText('Ramen picante');
    expect(screen.getByRole('radio', { name: 'Todos (3)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Omitidos (2)' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'ramen' } });
    expect(screen.getByRole('radio', { name: 'Todos (2)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Omitidos (1)' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^SNACKS \(/ }));
    expect(screen.getByRole('radio', { name: 'Todos (1)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Omitidos (1)' })).toBeInTheDocument();
  });

  it('sin omitidos y sin búsqueda ni categoría, la vista «Omitidos» dice «No has omitido ningún artículo.»', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.click(screen.getByRole('radio', { name: 'Omitidos (0)' }));
    expect(screen.getByText('No has omitido ningún artículo.')).toBeInTheDocument();
    expect(screen.queryByText('Ningún artículo coincide con los filtros.')).not.toBeInTheDocument();
  });

  it('con una búsqueda sin coincidencias en «Omitidos» dice «Ningún artículo coincide con los filtros.»', async () => {
    mockApi(list([row({ omitted: true }), row({ itemId: '2', name: 'Jamón serrano' })]));
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.click(screen.getByRole('radio', { name: 'Omitidos (1)' }));
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'jamon' } });
    expect(screen.getByText('Ningún artículo coincide con los filtros.')).toBeInTheDocument();
    expect(screen.queryByText('No has omitido ningún artículo.')).not.toBeInTheDocument();
  });

  it('al volver a incluir desde «Omitidos», la fila sale y el foco pasa a la siguiente o, si no hay, a las vistas', async () => {
    mockApi({
      ...list([row({ omitted: true, name: 'A omitido' }), row({ itemId: '2', name: 'B omitido', omitted: true })]),
      'DELETE /api/catalog/omitted/1': () => json(204),
      'DELETE /api/catalog/omitted/2': () => json(204),
    });
    renderPage();
    await screen.findByText('A omitido');
    fireEvent.click(screen.getByRole('radio', { name: 'Omitidos (2)' }));

    fireEvent.click(screen.getByRole('button', { name: 'Volver a incluir A omitido' }));
    await waitFor(() => expect(screen.queryByText('A omitido')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Volver a incluir B omitido' }));

    fireEvent.click(screen.getByRole('button', { name: 'Volver a incluir B omitido' }));
    await waitFor(() => expect(screen.queryByText('B omitido')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: /^Omitidos/ }));
  });
});

describe('Artículos de Alegra: nota de combos al omitir (US3, FR-011)', () => {
  it('una fila omitida que se usa en un combo lo avisa, sin bloquear nada', async () => {
    mockApi(list([row({ omitted: true, bundles: ['Combo regalo'] })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).toHaveTextContent('Está en el combo «Combo regalo». El combo no cambia.');
    expect(screen.getByRole('button', { name: 'Volver a incluir Ramen picante' })).toBeEnabled();
  });

  it('con varios combos usa el plural', async () => {
    mockApi(list([row({ omitted: true, bundles: ['Combo A', 'Combo B'] })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).toHaveTextContent('Está en los combos «Combo A» y «Combo B». Los combos no cambian.');
  });

  it('con tres combos los une con comas y una «y» al final', async () => {
    mockApi(list([row({ omitted: true, bundles: ['A', 'B', 'C'] })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).toHaveTextContent('Está en los combos «A», «B» y «C». Los combos no cambian.');
  });

  it('una fila omitida sin combos no muestra nota', async () => {
    mockApi(list([row({ omitted: true, bundles: [] })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).not.toHaveTextContent('Está en');
  });

  it('una fila que no está omitida no muestra la nota aunque se use en combos', async () => {
    mockApi(list([row({ omitted: false, bundles: ['Combo regalo'] })]));
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).not.toHaveTextContent('Está en');
  });

  it('la nota aparece al omitir la fila, sin recargar la lista', async () => {
    mockApi({ ...list([row({ bundles: ['Combo regalo'] })]), 'PUT /api/catalog/omitted/1': () => json(204) });
    renderPage();
    await screen.findByText('Ramen picante');
    expect(rowOf('Ramen picante')).not.toHaveTextContent('Está en');
    fireEvent.click(screen.getByRole('button', { name: 'Omitir Ramen picante' }));
    expect(rowOf('Ramen picante')).toHaveTextContent('Está en el combo «Combo regalo». El combo no cambia.');
  });
});

describe('Artículos de Alegra: filtro por categorías (feature 007)', () => {
  /** Tres categorías y un artículo sin categoría; uno omitido. */
  const many = () => [
    row({ itemId: '1', name: 'Ramen picante', sectionKey: 'alegra:c1', sectionName: 'RAMEN' }),
    row({ itemId: '2', name: 'Ramen suave', sectionKey: 'alegra:c1', sectionName: 'RAMEN', omitted: true }),
    row({ itemId: '3', name: 'Jamón serrano', sectionKey: 'alegra:c2', sectionName: 'SNACKS', soldOut: true }),
    row({ itemId: '4', name: 'Té verde', sectionKey: 'alegra:c3', sectionName: 'BEBIDAS' }),
    row({ itemId: '5', name: 'Palillos', sectionKey: null, sectionName: null }),
  ];
  const chip = (name: string | RegExp) => screen.getByRole('button', { name });
  const chips = () =>
    within(screen.getByRole('group', { name: 'Categoría' }))
      .getAllByRole('button')
      .map((b) => b.textContent);

  async function open(rows = many()) {
    mockApi({ ...list(rows), 'GET /api/alegra/data': () => json(200, { state: 'ready', syncedAt: new Date().toISOString(), articles: rows.length, categories: 3, progress: null, lastError: null }) });
    renderPage();
    await screen.findByText('Ramen picante');
  }

  it('ofrece «Todas», una etiqueta por categoría con su cantidad y «Sin categoría» al final solo si hay', async () => {
    await open();
    expect(chips()).toEqual(['Todas (5)', 'BEBIDAS (1)', 'RAMEN (2)', 'SNACKS (1)', 'Sin categoría (1)']);
  });

  it('sin artículos sin categoría no ofrece «Sin categoría»', async () => {
    await open([row(), row({ itemId: '2', name: 'Otro' })]);
    expect(chips()).toEqual(['Todas (2)', 'RAMEN (2)']);
  });

  it('«Todas» viene marcada y las etiquetas usan aria-pressed', async () => {
    await open();
    expect(chip(/^Todas/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^RAMEN/)).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip(/^RAMEN/));
    expect(chip(/^RAMEN/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^Todas/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir una categoría deja solo sus artículos y actualiza «Mostrando N de M artículos»', async () => {
    await open();
    expect(screen.getByText('Mostrando 5 de 5 artículos')).toBeInTheDocument();
    fireEvent.click(chip(/^RAMEN/));
    expect(screen.getByText('Ramen picante')).toBeInTheDocument();
    expect(screen.getByText('Ramen suave')).toBeInTheDocument();
    expect(screen.queryByText('Jamón serrano')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 2 de 5 artículos')).toBeInTheDocument();
    fireEvent.click(chip(/^Sin categoría/));
    expect(screen.getByText('Palillos')).toBeInTheDocument();
    expect(screen.queryByText('Ramen picante')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 5 artículos')).toBeInTheDocument();
  });

  it('una sola categoría a la vez: elegir otra reemplaza a la anterior', async () => {
    await open();
    fireEvent.click(chip(/^RAMEN/));
    fireEvent.click(chip(/^SNACKS/));
    expect(chip(/^RAMEN/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Ramen picante')).not.toBeInTheDocument();
    expect(screen.getByText('Jamón serrano')).toBeInTheDocument();
  });

  it('los conteos respetan la búsqueda y la vista; las categorías sin artículos en ese momento se atenúan con (0) pero se pueden elegir', async () => {
    await open();
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'ram' } });
    expect(chips()).toEqual(['Todas (2)', 'BEBIDAS (0)', 'RAMEN (2)', 'SNACKS (0)', 'Sin categoría (0)']);
    expect(chip(/^BEBIDAS/)).toHaveAttribute('data-empty', 'true');
    expect(chip(/^RAMEN/)).not.toHaveAttribute('data-empty');
    fireEvent.click(screen.getByRole('radio', { name: /^Omitidos/ }));
    expect(chips()).toEqual(['Todas (1)', 'BEBIDAS (0)', 'RAMEN (1)', 'SNACKS (0)', 'Sin categoría (0)']);
    // una categoría con (0) sigue siendo elegible y muestra el mensaje de sin resultados
    fireEvent.click(chip(/^BEBIDAS/));
    expect(chip(/^BEBIDAS/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ningún artículo coincide con los filtros.')).toBeInTheDocument();
  });

  it('categoría + búsqueda + «Omitidos» se combinan', async () => {
    await open();
    fireEvent.click(chip(/^RAMEN/));
    fireEvent.click(screen.getByRole('radio', { name: /^Omitidos/ }));
    expect(screen.getByText('Ramen suave')).toBeInTheDocument();
    expect(screen.queryByText('Ramen picante')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'picante' } });
    expect(screen.getByText('Ningún artículo coincide con los filtros.')).toBeInTheDocument();
  });

  it('«Limpiar filtros» solo existe con búsqueda o categoría activas y las quita con un clic', async () => {
    await open();
    const clear = () => screen.queryByRole('button', { name: 'Limpiar filtros' });
    expect(clear()).not.toBeInTheDocument();
    fireEvent.click(chip(/^RAMEN/));
    expect(clear()).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'xyz' } });
    fireEvent.click(clear()!);
    expect(clear()).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar por nombre')).toHaveValue('');
    expect(chip(/^Todas/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Mostrando 5 de 5 artículos')).toBeInTheDocument();
    // solo la vista queda donde estaba
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'a' } });
    expect(clear()).toBeInTheDocument();
  });

  it('sin resultados «Limpiar filtros» sigue a la mano (un solo botón); en «Omitidos» sin filtros dice «No has omitido ningún artículo.»', async () => {
    await open([row(), row({ itemId: '2', name: 'Otro' })]);
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún artículo coincide con los filtros.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpiar filtros' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(screen.getByText('Ramen picante')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /^Omitidos/ }));
    expect(screen.getByText('No has omitido ningún artículo.')).toBeInTheDocument();
  });

  it('el selector de sección ya no existe', async () => {
    await open();
    expect(screen.queryByLabelText('Sección')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('con 20 categorías de nombre largo las etiquetas se acomodan en varias filas sin desbordar el contenedor', async () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({ itemId: String(i + 1), name: `Producto ${i + 1}`, sectionKey: `alegra:c${i}`, sectionName: `Categoría con un nombre larguísimo número ${i + 1} de la tienda` }),
    );
    mockApi(list(rows));
    renderPage();
    await screen.findByText('Producto 1');
    const group = screen.getByRole('group', { name: 'Categoría' });
    expect(group.querySelectorAll('button')).toHaveLength(21);
    const wrapper = group.querySelector('[data-testid="category-chips"]') as HTMLElement;
    expect(wrapper.className).toMatch(/flex-wrap/);
    // cada etiqueta puede partir su texto en lugar de ensanchar la página
    for (const b of Array.from(group.querySelectorAll('button'))) expect(b.className).toMatch(/max-w-full/);
  });

  it('los conteos y el filtro se calculan en el navegador: elegir una categoría no pide nada al servidor', async () => {
    const calls = mockApi({ ...list(many()), 'GET /api/alegra/data': () => json(200, { state: 'ready', syncedAt: new Date().toISOString(), articles: 5, categories: 3, progress: null, lastError: null }) });
    renderPage();
    await screen.findByText('Ramen picante');
    const before = calls.length;
    fireEvent.click(chip(/^RAMEN/));
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'ramen' } });
    expect(calls.length).toBe(before);
  });
});

describe('Artículos de Alegra: barra de datos y pantalla de carga (feature 007)', () => {
  const ready = () => ({ state: 'ready', syncedAt: new Date(Date.now() - 5.5 * 60_000).toISOString(), articles: 3, categories: 2, progress: null, lastError: null });

  it('la barra de datos aparece bajo el título y su actualización vuelve a cargar la lista', async () => {
    let listCalls = 0;
    mockApi({
      'GET /api/catalog/articles': () => {
        listCalls++;
        return json(200, { items: items() });
      },
      'GET /api/alegra/data': () => json(200, ready()),
      'POST /api/alegra/data/refresh': () => json(202, ready()),
    });
    renderPage();
    await screen.findByText('Ramen picante');
    expect(await screen.findByText(/Datos de Alegra actualizados hace 5 min/)).toBeInTheDocument();
    expect(listCalls).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar desde Alegra' }));
    await waitFor(() => expect(listCalls).toBe(2));
    expect(await screen.findByText('Ramen picante')).toBeInTheDocument();
  });

  it('con la petición pendiente más de ~300 ms muestra la pantalla de carga y, al llegar la lista, desaparece', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    let release!: (r: Response) => void;
    mockApi({
      'GET /api/catalog/articles': () => new Promise<Response>((r) => (release = r)),
      'GET /api/alegra/data': () => json(200, { state: 'syncing', syncedAt: null, articles: null, categories: null, progress: { phase: 'items', received: 90 }, lastError: null }),
    });
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    // el estado dice «descargando»: la pantalla de carga sale de inmediato
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    expect(screen.getByText('Descargando los artículos de Alegra')).toBeInTheDocument();
    expect(screen.getByText('90 artículos recibidos')).toBeInTheDocument();
    await act(async () => {
      release(json(200, { items: items() }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
    expect(screen.getByText('Ramen picante')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('sin estado de descarga, la pantalla de carga espera ~300 ms antes de mostrarse', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    mockApi({
      'GET /api/catalog/articles': () => new Promise<Response>(() => undefined),
      'GET /api/alegra/data': () => json(200, { state: 'ready', syncedAt: new Date().toISOString(), articles: 3, categories: 2, progress: null, lastError: null }),
    });
    renderPage();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('con datos que llegan rápido no se muestra la pantalla de carga', async () => {
    mockApi({ ...list(), 'GET /api/alegra/data': () => json(200, ready()) });
    renderPage();
    await screen.findByText('Ramen picante');
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
  });

  it('el error de Alegra mantiene «Reintentar» y el enlace a la conexión, sin pantalla de carga', async () => {
    mockApi({
      'GET /api/catalog/articles': () => json(422, { error: 'alegra_not_configured', message: 'Primero configura la conexión con Alegra.' }),
      'GET /api/alegra/data': () => json(200, { state: 'none', syncedAt: null, articles: null, categories: null, progress: null, lastError: null }),
    });
    renderPage();
    expect(await screen.findByText('Primero configura la conexión con Alegra.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisa la conexión con Alegra' })).toHaveAttribute('href', '/alegra');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
  });
});
