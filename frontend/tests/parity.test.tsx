import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PanelSummary } from '../../backend/src/catalog/types';
import AlegraSettings from '../src/pages/AlegraSettings';
import Bundles from '../src/pages/Bundles';
import Generate from '../src/pages/Generate';
import Home from '../src/pages/Home';

/** Los cuatro detalles de paridad con el mockup (US6, FR-031 a FR-035). */

const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

type Handler = (body: Record<string, unknown> | undefined) => Response;

function mockApi(routes: Record<string, Handler>) {
  const calls: { key: string; body?: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      const body = init?.body && typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
      calls.push({ key, body });
      const handler = routes[key];
      return handler ? handler(body) : json(404, { error: 'not_found', message: 'no' });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------------------------------------------
// Generar: Seleccionar todas / Quitar todas (FR-031)
// ---------------------------------------------------------------------------------------------------------------

describe('Generar: "Seleccionar todas / Quitar todas"', () => {
  const report = {
    uncategorized: [],
    omittedNoImage: [],
    omittedNoSection: [],
    soldOutBundles: [],
    counts: { included: 5, omitted: 0, soldOut: 0 },
    emptyCatalog: false,
    photos: { informed: 5, obtained: 5, notObtained: [], allFailed: false },
  };
  const structure = (over = {}) => ({
    coverPages: 1,
    sectionCoverPages: 2,
    productPages: 3,
    termsPages: 1,
    ownItems: 0,
    totalPages: 7,
    nothingToGenerate: false,
    sections: [
      { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 4, pages: 2 },
      { key: 'alegra:c2', name: 'SNACKS', source: 'alegra', items: 1, pages: 1 },
    ],
    ...over,
  });
  const available = [
    { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 4 },
    { key: 'alegra:c2', name: 'SNACKS', source: 'alegra', items: 1 },
  ];
  const prepared = (over = {}) => ({ prepareId: 'p1', report, structure: structure(), availableSections: available, options: { hideSoldOut: false }, ...over });

  /** El servidor recalcula la estructura según las secciones elegidas. */
  const options: Handler = (body) => {
    const keys = body?.sectionKeys as string[] | undefined;
    if (keys && keys.length === 0) {
      return json(200, prepared({ structure: structure({ nothingToGenerate: true, totalPages: 0, coverPages: 0, sectionCoverPages: 0, productPages: 0, termsPages: 0, sections: [] }), report: { ...report, emptyCatalog: true } }));
    }
    if (keys && keys.length === 1) {
      return json(200, prepared({ structure: structure({ sectionCoverPages: 1, productPages: 2, totalPages: 5, sections: [structure().sections[0]!] }) }));
    }
    return json(200, prepared());
  };

  async function start() {
    const calls = mockApi({
      'GET /api/catalog/jobs/current': () => json(200, { status: 'idle' }),
      'GET /api/settings/business': () => json(200, { coverTitle: 'Catálogo de productos' }),
      'GET /api/settings/templates/summary': () => json(200, { defaultId: 'neon', items: [] }),
      'POST /api/catalog/prepare': () => json(200, prepared()),
      'PUT /api/catalog/prepare/p1/options': options,
    });
    render(
      <MemoryRouter>
        <Generate />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Preparar y revisar/ }));
    await screen.findByTestId('review-report');
    return calls;
  }

  const boxes = () => screen.getAllByRole('checkbox').filter((c) => c.closest('label')?.textContent?.includes('prod.'));
  const total = () => screen.getByTestId('structure-total');
  const optionPuts = (calls: Awaited<ReturnType<typeof start>>) => calls.filter((c) => c.key === 'PUT /api/catalog/prepare/p1/options');

  it('no aparece hasta preparar y, con todas elegidas, ofrece "Quitar todas"', async () => {
    mockApi({
      'GET /api/catalog/jobs/current': () => json(200, { status: 'idle' }),
      'GET /api/settings/business': () => json(200, { coverTitle: 'x' }),
      'GET /api/settings/templates/summary': () => json(200, { defaultId: 'neon', items: [] }),
    });
    render(
      <MemoryRouter>
        <Generate />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /todas/ })).not.toBeInTheDocument();
  });

  it('"Quitar todas" desmarca las secciones y actualiza la vista previa de estructura', async () => {
    const calls = await start();
    expect(boxes()).toHaveLength(2);
    expect(boxes().every((b) => (b as HTMLInputElement).checked)).toBe(true);
    expect(total()).toHaveTextContent('7 páginas');

    fireEvent.click(screen.getByRole('button', { name: 'Quitar todas' }));
    expect(boxes().every((b) => !(b as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole('button', { name: 'Seleccionar todas' })).toBeInTheDocument();
    await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
    expect(optionPuts(calls)[0]!.body!.sectionKeys).toEqual([]);
    // sin secciones no hay estructura: la vista previa lo dice y no se puede generar
    expect(await screen.findByText(/No hay nada que generar con estas opciones/)).toBeInTheDocument();
    expect(screen.queryByTestId('structure-total')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar PDF/ })).toBeDisabled();
  });

  it('"Seleccionar todas" vuelve a marcarlas todas y recupera la estructura completa', async () => {
    const calls = await start();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar todas' }));
    await screen.findByText(/No hay nada que generar con estas opciones/);

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }));
    expect(boxes().every((b) => (b as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByRole('button', { name: 'Quitar todas' })).toBeInTheDocument();
    await waitFor(() => expect(total()).toHaveTextContent('7 páginas'));
    expect(optionPuts(calls).at(-1)!.body!.sectionKeys, 'todas = sin filtro').toBeUndefined();
  });

  it('con una selección parcial el control ofrece "Seleccionar todas"', async () => {
    const calls = await start();
    fireEvent.click(boxes()[1]!); // desmarca SNACKS
    expect(screen.getByRole('button', { name: 'Seleccionar todas' })).toBeInTheDocument();
    await waitFor(() => expect(total()).toHaveTextContent('5 páginas'));
    expect(optionPuts(calls).at(-1)!.body!.sectionKeys).toEqual(['alegra:c1']);
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar todas' }));
    expect(boxes().every((b) => (b as HTMLInputElement).checked)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Combos: suma, ahorro y precio mientras se edita (FR-032)
// ---------------------------------------------------------------------------------------------------------------

describe('Combos: desglose del precio', () => {
  const routes: Record<string, Handler> = {
    'GET /api/sections/custom': () => json(200, [{ id: 'r', name: 'REGALOS' }]),
    'GET /api/bundles': () => json(200, []),
    'GET /api/bundles/component-options': () =>
      json(200, {
        alegra: [
          { id: '1', name: 'Shin', price: 9000 },
          { id: '2', name: 'Champong', price: 12000 },
        ],
        custom: [{ id: 'c1', name: 'Caja de mochis', price: 30000 }],
        alegraAvailable: true,
      }),
  };

  async function start(extra: Record<string, Handler> = {}) {
    mockApi({ ...routes, ...extra });
    render(
      <MemoryRouter>
        <Bundles />
      </MemoryRouter>,
    );
    await screen.findByText('Nuevo combo');
  }

  const addProduct = (option: string, quantity = 1) => {
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }));
    const selects = screen.getAllByLabelText('Producto');
    fireEvent.change(selects.at(-1)!, { target: { value: option } });
    fireEvent.change(screen.getAllByLabelText('Cantidad').at(-1)!, { target: { value: String(quantity) } });
  };
  const summary = () => within(screen.getByTestId('bundle-summary'));
  const money = (label: string) => summary().getByTestId(label).textContent;

  it('sin productos muestra ceros', async () => {
    await start();
    expect(summary().getByText('Suma de componentes')).toBeInTheDocument();
    expect(summary().getByText('Ahorro')).toBeInTheDocument();
    expect(summary().getByText('Precio en catálogo')).toBeInTheDocument();
    expect(money('bundle-sum')).toBe('$0');
  });

  it('con descuento: suma de los componentes por su cantidad, ahorro y precio redondeado a $100', async () => {
    await start();
    addProduct('1', 2); // 2 × $9.000
    expect(money('bundle-sum')).toBe('$18.000');
    expect(money('bundle-final')).toBe('$16.200'); // 10 % por defecto
    expect(money('bundle-saving')).toBe('$1.800');
    fireEvent.change(screen.getByLabelText('Valor del precio'), { target: { value: '25' } });
    expect(money('bundle-final')).toBe('$13.500');
    expect(money('bundle-saving')).toBe('$4.500');
  });

  it('mezcla productos de Alegra y propios y se actualiza al cambiar cantidades', async () => {
    await start();
    addProduct('1', 1);
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }));
    const origins = screen.getAllByLabelText('Origen');
    fireEvent.change(origins.at(-1)!, { target: { value: 'custom' } });
    fireEvent.change(screen.getAllByLabelText('Producto').at(-1)!, { target: { value: 'c1' } });
    expect(money('bundle-sum')).toBe('$39.000'); // 9.000 + 30.000
    fireEvent.change(screen.getAllByLabelText('Cantidad')[0]!, { target: { value: '3' } });
    expect(money('bundle-sum')).toBe('$57.000'); // 27.000 + 30.000
  });

  it('con precio fijo: el precio es el indicado y el ahorro nunca es negativo', async () => {
    await start();
    addProduct('1', 2);
    fireEvent.click(screen.getByLabelText('Precio fijo'));
    fireEvent.change(screen.getByLabelText('Valor del precio'), { target: { value: '15000' } });
    expect(money('bundle-final')).toBe('$15.000');
    expect(money('bundle-saving')).toBe('$3.000');
    fireEvent.change(screen.getByLabelText('Valor del precio'), { target: { value: '20000' } });
    expect(money('bundle-final')).toBe('$20.000');
    expect(money('bundle-saving')).toBe('$0');
  });

  it('un producto aún sin elegir no suma', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }));
    expect(money('bundle-sum')).toBe('$0');
    fireEvent.change(screen.getByLabelText('Producto'), { target: { value: '2' } });
    expect(money('bundle-sum')).toBe('$12.000');
  });

  it('un valor del precio vacío o inválido no rompe el desglose', async () => {
    await start();
    addProduct('1', 1);
    fireEvent.change(screen.getByLabelText('Valor del precio'), { target: { value: '' } });
    expect(money('bundle-sum')).toBe('$9.000');
    expect(money('bundle-final')).toBe('$9.000'); // sin descuento
    fireEvent.change(screen.getByLabelText('Valor del precio'), { target: { value: 'abc' } });
    expect(money('bundle-final')).toBe('$9.000');
  });

  it('al editar un combo existente muestra sus números', async () => {
    await start({
      'GET /api/bundles': () =>
        json(200, [
          {
            id: 'b1',
            sectionId: 'r',
            name: 'Combo regalo',
            description: '',
            imageUrl: null,
            pricing: { type: 'discount', percent: 10 },
            components: [{ source: 'alegra', productId: '1', quantity: 2, name: 'Shin', soldOut: false }],
            computedPrice: 16200,
          },
        ]),
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(money('bundle-sum')).toBe('$18.000');
    expect(money('bundle-final')).toBe('$16.200');
    expect(money('bundle-saving')).toBe('$1.800');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Combos: aviso «Combo no disponible» (mockup, Admin Catalogo)
// ---------------------------------------------------------------------------------------------------------------

describe('Combos: aviso de componentes agotados', () => {
  const soldOutOptions = {
    alegra: [
      { id: '1', name: 'Shin', price: 9000, soldOut: false },
      { id: '2', name: 'Champong', price: 12000, soldOut: true },
      { id: '3', name: 'Buldak', price: 10000, soldOut: true },
    ],
    custom: [{ id: 'c1', name: 'Caja de mochis', price: 30000, soldOut: false }],
    alegraAvailable: true,
  };
  const bundle = (components: Record<string, unknown>[]) => ({
    id: 'b1',
    sectionId: 'r',
    name: 'Combo regalo',
    description: '',
    imageUrl: null,
    pricing: { type: 'discount', percent: 10 },
    components,
    computedPrice: 16200,
  });

  async function start(bundles: unknown[] = []) {
    mockApi({
      'GET /api/sections/custom': () => json(200, [{ id: 'r', name: 'REGALOS' }]),
      'GET /api/bundles': () => json(200, bundles),
      'GET /api/bundles/component-options': () => json(200, soldOutOptions),
    });
    render(
      <MemoryRouter>
        <Bundles />
      </MemoryRouter>,
    );
    await screen.findByText('Nuevo combo');
  }
  const pick = (option: string, source = 'alegra') => {
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar producto' }));
    if (source !== 'alegra') fireEvent.change(screen.getAllByLabelText('Origen').at(-1)!, { target: { value: source } });
    fireEvent.change(screen.getAllByLabelText('Producto').at(-1)!, { target: { value: option } });
  };
  const notice = () => screen.queryByTestId('bundle-unavailable');

  it('sin componentes agotados no hay aviso', async () => {
    await start();
    pick('1');
    pick('c1', 'custom');
    expect(notice()).not.toBeInTheDocument();
  });

  it('un componente agotado en Alegra muestra «Combo no disponible» con su nombre, y el combo saldrá con badge AGOTADO', async () => {
    await start();
    pick('1');
    expect(notice()).not.toBeInTheDocument();
    pick('2');
    expect(notice()).toHaveTextContent('Combo no disponible.');
    expect(notice()).toHaveTextContent('Champong está agotado en Alegra');
    expect(notice()).toHaveTextContent('el combo saldrá con badge AGOTADO');
    expect(notice()).not.toHaveTextContent('Shin');
  });

  it('con varios agotados los nombra a todos, en plural', async () => {
    await start();
    pick('2');
    pick('3');
    expect(notice()).toHaveTextContent('Champong, Buldak están agotados en Alegra');
  });

  it('el aviso se va al quitar el componente agotado', async () => {
    await start();
    pick('2');
    expect(notice()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(notice()).not.toBeInTheDocument();
  });

  it('al editar un combo guardado con un componente agotado muestra el aviso', async () => {
    await start([bundle([{ source: 'alegra', productId: '2', quantity: 1, name: 'Champong', soldOut: true }])]);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(notice()).toHaveTextContent('Champong está agotado en Alegra');
  });

  it('en la lista, un combo con un componente agotado se marca «No disponible»; uno completo no', async () => {
    await start([
      bundle([{ source: 'alegra', productId: '2', quantity: 1, name: 'Champong', soldOut: true }]),
      { ...bundle([{ source: 'alegra', productId: '1', quantity: 1, name: 'Shin', soldOut: false }]), id: 'b2', name: 'Combo ramen' },
    ]);
    const rows = await screen.findAllByRole('listitem');
    expect(within(rows[0]!).getByText('No disponible')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('No disponible')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Inicio: "hace N min" (FR-034)
// ---------------------------------------------------------------------------------------------------------------

describe('Inicio: antigüedad de la sincronización', () => {
  const NOW = new Date('2026-10-03T12:00:00Z').getTime();
  const base: PanelSummary = {
    alegra: { status: 'ok', email: 'a@b.co', lastTestedAt: null, syncedAt: new Date(NOW - 4 * 60_000).toISOString() },
    stats: { products: 40, soldOut: 5, uncategorized: 0, estimatedPages: 22, omitted: 0 },
    sections: [],
    lastCatalog: null,
    generatedAt: '2026-10-03T12:00:00Z',
  };
  const renderHome = (summary: PanelSummary) =>
    render(
      <MemoryRouter>
        <Home summary={summary} loading={false} error={false} refresh={async () => {}} />
      </MemoryRouter>,
    );
  const card = () => screen.getByLabelText('Productos activos en Alegra: 40').closest('div')!;

  it('junto a los productos activos dice "Sincronizado hace N min"', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    renderHome(base);
    expect(card()).toHaveTextContent('Sincronizado hace 4 min');
  });

  it.each([
    [10_000, 'Sincronizado hace menos de 1 min'],
    [60_000, 'Sincronizado hace 1 min'],
    [59 * 60_000, 'Sincronizado hace 59 min'],
    [60 * 60_000, 'Sincronizado hace 1 h'],
    [5 * 3_600_000, 'Sincronizado hace 5 h'],
    [26 * 3_600_000, 'Sincronizado hace 1 d'],
  ])('hace %i ms: %s', (ago, text) => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    renderHome({ ...base, alegra: { ...base.alegra, syncedAt: new Date(NOW - ago).toISOString() } });
    expect(card()).toHaveTextContent(text);
  });

  it('se va actualizando con el tiempo sin recargar', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    renderHome(base);
    expect(card()).toHaveTextContent('hace 4 min');
    act(() => {
      vi.setSystemTime(NOW + 2 * 60_000);
      vi.advanceTimersByTime(30_000);
    });
    expect(card()).toHaveTextContent('hace 6 min');
  });

  it('una hora de reloj adelantada no muestra tiempos negativos', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    renderHome({ ...base, alegra: { ...base.alegra, syncedAt: new Date(NOW + 5 * 60_000).toISOString() } });
    expect(card()).toHaveTextContent('Sincronizado hace menos de 1 min');
  });

  it('sin `syncedAt` (Alegra no respondió) conserva las notas de antes', () => {
    renderHome({ ...base, alegra: { status: 'ok', email: 'a@b.co', lastTestedAt: null } });
    expect(card()).toHaveTextContent('Leídos de Alegra');
    expect(card()).not.toHaveTextContent('Sincronizado');
  });

  it('con Alegra caído sigue diciendo que no está disponible', () => {
    renderHome({ ...base, alegra: { status: 'unreachable', message: 'No se pudo conectar.' }, stats: null });
    expect(screen.getAllByText('No disponible sin Alegra').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sincronizado hace/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Conexión Alegra: intentos restantes (FR-035)
// ---------------------------------------------------------------------------------------------------------------

describe('Conexión Alegra: intentos de prueba restantes', () => {
  const attempts = (remaining: number) => ({ limit: 10, remaining });
  const status = (remaining: number) => json(200, { email: 'a@b.co', isConfigured: true, lastTestedAt: null, testAttempts: attempts(remaining) });
  const counter = () => screen.getByTestId('test-attempts');

  async function start(routes: Record<string, Handler> = {}, remaining = 10) {
    mockApi({ 'GET /api/settings/alegra': () => status(remaining), ...routes });
    render(
      <MemoryRouter>
        <AlegraSettings />
      </MemoryRouter>,
    );
    await screen.findByTestId('alegra-status');
  }
  const test = () => {
    fireEvent.change(screen.getByLabelText('Correo de Alegra'), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText('Token de la API'), { target: { value: 'tok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Probar conexión' }));
  };

  it('muestra cuántos intentos quedan', async () => {
    await start({}, 7);
    expect(counter()).toHaveTextContent('Intentos de prueba: 7/10 por minuto');
  });

  it('cada prueba correcta actualiza el contador con lo que informa el servidor', async () => {
    await start({ 'POST /api/settings/alegra/test': () => json(200, { ok: true, testAttempts: attempts(9) }) });
    test();
    expect(await screen.findByText('Conexión exitosa con Alegra.')).toBeInTheDocument();
    expect(counter()).toHaveTextContent('Intentos de prueba: 9/10 por minuto');
  });

  it('una prueba rechazada por Alegra también actualiza el contador', async () => {
    await start({
      'POST /api/settings/alegra/test': () =>
        json(422, { error: 'alegra_rejected', message: 'Alegra rechazó el correo o el token.', details: { testAttempts: attempts(8) } }),
    });
    test();
    expect(await screen.findByRole('alert')).toHaveTextContent('Alegra rechazó el correo o el token.');
    expect(counter()).toHaveTextContent('Intentos de prueba: 8/10 por minuto');
  });

  it('al agotarlos (429) pide esperar un minuto', async () => {
    await start({
      'POST /api/settings/alegra/test': () =>
        json(429, { error: 'too_many_requests', message: 'Demasiados intentos. Espera un minuto.', details: { testAttempts: attempts(0) } }),
    });
    test();
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos. Espera un minuto.');
    expect(counter()).toHaveTextContent('Intentos de prueba: 0/10 por minuto');
    expect(screen.getByText('Espera un minuto antes de volver a probar.')).toBeInTheDocument();
  });

  it('sin intentos al cargar también avisa que hay que esperar, pero deja volver a intentar', async () => {
    await start({}, 0);
    expect(screen.getByText('Espera un minuto antes de volver a probar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeEnabled();
  });

  it('con intentos no muestra la advertencia', async () => {
    await start({}, 3);
    expect(screen.queryByText('Espera un minuto antes de volver a probar.')).not.toBeInTheDocument();
  });

  it('guardar las credenciales no borra el contador (la respuesta del PUT no lo trae)', async () => {
    await start({
      'PUT /api/settings/alegra': () => json(200, { email: 'a@b.co', isConfigured: true, lastTestedAt: '2026-10-03T10:00:00Z' }),
    }, 6);
    fireEvent.change(screen.getByLabelText('Token de la API'), { target: { value: 'tok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Credenciales guardadas y conexión verificada.')).toBeInTheDocument();
    expect(counter()).toHaveTextContent('Intentos de prueba: 6/10 por minuto');
  });

  it('un servidor antiguo sin `testAttempts` no rompe la pantalla', async () => {
    await start({ 'GET /api/settings/alegra': () => json(200, { email: 'a@b.co', isConfigured: true, lastTestedAt: null }) });
    expect(screen.queryByTestId('test-attempts')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Probar conexión' })).toBeInTheDocument();
  });
});
