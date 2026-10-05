import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UncategorizedAlert from '../src/components/UncategorizedAlert';
import AlegraSettings from '../src/pages/AlegraSettings';
import Bundles from '../src/pages/Bundles';
import History from '../src/pages/History';
import Sections from '../src/pages/Sections';
import Uncategorized from '../src/pages/Uncategorized';

/** Pruebas de humo de las pantallas reestilizadas (FR-004): siguen mostrando y ejecutando lo de 001. */

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

type Handler = (body: unknown) => Response;

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

const renderAt = (ui: React.ReactElement, path = '/') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Conexión Alegra', () => {
  it('muestra el estado y guarda credenciales nuevas sin conservar el token en pantalla', async () => {
    const calls = mockApi({
      'GET /api/settings/alegra': () => json(200, { email: 'a@b.co', isConfigured: true, lastTestedAt: null }),
      'PUT /api/settings/alegra': () => json(200, { email: 'nuevo@b.co', isConfigured: true, lastTestedAt: '2026-10-03T10:00:00Z' }),
    });
    renderAt(<AlegraSettings />);
    expect(await screen.findByTestId('alegra-status')).toHaveTextContent('Conectado como a@b.co');

    fireEvent.change(screen.getByLabelText('Correo de Alegra'), { target: { value: 'nuevo@b.co' } });
    fireEvent.change(screen.getByLabelText('Token de la API'), { target: { value: 'tok_secreto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Credenciales guardadas y conexión verificada.')).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'PUT /api/settings/alegra')!.body).toEqual({ email: 'nuevo@b.co', apiToken: 'tok_secreto' });
    expect(screen.getByLabelText('Token de la API')).toHaveValue('');
  });

  it('probar la conexión muestra el rechazo de Alegra', async () => {
    mockApi({
      'GET /api/settings/alegra': () => json(200, { email: null, isConfigured: false, lastTestedAt: null }),
      'POST /api/settings/alegra/test': () => json(422, { error: 'alegra_rejected', message: 'Alegra rechazó las credenciales.' }),
    });
    renderAt(<AlegraSettings />);
    fireEvent.change(await screen.findByLabelText('Correo de Alegra'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Token de la API'), { target: { value: 'mal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Probar conexión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Alegra rechazó las credenciales.');
  });
});

describe('Sin categoría', () => {
  const items = [
    { itemId: '7', name: 'Palillos', assignedSectionKey: null },
    { itemId: '8', name: 'Salsa', assignedSectionKey: 'alegra:c1' },
  ];
  const sections = [
    { key: 'alegra:c1', name: 'SNACKS', source: 'alegra' },
    { key: 'custom:m', name: 'MOCHIS', source: 'custom' },
  ];

  it('lista los ítems, asigna una sección y la deshace', async () => {
    const calls = mockApi({
      'GET /api/catalog/uncategorized': () => json(200, { items }),
      'GET /api/sections': () => json(200, sections),
      'PUT /api/catalog/uncategorized/7': () => json(204),
      'DELETE /api/catalog/uncategorized/8': () => json(204),
    });
    renderAt(<Uncategorized />);
    expect(await screen.findByText('Palillos')).toBeInTheDocument();
    expect(screen.getByText('1 pendientes de asignar')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sección para Palillos'), { target: { value: 'custom:m' } });
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /api/catalog/uncategorized/7')).toBe(true));
    expect(calls.find((c) => c.key === 'PUT /api/catalog/uncategorized/7')!.body).toEqual({ sectionKey: 'custom:m' });
    expect(await screen.findByText('Todos tienen sección asignada')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Sección para Salsa'), { target: { value: '' } });
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/catalog/uncategorized/8')).toBe(true));
  });

  it('sin pendientes muestra el mensaje de éxito', async () => {
    mockApi({ 'GET /api/catalog/uncategorized': () => json(200, { items: [] }), 'GET /api/sections': () => json(200, []) });
    renderAt(<Uncategorized />);
    expect(await screen.findByText(/Todos los productos tienen categoría/)).toBeInTheDocument();
  });

  it('la alerta de Generar cuenta solo los pendientes y enlaza a la pantalla', async () => {
    mockApi({ 'GET /api/catalog/uncategorized': () => json(200, { items }) });
    renderAt(<UncategorizedAlert />);
    expect(await screen.findByRole('alert')).toHaveTextContent('1 producto(s) de Alegra no tienen categoría');
    expect(screen.getByRole('link', { name: 'Asignarles una sección' })).toHaveAttribute('href', '/sin-categoria');
  });
});

describe('Contenido propio', () => {
  const baseRoutes = {
    'GET /api/sections': () =>
      json(200, [
        { key: 'alegra:c1', name: 'RAMEN', source: 'alegra' },
        { key: 'custom:m', name: 'MOCHIS', source: 'custom', introText: '¿Qué es?' },
      ]),
    'GET /api/sections/custom': () => json(200, [{ id: 'm', name: 'MOCHIS' }]),
    'GET /api/custom-products?sectionId=m': () =>
      json(200, [
        { id: 'p1', sectionId: 'm', name: 'Caja de mochis', description: '', price: null, flavors: [], options: [{ label: 'Caja x 6', price: 30000, maxFlavors: 2 }], imageUrl: null },
      ]),
  };

  it('muestra las secciones con su origen, permite reordenar y crear una propia', async () => {
    const calls = mockApi({
      ...baseRoutes,
      'PUT /api/sections/order': () => json(204),
      'POST /api/sections/custom': () => json(201, { id: 'n', name: 'REGALOS' }),
    });
    renderAt(<Sections />, '/contenido');
    const list = await screen.findByRole('list', { name: 'Orden de secciones' });
    expect(within(list).getByText('RAMEN').closest('li')).toHaveTextContent('Alegra');
    expect(within(list).getByText('MOCHIS').closest('li')).toHaveTextContent('Propia');

    fireEvent.click(screen.getByRole('button', { name: 'Bajar RAMEN' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'PUT /api/sections/order')).toBe(true));
    expect(calls.find((c) => c.key === 'PUT /api/sections/order')!.body).toEqual({ keys: ['custom:m', 'alegra:c1'] });

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'REGALOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear sección' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/sections/custom')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/sections/custom')!.body).toEqual({ name: 'REGALOS', introText: null });
  });

  it('la pestaña "Productos propios" lista los productos y avisa si no tienen imagen', async () => {
    mockApi(baseRoutes);
    renderAt(<Sections />, '/contenido?tab=productos');
    expect(await screen.findByText('Caja de mochis')).toBeInTheDocument();
    expect(screen.getByText(/Caja x 6: \$30\.000/)).toBeInTheDocument();
    expect(screen.getByText(/No saldrá en el catálogo hasta que tenga imagen/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Productos propios' })).toHaveAttribute('aria-selected', 'true');
  });

  it('se puede cambiar entre las dos pestañas', async () => {
    mockApi(baseRoutes);
    renderAt(<Sections />, '/contenido');
    await screen.findByRole('list', { name: 'Orden de secciones' });
    fireEvent.click(screen.getByRole('tab', { name: 'Productos propios' }));
    expect(await screen.findByText('Caja de mochis')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Secciones' }));
    expect(await screen.findByRole('list', { name: 'Orden de secciones' })).toBeInTheDocument();
  });

  it('crear un producto propio con opciones envía el cuerpo correcto', async () => {
    const calls = mockApi({
      ...baseRoutes,
      'POST /api/custom-products': () => json(201, { id: 'p2' }),
    });
    renderAt(<Sections />, '/contenido?tab=productos');
    await screen.findByText('Caja de mochis');
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Mochi fresa' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar opción' }));
    fireEvent.change(screen.getByLabelText('Etiqueta de la opción'), { target: { value: 'Caja x 12' } });
    fireEvent.change(screen.getByLabelText('Precio de la opción'), { target: { value: '55000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear producto' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/custom-products')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/custom-products')!.body).toMatchObject({
      sectionId: 'm',
      name: 'Mochi fresa',
      options: [{ label: 'Caja x 12', price: 55000, maxFlavors: null }],
    });
  });
});

describe('Combos', () => {
  const routes = {
    'GET /api/sections/custom': () => json(200, [{ id: 'r', name: 'REGALOS' }]),
    'GET /api/bundles': () =>
      json(200, [
        {
          id: 'b1',
          sectionId: 'r',
          name: 'Combo regalo',
          description: '',
          imageUrl: '/media/uploads/b1.png',
          pricing: { type: 'discount', percent: 10 },
          components: [{ source: 'alegra', productId: '1', quantity: 2, name: 'Shin', soldOut: true }],
          computedPrice: 16200,
        },
      ]),
    'GET /api/bundles/component-options': () =>
      json(200, { alegra: [{ id: '1', name: 'Shin', price: 9000 }], custom: [], alegraAvailable: true }),
  };

  it('lista los combos con precio calculado, componentes y agotados', async () => {
    mockApi(routes);
    renderAt(<Bundles />);
    const row = (await screen.findByText(/Combo regalo/)).closest('li')!;
    expect(row).toHaveTextContent('$16.200');
    expect(row).toHaveTextContent('10% de descuento');
    expect(row).toHaveTextContent('2 × Shin (agotado)');
  });

  it('crea un combo con precio fijo', async () => {
    const calls = mockApi({ ...routes, 'POST /api/bundles': () => json(201, { id: 'b2' }) });
    renderAt(<Bundles />);
    await screen.findByText(/Combo regalo/);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Combo fijo' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }));
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '1' } });
    fireEvent.click(screen.getByLabelText('Precio fijo'));
    fireEvent.change(screen.getByLabelText('Valor del precio'), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear combo' }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /api/bundles')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /api/bundles')!.body).toMatchObject({
      sectionId: 'r',
      name: 'Combo fijo',
      pricing: { type: 'fixed', price: 15000 },
      components: [{ source: 'alegra', productId: '1', quantity: 1 }],
    });
  });

  it('avisa si Alegra no está disponible para armar combos', async () => {
    mockApi({
      ...routes,
      'GET /api/bundles/component-options': () => json(200, { alegra: [], custom: [], alegraAvailable: false }),
    });
    renderAt(<Bundles />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar Alegra');
  });

  it('sin secciones propias pide crear una primero', async () => {
    mockApi({ ...routes, 'GET /api/sections/custom': () => json(200, []) });
    renderAt(<Bundles />);
    expect(await screen.findByText(/Primero crea una sección propia/)).toBeInTheDocument();
  });
});

describe('Historial', () => {
  it('lista los catálogos con páginas y enlace de descarga', async () => {
    mockApi({
      'GET /api/catalog/history': () =>
        json(200, [
          { id: 'c2', createdAt: '2026-10-03T10:00:00Z', includedCount: 30, omittedCount: 2, pages: 18 },
          { id: 'c1', createdAt: '2026-10-01T10:00:00Z', includedCount: 25, omittedCount: 0 },
        ]),
    });
    renderAt(<History />);
    const links = await screen.findAllByRole('link', { name: 'Descargar' });
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/api/catalog/history/c2/pdf',
      '/api/catalog/history/c1/pdf',
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('18');
    expect(rows[1]).toHaveTextContent('—'); // catálogo de 001 sin páginas guardadas
  });

  it('muestra el tamaño de cada catálogo entre Páginas e Incluidos, y «—» cuando no hay dato (FR-011)', async () => {
    mockApi({
      'GET /api/catalog/history': () =>
        json(200, [
          { id: 'c3', createdAt: '2026-10-04T23:32:00Z', includedCount: 182, omittedCount: 14, pages: 66, sizeBytes: 19320118 },
          { id: 'c2', createdAt: '2026-10-03T10:00:00Z', includedCount: 30, omittedCount: 2, pages: 18, sizeBytes: 163999000 },
          // el archivo ya no existe: el servidor omite el tamaño
          { id: 'c1', createdAt: '2026-10-01T10:00:00Z', includedCount: 25, omittedCount: 0, pages: 4 },
        ]),
    });
    renderAt(<History />);
    await screen.findAllByRole('link', { name: 'Descargar' });
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).slice(0, 5)).toEqual([
      'Fecha',
      'Páginas',
      'Tamaño',
      'Incluidos',
      'Omitidos',
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    const sizeOf = (row: HTMLElement) => within(row).getAllByRole('cell')[2]!.textContent;
    expect(sizeOf(rows[0]!)).toBe('18,4 MB');
    expect(sizeOf(rows[1]!)).toBe('156,4 MB');
    expect(sizeOf(rows[2]!)).toBe('—');
  });

  it('sin catálogos invita a generar', async () => {
    mockApi({ 'GET /api/catalog/history': () => json(200, []) });
    renderAt(<History />);
    expect(await screen.findByText('Aún no has generado ningún catálogo.')).toBeInTheDocument();
  });
});
