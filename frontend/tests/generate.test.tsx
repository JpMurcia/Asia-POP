import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_REASON_LABEL } from '../../backend/src/catalog/photo-reasons';
import Generate from '../src/pages/Generate';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status });

const report = {
  uncategorized: [{ itemId: '9', name: 'Palillos' }],
  omittedNoImage: [{ source: 'alegra', id: '5', name: 'Sin foto' }],
  omittedNoSection: [{ itemId: '9', name: 'Palillos' }],
  soldOutBundles: [{ bundleId: 'b1', name: 'Combo regalo', soldOutComponents: ['Champong'] }],
  counts: { included: 4, omitted: 2, soldOut: 1 },
  emptyCatalog: false,
  photos: { informed: 4, obtained: 4, notObtained: [] as { id: string; name: string; reason: string }[], allFailed: false },
};

const structure = (over = {}) => ({
  coverPages: 1,
  sectionCoverPages: 2,
  productPages: 3,
  termsPages: 1,
  ownItems: 1,
  totalPages: 7,
  nothingToGenerate: false,
  sections: [
    { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 4, pages: 2 },
    { key: 'alegra:c2', name: 'SNACKS', source: 'alegra', items: 1, pages: 1 },
  ],
  ...over,
});

const availableSections = [
  { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 4 },
  { key: 'alegra:c2', name: 'SNACKS', source: 'alegra', items: 1 },
];

const prepared = (over = {}) => ({
  prepareId: 'p1',
  report,
  structure: structure(),
  availableSections,
  options: { hideSoldOut: false },
  ...over,
});

type Handler = (body: unknown) => Response;

const palette = (bg: string) => ({ bg, a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' });
const fonts = { title: 'fredoka', body: 'poppins' };
/** Neón Noche es la predeterminada. */
const templateSummary = {
  defaultId: 'neon',
  items: [
    { id: 'neon', name: 'Neón Noche', isDefault: true, palette: palette('#11052C'), fonts },
    { id: 'pop', name: 'Pop crema', isDefault: false, palette: palette('#2A1258'), fonts },
    { id: 'kraft', name: 'Kraft minimal', isDefault: false, palette: palette('#1C1A17'), fonts },
  ],
};

function mockApi(overrides: Record<string, Handler> = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const key = `${method} ${url}`;
    if (overrides[key]) return overrides[key]!(body);
    if (key === 'GET /api/catalog/jobs/current') return json(200, { status: 'idle' });
    if (key === 'GET /api/settings/business') return json(200, { coverTitle: 'Catálogo de productos' });
    if (key === 'GET /api/settings/templates/summary') return json(200, templateSummary);
    if (key === 'POST /api/catalog/prepare') return json(200, prepared());
    if (key === 'PUT /api/catalog/prepare/p1/options') return json(200, prepared());
    if (key === 'POST /api/catalog/generate') return json(202, { jobId: 'j1', template: { id: 'neon', name: 'Neón Noche', fallback: false } });
    return json(404, { error: 'not_found', message: 'no' });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <Generate />
    </MemoryRouter>,
  );

const prepareNow = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Preparar y revisar/ }));
  await screen.findByTestId('review-report');
};

const optionPuts = (calls: ReturnType<typeof mockApi>) =>
  calls.filter((c) => c.method === 'PUT' && c.url === '/api/catalog/prepare/p1/options');

afterEach(() => vi.unstubAllGlobals());

describe('pantalla Generar catálogo', () => {
  it('muestra el informe con alertas de sin categoría, sin imagen y combos agotados', async () => {
    mockApi();
    renderPage();
    await prepareNow();

    const rep = screen.getByTestId('review-report');
    expect(rep).toHaveTextContent('4');
    expect(within(rep).getByText(/1 producto\(s\) sin categoría ni sección asignada/)).toBeInTheDocument();
    expect(within(rep).getByText('Palillos')).toBeInTheDocument();
    expect(within(rep).getByText(/omitidos por no tener imagen/)).toBeInTheDocument();
    expect(within(rep).getByText('Sin foto')).toBeInTheDocument();
    expect(within(rep).getByText('Combos con productos agotados')).toBeInTheDocument();
    expect(within(rep).getByText(/Agotado: Champong/)).toBeInTheDocument();
  });

  describe('fotos que faltan', () => {
    const withReport = (over: Partial<typeof report>) =>
      mockApi({ 'POST /api/catalog/prepare': () => json(200, prepared({ report: { ...report, ...over } })) });

    it('separa los productos con foto que no se pudo obtener (con su motivo) de los que no tienen foto en Alegra', async () => {
      withReport({
        omittedNoImage: [
          { source: 'alegra', id: '5', name: 'Sin foto' },
          { source: 'alegra', id: '6', name: 'Foto rechazada' },
          { source: 'alegra', id: '7', name: 'Foto perdida' },
          { source: 'custom', id: 'c1', name: 'Mochi propio' },
        ],
        counts: { included: 1, omitted: 4, soldOut: 0 },
        photos: {
          informed: 3,
          obtained: 1,
          notObtained: [
            { id: '6', name: 'Foto rechazada', reason: 'unauthorized' },
            { id: '7', name: 'Foto perdida', reason: 'not_found' },
          ],
          allFailed: false,
        },
      });
      renderPage();
      await prepareNow();
      const rep = screen.getByTestId('review-report');

      // Aviso de fotos no obtenidas: nombre y motivo en lenguaje claro
      expect(within(rep).getByText(/2 producto\(s\) con foto en Alegra que no se pudo obtener/)).toBeInTheDocument();
      expect(within(rep).getByText(`Foto rechazada — ${PHOTO_REASON_LABEL.unauthorized}`)).toBeInTheDocument();
      expect(within(rep).getByText(`Foto perdida — ${PHOTO_REASON_LABEL.not_found}`)).toBeInTheDocument();

      // Los productos sin foto (de Alegra o propios) siguen en su aviso de siempre y no se repiten los de arriba
      expect(within(rep).getByText(/2 producto\(s\) omitidos por no tener imagen/)).toBeInTheDocument();
      expect(within(rep).getByText('Sin foto')).toBeInTheDocument();
      expect(within(rep).getByText('Mochi propio')).toBeInTheDocument();
      expect(within(rep).queryByText('Foto rechazada')).not.toBeInTheDocument();
      expect(within(rep).queryByText('Foto perdida')).not.toBeInTheDocument();
    });

    it('muestra el texto de cada motivo, sin códigos ni jerga', async () => {
      const reasons = Object.keys(PHOTO_REASON_LABEL);
      withReport({
        omittedNoImage: reasons.map((_, i) => ({ source: 'alegra', id: String(i), name: `Producto ${i + 1}` })),
        photos: {
          informed: reasons.length + 1,
          obtained: 1,
          notObtained: reasons.map((r, i) => ({ id: String(i), name: `Producto ${i + 1}`, reason: r })),
          allFailed: false,
        },
      });
      renderPage();
      await prepareNow();
      const rep = screen.getByTestId('review-report');
      reasons.forEach((r, i) => {
        expect(
          within(rep).getByText(`Producto ${i + 1} — ${PHOTO_REASON_LABEL[r as keyof typeof PHOTO_REASON_LABEL]}`),
        ).toBeInTheDocument();
      });
      expect(rep.textContent).not.toMatch(/\b(unauthorized|not_found|timeout|not_image|unsupported_format|too_large|unavailable)\b/);
    });

    it('si ninguna foto informada por Alegra se pudo obtener, advierte de un problema general y no lista producto por producto', async () => {
      withReport({
        omittedNoImage: [
          { source: 'alegra', id: '5', name: 'Sin foto' },
          { source: 'alegra', id: '6', name: 'Foto rechazada A' },
          { source: 'alegra', id: '7', name: 'Foto rechazada B' },
        ],
        counts: { included: 0, omitted: 3, soldOut: 0 },
        emptyCatalog: true,
        photos: {
          informed: 2,
          obtained: 0,
          notObtained: [
            { id: '6', name: 'Foto rechazada A', reason: 'unauthorized' },
            { id: '7', name: 'Foto rechazada B', reason: 'unauthorized' },
          ],
          allFailed: true,
        },
      });
      renderPage();
      await prepareNow();
      const rep = screen.getByTestId('review-report');

      expect(within(rep).getByText('No se pudo obtener ninguna foto de Alegra')).toBeInTheDocument();
      expect(rep).toHaveTextContent(/problema general/);
      expect(rep).toHaveTextContent(/conexión con Alegra/);
      // No se vuelca la lista de cada producto: el problema no es de cada producto
      expect(within(rep).queryByText(/con foto en Alegra que no se pudo obtener/)).not.toBeInTheDocument();
      expect(within(rep).queryByText(/Foto rechazada A/)).not.toBeInTheDocument();
      // El que de verdad no tiene foto en Alegra sigue en su aviso
      expect(within(rep).getByText('Sin foto')).toBeInTheDocument();
    });

    it('sin fotos no obtenidas no aparecen esos avisos y el de omitidos se ve como antes', async () => {
      mockApi();
      renderPage();
      await prepareNow();
      const rep = screen.getByTestId('review-report');
      expect(within(rep).queryByText(/No se pudo obtener ninguna foto/)).not.toBeInTheDocument();
      expect(within(rep).queryByText(/con foto en Alegra que no se pudo obtener/)).not.toBeInTheDocument();
      expect(within(rep).getByText(/1 producto\(s\) omitidos por no tener imagen/)).toBeInTheDocument();
      expect(within(rep).getByText('Sin foto')).toBeInTheDocument();
    });

    it('nunca muestra direcciones de fotos', async () => {
      withReport({
        photos: { informed: 1, obtained: 0, notObtained: [{ id: '6', name: 'Foto rechazada', reason: 'unauthorized' }], allFailed: false },
        omittedNoImage: [{ source: 'alegra', id: '6', name: 'Foto rechazada' }],
      });
      renderPage();
      await prepareNow();
      expect(screen.getByTestId('review-report').textContent).not.toMatch(/https?:\/\/|Signature=|Expires=/);
    });
  });

  it('habla de «badge AGOTADO», no de «sello»: con Cinta o Gris la indicación ya no es un sello', async () => {
    mockApi();
    renderPage();
    expect(screen.getByLabelText(/Ocultar los productos agotados/)).toBeInTheDocument();
    expect(screen.getByText(/si no, se muestran con el badge AGOTADO/)).toBeInTheDocument();
    await prepareNow();
    expect(screen.getByTestId('review-report')).toHaveTextContent('1 con badge AGOTADO');
    expect(screen.getByLabelText(/Mantener con badge AGOTADO/)).toBeInTheDocument();
    expect(screen.queryByText(/sello/i)).not.toBeInTheDocument();
  });

  it('no deja generar hasta decidir qué hacer con cada combo agotado', async () => {
    const calls = mockApi();
    renderPage();
    await prepareNow();
    const generate = screen.getByRole('button', { name: /Generar PDF/ });
    expect(generate).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Omitir del catálogo/));
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);

    await waitFor(() => expect(calls.some((c) => c.url === '/api/catalog/generate')).toBe(true));
    const gen = calls.find((c) => c.url === '/api/catalog/generate')!;
    expect(gen.body).toEqual({ prepareId: 'p1', bundleDecisions: { b1: 'omit' } });
  });

  it('permite mantener el combo con badge AGOTADO', async () => {
    const calls = mockApi();
    renderPage();
    await prepareNow();
    fireEvent.click(screen.getByLabelText(/Mantener con badge AGOTADO/));
    const generate = screen.getByRole('button', { name: /Generar PDF/ });
    await waitFor(() => expect(generate).toBeEnabled());
    fireEvent.click(generate);
    await waitFor(() => expect(calls.some((c) => c.url === '/api/catalog/generate')).toBe(true));
    expect(calls.find((c) => c.url === '/api/catalog/generate')!.body).toEqual({
      prepareId: 'p1',
      bundleDecisions: { b1: 'keep' },
    });
  });

  it('con catálogo vacío avisa y no permite generar', async () => {
    mockApi({
      'POST /api/catalog/prepare': () =>
        json(
          200,
          prepared({
            report: { ...report, soldOutBundles: [], uncategorized: [], omittedNoImage: [], counts: { included: 0, omitted: 0, soldOut: 0 }, emptyCatalog: true },
            structure: structure({ nothingToGenerate: true, totalPages: 0 }),
            availableSections: [],
          }),
        ),
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Preparar y revisar/ }));
    expect(await screen.findByText(/No hay productos para generar/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar PDF/ })).toBeDisabled();
  });

  it('muestra el error si Alegra no está configurado', async () => {
    mockApi({
      'POST /api/catalog/prepare': () =>
        json(422, { error: 'alegra_not_configured', message: 'Primero configura la conexión con Alegra.' }),
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Preparar y revisar/ }));
    expect(await screen.findByText('Primero configura la conexión con Alegra.')).toBeInTheDocument();
    expect(screen.queryByTestId('review-report')).not.toBeInTheDocument();
  });

  it('muestra el enlace de descarga cuando el trabajo termina', async () => {
    mockApi({
      'GET /api/catalog/jobs/current': () => json(200, { status: 'done', catalogId: 'c1' }),
    });
    renderPage();
    const link = await screen.findByRole('link', { name: 'Descargar PDF' });
    expect(link).toHaveAttribute('href', '/api/catalog/history/c1/pdf');
  });

  describe('plantilla de la generación (FR-022)', () => {
    const radios = () => screen.getAllByRole('radio', { name: /Neón Noche|Pop crema|Kraft minimal/ });

    it('lista las plantillas con su nombre, la marca de predeterminada y los colores, y parte de la predeterminada', async () => {
      mockApi();
      renderPage();
      const neon = await screen.findByRole('radio', { name: /Neón Noche/ });
      expect(radios()).toHaveLength(3);
      expect(neon).toBeChecked();
      expect(screen.getByRole('radio', { name: /Pop crema/ })).not.toBeChecked();
      const card = neon.closest('label')!;
      expect(card).toHaveTextContent('Predeterminada');
      expect(card.querySelectorAll('[data-testid="palette-dot"]')).toHaveLength(5);
      expect(screen.getByRole('radio', { name: /Pop crema/ }).closest('label')).not.toHaveTextContent('Predeterminada');
    });

    it('envía el templateId elegido al preparar', async () => {
      const calls = mockApi();
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: /Pop crema/ }));
      await prepareNow();
      expect(calls.find((c) => c.url === '/api/catalog/prepare')!.body).toMatchObject({ templateId: 'pop' });
    });

    it('sin tocar el selector envía la predeterminada', async () => {
      const calls = mockApi();
      renderPage();
      await screen.findByRole('radio', { name: /Neón Noche/ });
      await prepareNow();
      expect(calls.find((c) => c.url === '/api/catalog/prepare')!.body).toMatchObject({ templateId: 'neon' });
    });

    it('cambiarla después de preparar actualiza las opciones sin volver a preparar', async () => {
      const calls = mockApi();
      renderPage();
      await screen.findByRole('radio', { name: /Neón Noche/ });
      await prepareNow();
      fireEvent.click(screen.getByRole('radio', { name: /Kraft minimal/ }));
      await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
      expect(optionPuts(calls)[0]!.body).toMatchObject({ templateId: 'kraft' });
      expect(calls.filter((c) => c.url === '/api/catalog/prepare')).toHaveLength(1);
    });

    it('no cambia la plantilla predeterminada: nunca guarda plantillas', async () => {
      const calls = mockApi();
      renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: /Kraft minimal/ }));
      await prepareNow();
      expect(calls.some((c) => c.url === '/api/settings/templates')).toBe(false);
      expect(calls.some((c) => c.method === 'PUT' && c.url.startsWith('/api/settings/'))).toBe(false);
    });

    it('al volver a abrir la pantalla vuelve a aparecer la predeterminada', async () => {
      mockApi();
      const first = renderPage();
      fireEvent.click(await screen.findByRole('radio', { name: /Pop crema/ }));
      expect(screen.getByRole('radio', { name: /Pop crema/ })).toBeChecked();
      first.unmount();
      renderPage();
      expect(await screen.findByRole('radio', { name: /Neón Noche/ })).toBeChecked();
      expect(screen.getByRole('radio', { name: /Pop crema/ })).not.toBeChecked();
    });

    it('avisa cuando generate responde que la plantilla elegida ya no existe', async () => {
      mockApi({
        'POST /api/catalog/generate': () =>
          json(202, { jobId: 'j1', template: { id: 'neon', name: 'Neón Noche', fallback: true } }),
      });
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByLabelText(/Omitir del catálogo/));
      const generate = screen.getByRole('button', { name: /Generar PDF/ });
      await waitFor(() => expect(generate).toBeEnabled());
      fireEvent.click(generate);
      expect(await screen.findByText(/La plantilla elegida ya no existe/)).toHaveTextContent('Neón Noche');
    });

    it('no avisa cuando se usó la plantilla elegida', async () => {
      mockApi();
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByLabelText(/Omitir del catálogo/));
      const generate = screen.getByRole('button', { name: /Generar PDF/ });
      await waitFor(() => expect(generate).toBeEnabled());
      fireEvent.click(generate);
      await waitFor(() => expect(screen.getByText(/Generando PDF/)).toBeInTheDocument());
      expect(screen.queryByText(/La plantilla elegida ya no existe/)).not.toBeInTheDocument();
    });

    it('si no se pueden cargar las plantillas la pantalla sigue funcionando con la predeterminada del servidor', async () => {
      const calls = mockApi({ 'GET /api/settings/templates/summary': () => json(500, { error: 'x', message: 'no' }) });
      renderPage();
      await prepareNow();
      expect(screen.queryAllByRole('radio', { name: /Neón Noche|Pop crema/ })).toHaveLength(0);
      expect(calls.find((c) => c.url === '/api/catalog/prepare')!.body).not.toHaveProperty('templateId');
    });
  });

  describe('opciones y vista previa de estructura', () => {
    it('tras preparar lista las secciones disponibles, todas marcadas, y muestra la estructura', async () => {
      mockApi();
      renderPage();
      await prepareNow();
      const ramen = screen.getByRole('checkbox', { name: /RAMEN/ });
      const snacks = screen.getByRole('checkbox', { name: /SNACKS/ });
      expect(ramen).toBeChecked();
      expect(snacks).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /RAMEN/ }).closest('label')).toHaveTextContent('4 prod.');

      const preview = screen.getByTestId('structure-preview');
      expect(within(preview).getByText('Portadas')).toBeInTheDocument();
      expect(within(preview).getByText('Productos (máx. 3)')).toBeInTheDocument();
      expect(within(preview).getByText('Contenido propio / políticas')).toBeInTheDocument();
      expect(screen.getByTestId('structure-total')).toHaveTextContent('7 páginas');
    });

    it('desmarcar una sección recalcula la estructura en el servidor con las secciones restantes', async () => {
      const calls = mockApi({
        'PUT /api/catalog/prepare/p1/options': () =>
          json(
            200,
            prepared({
              structure: structure({ sectionCoverPages: 1, productPages: 1, totalPages: 4, sections: [{ key: 'alegra:c2', name: 'SNACKS', source: 'alegra', items: 1, pages: 1 }] }),
            }),
          ),
      });
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByRole('checkbox', { name: /RAMEN/ }));

      await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
      expect(optionPuts(calls)[0]!.body).toMatchObject({ sectionKeys: ['alegra:c2'], hideSoldOut: false });
      await waitFor(() => expect(screen.getByTestId('structure-total')).toHaveTextContent('4 páginas'));
      // la sección sigue en la lista para poder volver a marcarla
      expect(screen.getByRole('checkbox', { name: /RAMEN/ })).not.toBeChecked();
    });

    it('volver a marcar todas las secciones deja de enviar una lista explícita', async () => {
      const calls = mockApi();
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByRole('checkbox', { name: /RAMEN/ }));
      await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
      fireEvent.click(screen.getByRole('checkbox', { name: /RAMEN/ }));
      await waitFor(() => expect(optionPuts(calls)).toHaveLength(2));
      expect(optionPuts(calls)[1]!.body).not.toHaveProperty('sectionKeys');
    });

    it('ocultar agotados después de preparar actualiza las opciones sin volver a preparar', async () => {
      const calls = mockApi();
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByLabelText(/Ocultar los productos agotados/));
      await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
      expect(optionPuts(calls)[0]!.body).toMatchObject({ hideSoldOut: true });
      expect(calls.filter((c) => c.url === '/api/catalog/prepare')).toHaveLength(1);
    });

    it('el banner parte del texto guardado, se envía al preparar y al cambiarlo', async () => {
      const calls = mockApi();
      renderPage();
      const banner = await screen.findByLabelText('Texto del banner de portada');
      await waitFor(() => expect(banner).toHaveValue('Catálogo de productos'));
      fireEvent.change(banner, { target: { value: 'Oferta de octubre' } });
      await prepareNow();
      expect(calls.find((c) => c.url === '/api/catalog/prepare')!.body).toMatchObject({ bannerText: 'Oferta de octubre' });
      fireEvent.change(banner, { target: { value: 'Otro texto' } });
      await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
      expect(optionPuts(calls)[0]!.body).toMatchObject({ bannerText: 'Otro texto' });
    });

    it('las decisiones de combos viajan con las opciones para que la estructura coincida con el PDF', async () => {
      const calls = mockApi();
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByLabelText(/Omitir del catálogo/));
      await waitFor(() => expect(optionPuts(calls)).toHaveLength(1));
      expect(optionPuts(calls)[0]!.body).toMatchObject({ bundleDecisions: { b1: 'omit' } });
    });

    it('con todas las secciones desmarcadas muestra "nada que generar" y deshabilita Generar', async () => {
      mockApi({
        'PUT /api/catalog/prepare/p1/options': () =>
          json(
            200,
            prepared({
              report: { ...report, soldOutBundles: [], counts: { included: 0, omitted: 0, soldOut: 0 }, emptyCatalog: true },
              structure: structure({ nothingToGenerate: true, totalPages: 0, coverPages: 0, sectionCoverPages: 0, productPages: 0, termsPages: 0, ownItems: 0, sections: [] }),
            }),
          ),
      });
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByRole('checkbox', { name: /RAMEN/ }));
      fireEvent.click(screen.getByRole('checkbox', { name: /SNACKS/ }));
      expect(await screen.findByText(/No hay nada que generar con estas opciones/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Generar PDF/ })).toBeDisabled();
    });

    it('si la preparación expiró muestra el error del servidor', async () => {
      mockApi({
        'PUT /api/catalog/prepare/p1/options': () =>
          json(410, { error: 'prepare_expired', message: 'La revisión expiró. Vuelve a preparar el catálogo.' }),
      });
      renderPage();
      await prepareNow();
      fireEvent.click(screen.getByLabelText(/Ocultar los productos agotados/));
      expect(await screen.findByText('La revisión expiró. Vuelve a preparar el catálogo.')).toBeInTheDocument();
    });
  });
});
