import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlegraDataStatus } from '../../backend/src/catalog/types';
import LoadingScreen, { LIST_AREA_MIN_HEIGHT } from '../src/components/ui/LoadingScreen';
import { useLoadingScreen } from '../src/hooks/useAlegraData';

const status = (over: Partial<AlegraDataStatus> = {}): AlegraDataStatus => ({
  state: 'syncing',
  syncedAt: null,
  articles: null,
  categories: null,
  progress: { phase: 'items', received: 0 },
  lastError: null,
  ...over,
});

describe('LoadingScreen', () => {
  it('trae el título, el texto de «solo pasa la primera vez» y el indicador de avance sin valor', () => {
    render(<LoadingScreen status={status()} />);
    expect(screen.getByRole('heading', { name: 'Descargando los artículos de Alegra' })).toBeInTheDocument();
    expect(
      screen.getByText('Solo pasa la primera vez o cuando actualizas. Puedes ir a otra pantalla: la descarga sigue.'),
    ).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-busy', 'true');
    expect(bar).not.toHaveAttribute('aria-valuenow'); // Alegra no informa el total: no hay porcentaje
  });

  it('con 0 recibidos dice «Conectando con Alegra…» y con 90 «90 artículos recibidos»', () => {
    const { rerender } = render(<LoadingScreen status={status()} />);
    expect(screen.getByText('Conectando con Alegra…')).toBeInTheDocument();
    rerender(<LoadingScreen status={status({ progress: { phase: 'items', received: 90 } })} />);
    expect(screen.getByText('90 artículos recibidos')).toBeInTheDocument();
    expect(screen.queryByText('Conectando con Alegra…')).not.toBeInTheDocument();
  });

  it('sin estado todavía, o en la fase de categorías, no inventa una cifra de artículos', () => {
    const { rerender } = render(<LoadingScreen status={null} />);
    expect(screen.getByText('Conectando con Alegra…')).toBeInTheDocument();
    rerender(<LoadingScreen status={status({ progress: { phase: 'categories', received: 21 } })} />);
    expect(screen.getByText('Conectando con Alegra…')).toBeInTheDocument();
    expect(screen.queryByText(/artículos recibidos/)).not.toBeInTheDocument();
  });

  it('el avance se anuncia con aria-live «polite»', () => {
    render(<LoadingScreen status={status({ progress: { phase: 'items', received: 30 } })} />);
    expect(screen.getByText('30 artículos recibidos').closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('reserva el espacio de la lista: esqueleto con la búsqueda, las etiquetas y unas 8 filas, y la misma altura mínima que la lista', () => {
    render(<LoadingScreen status={status()} />);
    const root = screen.getByTestId('loading-screen');
    expect(root.style.minHeight).toBe(LIST_AREA_MIN_HEIGHT);
    expect(root.querySelectorAll('[data-skeleton="search"]')).toHaveLength(1);
    expect(root.querySelectorAll('[data-skeleton="chip"]').length).toBeGreaterThanOrEqual(5);
    expect(root.querySelectorAll('[data-skeleton="row"]')).toHaveLength(8);
  });

  it('el esqueleto no se anuncia a los lectores de pantalla y su animación se apaga con prefers-reduced-motion', () => {
    render(<LoadingScreen status={status()} />);
    const skeleton = screen.getByTestId('loading-screen').querySelector('[data-skeleton="row"]')!;
    expect(skeleton.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('progressbar').className).toMatch(/motion-reduce:animate-none/);
    expect(skeleton.className).toMatch(/motion-reduce:animate-none/);
  });
});

describe('useLoadingScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const stubStatus = (body: AlegraDataStatus | null) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('{}', { status: 404 }))),
    );
  const settle = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });

  it('no se muestra antes de ~300 ms de espera y sí después', async () => {
    stubStatus(status({ state: 'ready', progress: null, syncedAt: '2026-10-10T14:00:00.000Z' }));
    const { result } = renderHook(({ pending }) => useLoadingScreen(pending), { initialProps: { pending: true } });
    await settle(250);
    expect(result.current.show).toBe(false);
    await settle(100);
    expect(result.current.show).toBe(true);
  });

  it('se muestra de inmediato si el estado de los datos es «syncing»', async () => {
    stubStatus(status({ progress: { phase: 'items', received: 40 } }));
    const { result } = renderHook(() => useLoadingScreen(true));
    await settle(10);
    expect(result.current.show).toBe(true);
    expect(result.current.status?.progress).toEqual({ phase: 'items', received: 40 });
  });

  it('con datos que llegan antes del umbral nunca se muestra', async () => {
    stubStatus(status({ state: 'ready', progress: null, syncedAt: '2026-10-10T14:00:00.000Z' }));
    const { result, rerender } = renderHook(({ pending }) => useLoadingScreen(pending), { initialProps: { pending: true } });
    await settle(120);
    rerender({ pending: false });
    await settle(1000);
    expect(result.current.show).toBe(false);
  });

  it('al terminar de cargar se apaga y vuelve a empezar con la siguiente espera', async () => {
    stubStatus(status({ state: 'ready', progress: null, syncedAt: '2026-10-10T14:00:00.000Z' }));
    const { result, rerender } = renderHook(({ pending }) => useLoadingScreen(pending), { initialProps: { pending: true } });
    await settle(400);
    expect(result.current.show).toBe(true);
    rerender({ pending: false });
    await settle(10);
    expect(result.current.show).toBe(false);
    rerender({ pending: true });
    await settle(100);
    expect(result.current.show).toBe(false);
  });

  it('sin pedir nada si no hay espera (pending falso no consulta el estado)', async () => {
    stubStatus(status());
    renderHook(() => useLoadingScreen(false));
    await settle(2000);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('mientras espera consulta el avance cada ~800 ms y deja de hacerlo al terminar', async () => {
    stubStatus(status());
    const { rerender } = renderHook(({ pending }) => useLoadingScreen(pending), { initialProps: { pending: true } });
    await settle(10);
    const first = vi.mocked(fetch).mock.calls.length;
    await settle(1700);
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(first + 2);
    rerender({ pending: false });
    const stopped = vi.mocked(fetch).mock.calls.length;
    await settle(5000);
    expect(vi.mocked(fetch).mock.calls.length).toBe(stopped);
  });

  it('si el servidor no responde sobre el estado, la espera igual se muestra pasado el umbral', async () => {
    stubStatus(null);
    const { result } = renderHook(() => useLoadingScreen(true));
    await settle(400);
    expect(result.current.show).toBe(true);
    expect(result.current.status).toBeNull();
  });
});
