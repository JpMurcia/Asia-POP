import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Print from '../src/pages/Print';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

// La página no llega a dibujarse: solo importa qué datos pide al servidor
vi.mock('../src/services/api', () => ({
  api: { get },
  ApiError: class ApiError extends Error {},
}));

beforeEach(() => {
  get.mockReset();
  get.mockReturnValue(new Promise(() => {}));
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/print/:prepareId" element={<Print />} />
        <Route path="/vista-previa/:prepareId" element={<Print preview />} />
      </Routes>
    </MemoryRouter>,
  );

describe('vista de impresión: calidad del PDF', () => {
  it('con ?quality=optimized pide las fotos reducidas al servidor', () => {
    renderAt('/print/p1?quality=optimized');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/api/catalog/payload/p1?quality=optimized');
  });

  it('sin parámetro pide el payload de siempre', () => {
    renderAt('/print/p1');
    expect(get).toHaveBeenCalledWith('/api/catalog/payload/p1');
  });

  it('cualquier otro valor se ignora', () => {
    renderAt('/print/p1?quality=otro');
    expect(get).toHaveBeenCalledWith('/api/catalog/payload/p1');
    get.mockClear();
    renderAt('/print/p2?quality=original');
    expect(get).toHaveBeenCalledWith('/api/catalog/payload/p2');
  });

  it('la vista previa nunca pide el parámetro: ve siempre las fotos originales', () => {
    renderAt('/vista-previa/p1');
    expect(get).toHaveBeenCalledWith('/api/catalog/payload/p1');
    get.mockClear();
    renderAt('/vista-previa/p1?quality=optimized');
    expect(get).toHaveBeenCalledWith('/api/catalog/payload/p1');
  });
});
