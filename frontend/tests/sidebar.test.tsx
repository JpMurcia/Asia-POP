import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PanelSummary } from '../../backend/src/catalog/types';
import Sidebar from '../src/components/Sidebar';
import { useUnsavedGuard } from '../src/hooks/useUnsavedGuard';

const summary = (over: Partial<PanelSummary> = {}): PanelSummary => ({
  alegra: { status: 'ok', email: 'tienda@example.com', lastTestedAt: null },
  stats: { products: 40, soldOut: 3, uncategorized: 3, estimatedPages: 20 },
  sections: [],
  lastCatalog: null,
  generatedAt: '2026-10-03T00:00:00Z',
  ...over,
});

const renderSidebar = (s: PanelSummary | null, path = '/combos', onLogout = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar summary={s} onLogout={onLogout} />
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe('barra lateral', () => {
  it('muestra las entradas con los nombres del mockup, en orden', () => {
    renderSidebar(summary());
    const names = within(screen.getByRole('navigation', { name: 'Principal' }))
      .getAllByRole('link')
      .map((a) => a.textContent?.replace(/\d+$/, '').trim());
    expect(names).toEqual([
      'Inicio',
      'Conexión Alegra',
      'Sin categoría',
      'Contenido propio',
      'Combos',
      'Generar catálogo',
      'Historial',
      'Apariencia',
    ]);
  });

  it('resalta la entrada activa', () => {
    renderSidebar(summary(), '/combos');
    expect(screen.getByRole('link', { name: 'Combos' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('Inicio solo está activo en la raíz', () => {
    renderSidebar(summary(), '/');
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('aria-current', 'page');
  });

  it('muestra el contador de Sin categoría cuando hay pendientes', () => {
    renderSidebar(summary());
    expect(within(screen.getByRole('link', { name: /Sin categoría/ })).getByText('3')).toBeInTheDocument();
  });

  it('no muestra contador si no hay pendientes o Alegra no respondió', () => {
    const { unmount } = renderSidebar(summary({ stats: { products: 4, soldOut: 0, uncategorized: 0, estimatedPages: 4 } }));
    expect(screen.getByRole('link', { name: 'Sin categoría' })).toBeInTheDocument();
    unmount();
    renderSidebar(summary({ stats: null, sections: null }));
    expect(screen.getByRole('link', { name: 'Sin categoría' })).toBeInTheDocument();
  });

  it.each([
    [summary(), 'Alegra conectado'],
    [summary({ alegra: { status: 'unreachable', message: 'No se pudo conectar con Alegra.' }, stats: null, sections: null }), 'Sin conexión con Alegra'],
    [summary({ alegra: { status: 'not_configured' }, stats: null, sections: null }), 'Alegra sin configurar'],
    [null, 'Comprobando conexión…'],
  ])('indica el estado de la conexión en texto (%#)', (s, text) => {
    renderSidebar(s);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('muestra el correo de la cuenta conectada', () => {
    renderSidebar(summary());
    expect(screen.getByRole('status')).toHaveTextContent('tienda@example.com');
  });

  it('el botón Cerrar sesión llama a onLogout', () => {
    const onLogout = vi.fn();
    renderSidebar(summary(), '/', onLogout);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalled();
  });

  it('pide confirmación al navegar con cambios sin guardar y respeta la respuesta', () => {
    function Dirty() {
      useUnsavedGuard(true);
      return null;
    }
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={['/combos']}>
        <Dirty />
        <Sidebar summary={summary()} onLogout={() => {}} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Historial' }));
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Combos' })).toHaveAttribute('aria-current', 'page');

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Historial' }));
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('aria-current', 'page');
  });
});
