import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlegraDataStatus } from '../../backend/src/catalog/types';
import AlegraDataBar from '../src/components/AlegraDataBar';
import { SUMMARY_CHANGED_EVENT } from '../src/hooks/usePanelSummary';

const NOW = new Date('2026-10-10T14:05:00.000Z');
const SYNCED = '2026-10-10T14:00:00.000Z'; // hace 5 min

const status = (over: Partial<AlegraDataStatus> = {}): AlegraDataStatus => ({
  state: 'ready',
  syncedAt: SYNCED,
  articles: 197,
  categories: 21,
  progress: null,
  lastError: null,
  ...over,
});
const syncing = (received: number, over: Partial<AlegraDataStatus> = {}) =>
  status({ state: 'syncing', progress: { phase: 'items', received }, ...over });

/** Respuestas encoladas por ruta; la última se repite. */
function mockApi(queues: { get?: AlegraDataStatus[]; post?: AlegraDataStatus[]; postFails?: boolean } = {}) {
  const calls: { method: string; url: string }[] = [];
  const get = [...(queues.get ?? [status()])];
  const post = [...(queues.post ?? [syncing(0)])];
  const next = <T,>(q: T[]): T => (q.length > 1 ? q.shift()! : q[0]!);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      if (url === '/api/alegra/data' && method === 'GET') return new Response(JSON.stringify(next(get)), { status: 200 });
      if (url === '/api/alegra/data/refresh' && method === 'POST') {
        if (queues.postFails) return new Response(JSON.stringify({ error: 'alegra_not_configured', message: 'Primero configura la conexión con Alegra.' }), { status: 422 });
        return new Response(JSON.stringify(next(post)), { status: 202 });
      }
      return new Response('{}', { status: 404 });
    }),
  );
  return { calls, polls: () => calls.filter((c) => c.method === 'GET').length };
}

/** Deja correr las promesas y los temporizadores simulados `ms` milisegundos. */
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AlegraDataBar', () => {
  it('con datos guardados muestra su antigüedad y el botón «Actualizar desde Alegra»', async () => {
    mockApi();
    render(<AlegraDataBar />);
    await settle();
    expect(screen.getByText('Datos de Alegra actualizados hace 5 min.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar desde Alegra' })).toBeEnabled();
  });

  it('la antigüedad envejece sola', async () => {
    mockApi();
    render(<AlegraDataBar />);
    await settle();
    expect(screen.getByText('Datos de Alegra actualizados hace 5 min.')).toBeInTheDocument();
    await settle(31_000 * 3); // useNow se refresca cada 30 s
    expect(screen.getByText(/Datos de Alegra actualizados hace 6 min\./)).toBeInTheDocument();
  });

  it('sin datos («none») no muestra nada', async () => {
    mockApi({ get: [status({ state: 'none', syncedAt: null, articles: null, categories: null })] });
    const { container } = render(<AlegraDataBar />);
    await settle();
    expect(container).toBeEmptyDOMElement();
  });

  it('al pulsar actualizar pide la descarga, muestra el avance cada ~800 ms y, al terminar, avisa una sola vez', async () => {
    const { calls, polls } = mockApi({
      get: [status(), syncing(30), syncing(90), status({ syncedAt: '2026-10-10T14:05:30.000Z', articles: 200 })],
      post: [syncing(0)],
    });
    const onRefreshed = vi.fn();
    const summaryChanged = vi.fn();
    window.addEventListener(SUMMARY_CHANGED_EVENT, summaryChanged);
    render(<AlegraDataBar onRefreshed={onRefreshed} />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar desde Alegra' }));
    await settle();
    expect(calls.some((c) => c.method === 'POST' && c.url === '/api/alegra/data/refresh')).toBe(true);
    const busy = screen.getByRole('button', { name: /Actualizar desde Alegra|Actualizando/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Conectando con Alegra…')).toBeInTheDocument();

    const before = polls();
    await settle(800);
    expect(polls()).toBe(before + 1);
    expect(screen.getByText('Actualizando desde Alegra… 30 artículos recibidos.')).toBeInTheDocument();
    await settle(800);
    expect(screen.getByText('Actualizando desde Alegra… 90 artículos recibidos.')).toBeInTheDocument();
    expect(onRefreshed).not.toHaveBeenCalled();

    await settle(800);
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    expect(summaryChanged).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Actualizar desde Alegra' })).toBeEnabled();
    expect(screen.getByText(/Datos de Alegra actualizados/)).toBeInTheDocument();

    // ya no consulta
    const after = polls();
    await settle(5000);
    expect(polls()).toBe(after);
    expect(onRefreshed).toHaveBeenCalledTimes(1);
    window.removeEventListener(SUMMARY_CHANGED_EVENT, summaryChanged);
  });

  it('el texto de progreso es una región aria-live «polite»', async () => {
    mockApi({ get: [syncing(90)] });
    render(<AlegraDataBar />);
    await settle();
    const text = screen.getByText('Actualizando desde Alegra… 90 artículos recibidos.');
    expect(text.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('con 0 recibidos o en la fase de categorías dice «Conectando con Alegra…», sin cifra', async () => {
    mockApi({ get: [status({ state: 'syncing', progress: { phase: 'categories', received: 21 } })] });
    render(<AlegraDataBar />);
    await settle();
    expect(screen.getByText('Conectando con Alegra…')).toBeInTheDocument();
    expect(screen.queryByText(/artículos recibidos/)).not.toBeInTheDocument();
  });

  it('con la copia vigente y una actualización en curso, el botón queda deshabilitado', async () => {
    mockApi({ get: [syncing(10)] });
    render(<AlegraDataBar />);
    await settle();
    expect(screen.getByRole('button', { name: /Actualizar desde Alegra/ })).toBeDisabled();
  });

  it('si la última actualización falló muestra el aviso con la antigüedad de lo que se ve y «Reintentar»', async () => {
    const lastError = { message: 'No se pudo conectar con Alegra.', at: '2026-10-10T14:04:00.000Z' };
    const { calls } = mockApi({ get: [status({ lastError })], post: [syncing(0)] });
    render(<AlegraDataBar />);
    await settle();
    expect(
      screen.getByText('No se pudo actualizar desde Alegra: No se pudo conectar con Alegra. Estás viendo los datos de hace 5 min.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actualizar desde Alegra' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await settle();
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
  });

  it('una descarga en curso al abrir la pantalla se sigue sin pedirla y no avisa de «actualizada» (no la pidió esta pantalla)', async () => {
    const { calls } = mockApi({ get: [syncing(20), syncing(60), status()] });
    const onRefreshed = vi.fn();
    render(<AlegraDataBar onRefreshed={onRefreshed} />);
    await settle();
    await settle(800);
    await settle(800);
    expect(screen.getByText(/Datos de Alegra actualizados/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(onRefreshed).not.toHaveBeenCalled();
  });

  it('deja de consultar al desmontarse', async () => {
    const { polls } = mockApi({ get: [syncing(10)] });
    const view = render(<AlegraDataBar />);
    await settle();
    await settle(800);
    view.unmount();
    const at = polls();
    await settle(5000);
    expect(polls()).toBe(at);
  });

  it('si no se puede pedir la actualización (422) la barra sigue mostrando lo guardado', async () => {
    mockApi({ postFails: true });
    render(<AlegraDataBar />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar desde Alegra' }));
    await settle();
    expect(screen.getByText(/Datos de Alegra actualizados hace 5 min/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualizar desde Alegra' })).toBeEnabled();
  });
});
