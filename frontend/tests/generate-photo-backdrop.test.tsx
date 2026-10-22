import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHOTO_BACKDROP_OPTIONS } from '../../backend/src/catalog/photo-backdrop';
import Generate from '../src/pages/Generate';

/** Feature 010: la opción «Fondo de la foto» y su tarjeta de ejemplo en la pantalla Generar. */
const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });
const palette = { bg: '#11052C', a1: '#FF007A', a2: '#00FF66', a3: '#FF9900', ink: '#1C1126', paper: '#F4EFE8' };
const fonts = { title: 'fredoka', body: 'poppins' };
const CARD = `/media/cards/${'a'.repeat(40)}.jpg`;

const report = {
  uncategorized: [],
  omittedNoImage: [],
  omittedNoSection: [],
  omittedByChoice: [],
  soldOutBundles: [],
  counts: { included: 4, omitted: 0, soldOut: 0 },
  emptyCatalog: false,
  photos: { informed: 4, obtained: 4, notObtained: [], allFailed: false },
};
const prepared = {
  prepareId: 'p1',
  report,
  structure: { coverPages: 1, sectionCoverPages: 1, productPages: 2, termsPages: 1, ownItems: 0, totalPages: 5, nothingToGenerate: false, sections: [] },
  availableSections: [],
  options: { hideSoldOut: false },
};

function mockApi(opts: { defaultId: string; job?: object }) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, method, body });
      const key = `${method} ${url}`;
      if (key === 'GET /api/catalog/jobs/current') return json(200, opts.job ?? { status: 'idle' });
      if (key === 'GET /api/settings/business') return json(200, { coverTitle: 'Catálogo' });
      if (key === 'GET /api/settings/templates/summary') {
        return json(200, {
          defaultId: opts.defaultId,
          items: [
            { id: 'neon', name: 'Neón Noche', isDefault: opts.defaultId === 'neon', palette, fonts },
            { id: 'base', name: 'Base AsianPop', isDefault: opts.defaultId === 'base', palette, fonts, photoCards: true },
          ],
        });
      }
      if (key === 'POST /api/catalog/prepare') return json(200, prepared);
      if (key === 'PUT /api/catalog/prepare/p1/options') return json(200, prepared);
      if (key === 'POST /api/catalog/card-preview') {
        const used = (body as { backdrop: string }).backdrop;
        return json(200, { url: CARD, used, fellBack: false, reason: null, itemName: 'Shin Ramyun' });
      }
      if (key === 'POST /api/catalog/generate') return json(202, { jobId: 'j1', template: { id: 'base', name: 'Base AsianPop', fallback: false } });
      return json(404, { error: 'not_found', message: 'no' });
    }),
  );
  return calls;
}
const renderPage = () =>
  render(
    <MemoryRouter>
      <Generate />
    </MemoryRouter>,
  );
afterEach(() => vi.unstubAllGlobals());

describe('Generar: Fondo de la foto', () => {
  it('con una plantilla de foto-tarjeta ofrece los dos modos, «Dejar como está» preseleccionado', async () => {
    mockApi({ defaultId: 'base' });
    renderPage();
    const group = await screen.findByTestId('photo-backdrop');
    expect(group).toHaveTextContent(PHOTO_BACKDROP_OPTIONS.marco.label);
    expect(group).toHaveTextContent(PHOTO_BACKDROP_OPTIONS['sin-fondo'].label);
    expect(screen.getByRole('radio', { name: new RegExp(PHOTO_BACKDROP_OPTIONS.marco.label) })).toBeChecked();
  });

  it('con una plantilla sin tarjeta no muestra la opción ni la envía', async () => {
    const calls = mockApi({ defaultId: 'neon' });
    renderPage();
    await waitFor(() => expect(calls.some((c) => c.url === '/api/settings/templates/summary')).toBe(true));
    fireEvent.click(await screen.findByRole('button', { name: /Preparar y revisar/ }));
    await screen.findByTestId('review-report');
    expect(screen.queryByTestId('photo-backdrop')).toBeNull();
    const prepare = calls.find((c) => c.method === 'POST' && c.url === '/api/catalog/prepare')!;
    expect(prepare.body).not.toHaveProperty('photoBackdrop');
    fireEvent.click(screen.getByRole('button', { name: /Generar PDF/ }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/catalog/generate')).toBe(true));
    expect(calls.find((c) => c.url === '/api/catalog/generate')!.body).not.toHaveProperty('photoBackdrop');
  });

  it('muestra la tarjeta de ejemplo tras preparar y la pide de nuevo al cambiar de modo', async () => {
    const calls = mockApi({ defaultId: 'base' });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Preparar y revisar/ }));
    const preview = await screen.findByTestId('card-preview');
    await waitFor(() => expect(preview.querySelector('img')?.getAttribute('src')).toBe(CARD));
    const previews = () => calls.filter((c) => c.url === '/api/catalog/card-preview');
    expect(previews()[0]!.body).toMatchObject({ prepareId: 'p1', backdrop: 'marco' });

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(PHOTO_BACKDROP_OPTIONS['sin-fondo'].label) }));
    await waitFor(() => expect(previews().at(-1)!.body).toMatchObject({ prepareId: 'p1', backdrop: 'sin-fondo' }));
  });

  it('el modo elegido viaja al preparar y al generar', async () => {
    const calls = mockApi({ defaultId: 'base' });
    renderPage();
    fireEvent.click(await screen.findByRole('radio', { name: new RegExp(PHOTO_BACKDROP_OPTIONS['sin-fondo'].label) }));
    fireEvent.click(screen.getByRole('button', { name: /Preparar y revisar/ }));
    await screen.findByTestId('review-report');
    expect(calls.find((c) => c.method === 'POST' && c.url === '/api/catalog/prepare')!.body).toMatchObject({ photoBackdrop: 'sin-fondo' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Generar PDF/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Generar PDF/ }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/catalog/generate')).toBe(true));
    expect(calls.find((c) => c.url === '/api/catalog/generate')!.body).toMatchObject({ prepareId: 'p1', photoBackdrop: 'sin-fondo' });
  });

  it('al terminar avisa cuántas fotos se dejaron con su fondo original y cuáles', async () => {
    mockApi({
      defaultId: 'base',
      job: { status: 'done', catalogId: 'c1', sizeBytes: 5_000_000, quality: 'optimized', backdropFallbacks: [{ item: 'Shin Ramyun' }, { item: 'Pepero' }] },
    });
    renderPage();
    const notice = await screen.findByTestId('backdrop-fallback-notice');
    expect(notice).toHaveTextContent('2 fotos se dejaron con su fondo original');
    expect(notice).toHaveTextContent('Shin Ramyun, Pepero');
  });
});
