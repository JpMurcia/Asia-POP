import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_FIT, useFit } from '../src/print/useFit';

/**
 * jsdom no calcula el layout (todo mide 0). Aquí `scrollHeight`/`scrollWidth` se simulan como una función del
 * factor `--fit` que useFit escribe: el contenido ocupa `natural * fit` y la caja mide `limit`.
 */
interface Metrics {
  naturalHeight: number;
  naturalWidth: number;
  boxWidth: number;
}
let metrics: Metrics;

const fitOf = (el: HTMLElement) => parseFloat(el.style.getPropertyValue('--fit') || '1');

beforeEach(() => {
  metrics = { naturalHeight: 100, naturalWidth: 100, boxWidth: 100 };
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return metrics.naturalHeight * fitOf(this);
  });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return metrics.naturalWidth * fitOf(this);
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => metrics.boxWidth);
});
afterEach(() => vi.restoreAllMocks());

function Box({
  limit = 100,
  fontSize = 20,
  childSize,
  opts,
  dep = 0,
}: {
  limit?: number;
  fontSize?: number;
  /** Tamaño de letra de un hijo más pequeño que el contenedor. */
  childSize?: number;
  opts?: Parameters<typeof useFit>[2];
  dep?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFit(ref, [dep], opts);
  return (
    <div ref={ref} data-testid="box" style={{ maxHeight: `${limit}px`, fontSize: `${fontSize}px` }}>
      texto
      {childSize && <small style={{ fontSize: `${childSize}px` }}>detalle</small>}
    </div>
  );
}

const box = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-testid="box"]')!;

describe('useFit', () => {
  it('no reduce nada si el contenido ya cabe', () => {
    const { container } = render(<Box limit={100} />);
    expect(fitOf(box(container))).toBe(1);
    expect(box(container)).not.toHaveAttribute('data-overflow');
  });

  it('reduce --fit hasta que el contenido cabe en el alto', () => {
    metrics.naturalHeight = 200; // el doble de lo que cabe
    const { container } = render(<Box limit={100} />);
    const fit = fitOf(box(container));
    expect(fit).toBeLessThan(0.55);
    expect(fit).toBeGreaterThanOrEqual(MIN_FIT);
    expect(metrics.naturalHeight * fit).toBeLessThanOrEqual(101);
    expect(box(container)).not.toHaveAttribute('data-overflow');
  });

  it('con axis "height" (por defecto) ignora el ancho', () => {
    metrics.naturalWidth = 300;
    const { container } = render(<Box />);
    expect(fitOf(box(container))).toBe(1);
  });

  it('con axis "width" reduce hasta que el contenido cabe en el ancho', () => {
    metrics.naturalWidth = 200;
    const { container } = render(<Box opts={{ axis: 'width' }} />);
    const fit = fitOf(box(container));
    expect(fit).toBeLessThan(0.55);
    expect(metrics.naturalWidth * fit).toBeLessThanOrEqual(101);
  });

  it('con axis "both" cuida el alto y el ancho', () => {
    metrics.naturalHeight = 100; // el alto cabe
    metrics.naturalWidth = 150; // el ancho no
    const w = render(<Box opts={{ axis: 'both' }} />);
    expect(fitOf(box(w.container))).toBeLessThan(1);
    expect(150 * fitOf(box(w.container))).toBeLessThanOrEqual(101);
    w.unmount();
    metrics.naturalHeight = 150; // el alto no cabe
    metrics.naturalWidth = 100; // el ancho sí
    const h = render(<Box opts={{ axis: 'both' }} />);
    expect(fitOf(box(h.container))).toBeLessThan(1);
    expect(150 * fitOf(box(h.container))).toBeLessThanOrEqual(101);
  });

  describe('tamaño mínimo legible', () => {
    it('nunca baja de MIN_FIT en un texto grande', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={40} />);
      expect(fitOf(box(container))).toBeCloseTo(MIN_FIT, 2);
      expect(box(container)).toHaveAttribute('data-overflow', 'true');
    });

    it('un texto base de 8 px no baja de 6 px (factor 0,75)', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={8} />);
      expect(fitOf(box(container))).toBeCloseTo(0.75, 2);
      expect(box(container)).toHaveAttribute('data-overflow', 'true');
    });

    it('un texto de 40 px llega a 18 px como mínimo (MIN_FIT)', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={40} />);
      expect(40 * fitOf(box(container))).toBeCloseTo(18, 0);
    });

    it('minFontPx cambia el mínimo', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={20} opts={{ minFontPx: 12 }} />);
      expect(fitOf(box(container))).toBeCloseTo(0.6, 2);
    });

    it('un texto base menor que el mínimo no se reduce', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={5} />);
      expect(fitOf(box(container))).toBe(1);
      expect(box(container)).toHaveAttribute('data-overflow', 'true');
    });
  });

  describe('el mínimo se cuenta sobre el texto más pequeño del bloque', () => {
    it('un hijo de 10 px en un bloque de 20 px no baja de 6 px: el factor mínimo es 0,6, no 0,45', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={20} childSize={10} />);
      expect(fitOf(box(container))).toBeCloseTo(0.6, 2);
      expect(10 * fitOf(box(container))).toBeGreaterThanOrEqual(6 - 0.05);
      expect(box(container)).toHaveAttribute('data-overflow', 'true');
    });

    it('un hijo más grande que el contenedor no cambia el mínimo', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={20} childSize={30} />);
      expect(fitOf(box(container))).toBeCloseTo(0.45, 2);
    });
  });

  describe('último recurso: recorte por líneas', () => {
    const steps = [{ '--lines': '4' }, { '--lines': '3' }, { '--lines': '2' }];
    const linesOf = (el: HTMLElement) => el.style.getPropertyValue('--lines');

    it('no se usa mientras reducir la letra baste', () => {
      metrics.naturalHeight = 150;
      const { container } = render(<Box fontSize={20} opts={{ lastResort: steps }} />);
      expect(linesOf(box(container))).toBe('');
      expect(box(container)).not.toHaveAttribute('data-overflow');
    });

    it('al llegar al mínimo sin caber aplica los pasos hasta que cabe, sin bajar la letra del mínimo', () => {
      // el contenido no cabe a ningún tamaño, pero cada paso lo acorta: alto = natural × fit × (líneas / 5)
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
        const lines = parseFloat(this.style.getPropertyValue('--lines') || '5');
        return 300 * fitOf(this) * (lines / 5);
      });
      const { container } = render(<Box fontSize={20} limit={100} opts={{ lastResort: steps }} />);
      // a fit 0,45: 135 con 5 líneas, 108 con 4 y 81 con 3 → cabe en el paso de 3 líneas
      expect(linesOf(box(container))).toBe('3');
      expect(fitOf(box(container))).toBeCloseTo(0.45, 2);
      expect(box(container)).not.toHaveAttribute('data-overflow');
    });

    it('si ni así cabe, queda en el último paso y marca data-overflow', () => {
      metrics.naturalHeight = 10_000;
      const { container } = render(<Box fontSize={20} opts={{ lastResort: steps }} />);
      expect(linesOf(box(container))).toBe('2');
      expect(box(container)).toHaveAttribute('data-overflow', 'true');
    });

    it('al volver a ajustar con un contenido que cabe quita los pasos', () => {
      metrics.naturalHeight = 10_000;
      const { container, rerender } = render(<Box fontSize={20} dep={0} opts={{ lastResort: steps }} />);
      expect(linesOf(box(container))).toBe('2');
      metrics.naturalHeight = 50;
      rerender(<Box fontSize={20} dep={1} opts={{ lastResort: steps }} />);
      expect(linesOf(box(container))).toBe('');
      expect(box(container)).not.toHaveAttribute('data-overflow');
    });
  });

  describe('data-overflow', () => {
    it('se marca cuando llega al mínimo y aún no cabe, y se quita si después cabe', () => {
      metrics.naturalHeight = 10_000;
      const { container, rerender } = render(<Box dep={0} />);
      expect(box(container)).toHaveAttribute('data-overflow', 'true');
      metrics.naturalHeight = 50;
      rerender(<Box dep={1} />);
      expect(box(container)).not.toHaveAttribute('data-overflow');
      expect(fitOf(box(container))).toBe(1);
    });

    it('un contenido que cabe tras reducir no se marca', () => {
      metrics.naturalHeight = 160;
      const { container } = render(<Box fontSize={20} />);
      expect(fitOf(box(container))).toBeLessThan(1);
      expect(box(container)).not.toHaveAttribute('data-overflow');
    });
  });

  it('vuelve a ajustar cuando cambian las dependencias', () => {
    metrics.naturalHeight = 200;
    const { container, rerender } = render(<Box dep={0} />);
    const small = fitOf(box(container));
    metrics.naturalHeight = 50;
    rerender(<Box dep={1} />);
    expect(fitOf(box(container))).toBe(1);
    expect(small).toBeLessThan(1);
  });
});
