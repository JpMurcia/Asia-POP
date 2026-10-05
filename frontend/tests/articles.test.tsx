import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('muestra «Cargando…» mientras llega la lista', async () => {
    mockApi({ 'GET /api/catalog/articles': () => new Promise<Response>(() => undefined) });
    renderPage();
    expect(await screen.findByText('Cargando…')).toBeInTheDocument();
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

  it('sin coincidencias dice «Ningún artículo coincide con la búsqueda.»', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún artículo coincide con la búsqueda.')).toBeInTheDocument();
  });

  it('el selector de sección ofrece las secciones y «Sin categoría» (solo si hay) y filtra', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    const select = screen.getByLabelText('Sección');
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Todas las secciones',
      'RAMEN',
      'SNACKS',
      'Sin categoría',
    ]);

    fireEvent.change(select, { target: { value: 'alegra:c2' } });
    expect(screen.getByText('Jamón serrano')).toBeInTheDocument();
    expect(screen.queryByText('Ramen picante')).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: '__none__' } });
    expect(screen.getByText('Palillos')).toBeInTheDocument();
    expect(screen.queryByText('Jamón serrano')).not.toBeInTheDocument();
  });

  it('sin artículos sin sección, el selector no ofrece «Sin categoría»', async () => {
    mockApi(list([row(), row({ itemId: '2', name: 'Otro' })]));
    renderPage();
    await screen.findByText('Ramen picante');
    const options = within(screen.getByLabelText('Sección')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Todas las secciones', 'RAMEN']);
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

  it('los conteos de las vistas siguen la búsqueda y la sección elegidas', async () => {
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
    fireEvent.change(screen.getByLabelText('Sección'), { target: { value: 'alegra:c2' } });
    expect(screen.getByRole('radio', { name: 'Todos (1)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Omitidos (1)' })).toBeInTheDocument();
  });

  it('sin omitidos y sin búsqueda ni sección, la vista «Omitidos» dice «No has omitido ningún artículo.»', async () => {
    mockApi(list());
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.click(screen.getByRole('radio', { name: 'Omitidos (0)' }));
    expect(screen.getByText('No has omitido ningún artículo.')).toBeInTheDocument();
    expect(screen.queryByText('Ningún artículo coincide con la búsqueda.')).not.toBeInTheDocument();
  });

  it('con una búsqueda sin coincidencias en «Omitidos» dice «Ningún artículo coincide con la búsqueda.»', async () => {
    mockApi(list([row({ omitted: true }), row({ itemId: '2', name: 'Jamón serrano' })]));
    renderPage();
    await screen.findByText('Ramen picante');
    fireEvent.click(screen.getByRole('radio', { name: 'Omitidos (1)' }));
    fireEvent.change(screen.getByLabelText('Buscar por nombre'), { target: { value: 'jamon' } });
    expect(screen.getByText('Ningún artículo coincide con la búsqueda.')).toBeInTheDocument();
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
