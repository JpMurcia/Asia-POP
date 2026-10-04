import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PanelSummary } from '../../backend/src/catalog/types';
import Home from '../src/pages/Home';

const base: PanelSummary = {
  alegra: { status: 'ok', email: 'tienda@example.com', lastTestedAt: null },
  stats: { products: 40, soldOut: 5, uncategorized: 2, estimatedPages: 22 },
  sections: [
    { key: 'alegra:c1', name: 'RAMEN', source: 'alegra', items: 12, soldOut: 2 },
    { key: 'custom:m', name: 'MOCHIS', source: 'custom', items: 3, soldOut: 0 },
  ],
  lastCatalog: { id: 'c9', createdAt: '2026-10-02T15:30:00Z', includedCount: 35, omittedCount: 3, pages: 21 },
  generatedAt: '2026-10-03T00:00:00Z',
};

const renderHome = (summary: PanelSummary | null, extra: { error?: boolean; refresh?: () => Promise<void> } = {}) =>
  render(
    <MemoryRouter>
      <Home summary={summary} loading={false} error={extra.error ?? false} refresh={extra.refresh ?? (async () => {})} />
    </MemoryRouter>,
  );

describe('pantalla Inicio', () => {
  it('muestra los cuatro indicadores', () => {
    renderHome(base);
    expect(screen.getByLabelText('Productos activos en Alegra: 40')).toBeInTheDocument();
    expect(screen.getByLabelText('Agotados: 5')).toBeInTheDocument();
    expect(screen.getByLabelText('Sin categoría: 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Páginas estimadas: 22')).toBeInTheDocument();
  });

  it('el indicador de agotados explica que salen con badge AGOTADO (no «sello»)', () => {
    renderHome(base);
    expect(screen.getByText('Salen con badge AGOTADO')).toBeInTheDocument();
    expect(screen.queryByText(/sello/i)).not.toBeInTheDocument();
  });

  it('lista las secciones con productos, agotados y origen', () => {
    renderHome(base);
    const sections = screen.getByRole('heading', { name: 'Secciones del catálogo' }).closest('div')!;
    const ramen = within(sections).getByText('RAMEN').closest('li')!;
    expect(ramen).toHaveTextContent('12 prod.');
    expect(ramen).toHaveTextContent('2 agotados');
    expect(ramen).toHaveTextContent('Alegra');
    expect(within(sections).getByText('MOCHIS').closest('li')).toHaveTextContent('Propia');
  });

  it('muestra el último catálogo con fecha, páginas y descarga', () => {
    renderHome(base);
    expect(screen.getByText(/21 páginas · 35 productos · 3 omitidos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('href', '/api/catalog/history/c9/pdf');
  });

  it('ofrece el acceso directo cuando hay ítems sin categoría', () => {
    renderHome(base);
    expect(screen.getByText('2 productos de Alegra sin categoría')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Asignar secciones' })).toHaveAttribute('href', '/sin-categoria');
  });

  it('sin pendientes no muestra la alerta', () => {
    renderHome({ ...base, stats: { ...base.stats!, uncategorized: 0 } });
    expect(screen.queryByRole('link', { name: 'Asignar secciones' })).not.toBeInTheDocument();
  });

  it('sin catálogos generados invita a generar el primero', () => {
    renderHome({ ...base, lastCatalog: null });
    expect(screen.getByRole('link', { name: 'Genera el primero' })).toHaveAttribute('href', '/generar');
  });

  it('con Alegra caído muestra los indicadores como no disponibles, el error y el último catálogo', () => {
    const refresh = vi.fn(async () => {});
    renderHome(
      { ...base, alegra: { status: 'unreachable', message: 'No se pudo conectar con Alegra.' }, stats: null, sections: null },
      { refresh },
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo conectar con Alegra.');
    expect(screen.getByLabelText('Productos activos en Alegra: —')).toBeInTheDocument();
    expect(screen.getAllByText('No disponible sin Alegra').length).toBe(4);
    expect(screen.getByRole('link', { name: 'Descargar PDF' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('sin conexión configurada invita a configurarla', () => {
    renderHome({ ...base, alegra: { status: 'not_configured' }, stats: null, sections: null, lastCatalog: null });
    expect(screen.getByRole('link', { name: /Configura la conexión con Alegra/ })).toHaveAttribute('href', '/alegra');
  });

  it('si el resumen no se pudo cargar muestra el error con Reintentar', () => {
    renderHome(null, { error: true });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar el resumen');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
