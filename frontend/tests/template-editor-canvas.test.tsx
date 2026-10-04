import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_H, PAGE_W, RANGES, tokensFrom, type PageElement, type Template } from '../../backend/src/catalog/template';
import { baseTemplate, draftText } from '../../backend/src/catalog/template-presets';
import { DEFAULT_BUSINESS } from '../../backend/src/catalog/settings.repo';
import Canvas, { type CanvasProps } from '../src/pages/TemplateEditor/Canvas';
import {
  CENTER_TOLERANCE_X,
  CENTER_TOLERANCE_Y,
  MIN_H,
  MIN_W,
  computeDrag,
} from '../src/pages/TemplateEditor/usePointerDrag';

/** Rectángulo de la página en pantalla: 1 px de pantalla = 1 px lógico × escala. */
const SCALE = 1;
const RECT = { left: 100, top: 50, width: PAGE_W * SCALE, height: PAGE_H * SCALE, right: 100 + PAGE_W, bottom: 50 + PAGE_H, x: 100, y: 50, toJSON: () => ({}) };

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT as DOMRect);
});
afterEach(() => vi.restoreAllMocks());

const pct = (n: number, of: number) => (n / 100) * of; // % de la página → px de pantalla

const el = (id: string, over: Record<string, unknown> = {}): PageElement => ({ ...draftText({ text: id, x: 10, y: 10, w: 40, h: 10, ...over }), id });

/** Plantilla con una página Portada de solo dos elementos libres. */
function template(...els: PageElement[]): Template {
  const t = baseTemplate('pop');
  t.pages.portada.els = els;
  return t;
}

function setup(over: Partial<CanvasProps> = {}, els: PageElement[] = [el('a')]) {
  const props: CanvasProps = {
    template: template(...els),
    page: 'portada',
    tokens: tokensFrom(DEFAULT_BUSINESS, 'RAMEN'),
    scale: SCALE,
    selId: null,
    onSelect: vi.fn(),
    onCheckpoint: vi.fn(),
    onPatch: vi.fn(),
    ...over,
  };
  const view = render(<Canvas {...props} />);
  return { props, ...view };
}

const node = (id: string) => document.querySelector<HTMLElement>(`[data-el-id="${id}"]`)!;
const lastPatch = (props: CanvasProps) => (props.onPatch as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as Record<string, number> | undefined;

/** Arrastra desde (x0, y0) hasta (x1, y1) en px de pantalla con eventos de puntero. */
function drag(target: Element, from: [number, number], to: [number, number], steps = 1) {
  fireEvent.pointerDown(target, { clientX: from[0], clientY: from[1], pointerId: 1, button: 0 });
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    act(() => {
      fireEvent.pointerMove(window, { clientX: x, clientY: y, pointerId: 1 });
    });
  }
  fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], pointerId: 1 });
}

describe('computeDrag (geometría pura)', () => {
  const origin = { x: 10, y: 10, w: 40, h: 10 };

  it('mover suma el desplazamiento en % de la página', () => {
    expect(computeDrag('move', origin, 5, 7).patch).toEqual({ x: 15, y: 17 });
  });

  it('redimensionar suma al ancho y al alto', () => {
    expect(computeDrag('resize', origin, 5, 7).patch).toEqual({ w: 45, h: 17 });
  });

  it('redimensionar respeta los mínimos: ancho 3 % y alto 0,3 %', () => {
    expect(MIN_W).toBe(3);
    expect(MIN_H).toBe(0.3);
    expect(computeDrag('resize', origin, -100, -100).patch).toEqual({ w: 3, h: 0.3 });
  });

  describe('ajuste al centro', () => {
    it('se ajusta al centro horizontal con tolerancia de 1,2 % y muestra la guía', () => {
      expect(CENTER_TOLERANCE_X).toBe(1.2);
      // el centro del elemento queda en 50 + 1 → se ajusta a 50
      const r = computeDrag('move', { x: 10, y: 10, w: 40, h: 10 }, 21, 0); // x = 31 → centro 51
      expect(r.patch.x).toBe(30);
      expect(r.guideV).toBe(true);
      expect(r.guideH).toBe(false);
    });

    it('no se ajusta fuera de la tolerancia horizontal', () => {
      const r = computeDrag('move', { x: 10, y: 10, w: 40, h: 10 }, 21.5, 0); // centro 51,5
      expect(r.patch.x).toBe(31.5);
      expect(r.guideV).toBe(false);
    });

    it('se ajusta al centro vertical con tolerancia de 0,9 % y muestra la guía', () => {
      expect(CENTER_TOLERANCE_Y).toBe(0.9);
      const r = computeDrag('move', { x: 10, y: 10, w: 40, h: 10 }, 0, 35.5); // y = 45,5 → centro 50,5
      expect(r.patch.y).toBe(45);
      expect(r.guideH).toBe(true);
      expect(r.guideV).toBe(false);
    });

    it('no se ajusta fuera de la tolerancia vertical', () => {
      const r = computeDrag('move', { x: 10, y: 10, w: 40, h: 10 }, 0, 36.5); // centro 51,5
      expect(r.guideH).toBe(false);
      expect(r.patch.y).toBe(46.5);
    });

    it('redimensionar nunca se ajusta', () => {
      const r = computeDrag('resize', { x: 10, y: 10, w: 40, h: 10 }, 0, 0);
      expect(r.guideV).toBe(false);
      expect(r.guideH).toBe(false);
    });
  });

  it('redondea a una decimal', () => {
    expect(computeDrag('move', origin, 0.123, 0.987).patch).toEqual({ x: 10.1, y: 11 });
  });

  // El servidor rechaza (422) lo que se salga de estos rangos: el arrastre no debe poder producirlos
  describe('rangos que acepta el servidor', () => {
    it('mover no pasa del máximo de X e Y (400 %)', () => {
      expect(computeDrag('move', origin, 5000, 5000).patch).toEqual({ x: RANGES.x[1], y: RANGES.y[1] });
    });

    it('mover no pasa del mínimo de X e Y (−300 %)', () => {
      expect(computeDrag('move', origin, -5000, -5000).patch).toEqual({ x: RANGES.x[0], y: RANGES.y[0] });
    });

    it('redimensionar no pasa del ancho y alto máximos (500 %)', () => {
      expect(computeDrag('resize', origin, 5000, 5000).patch).toEqual({ w: RANGES.w[1], h: RANGES.h[1] });
    });
  });
});

describe('Canvas', () => {
  it('pinta cada elemento en el mismo % que su documento (parte editor de SC-002)', () => {
    const els = [el('a', { x: 10, y: 20, w: 30, h: 8 }), el('b', { x: 55.5, y: 60.2, w: 12, h: 4 })];
    setup({}, els);
    for (const e of els) {
      expect(node(e.id).style.left).toBe(`${e.x}%`);
      expect(node(e.id).style.top).toBe(`${e.y}%`);
      expect(node(e.id).style.width).toBe(`${e.w}%`);
      expect(node(e.id).style.height).toBe(`${e.h}%`);
    }
  });

  it('el marco de la hoja mide la hoja por la escala', () => {
    setup({ scale: 0.5, testId: 'lienzo' });
    expect(screen.getByTestId('lienzo').style.width).toBe(`${PAGE_W * 0.5}px`);
    expect(screen.getByTestId('lienzo').style.height).toBe(`${PAGE_H * 0.5}px`);
  });

  it('la capa de selección va fuera de la hoja recortada: la manija de un elemento que sale de la página sigue a la vista', () => {
    // Un elemento arrastrado hasta el borde deja su esquina fuera de la página: si la manija viviera dentro de
    // `.tpl-page` (overflow: hidden) quedaría recortada y no se podría tomar (se vio en el navegador real).
    setup({ selId: 'a' }, [el('a', { x: 80, y: 20, w: 40, h: 10 })]);
    const page = document.querySelector<HTMLElement>('.tpl-page')!;
    const selection = screen.getByTestId('selection');
    const handle = screen.getByTestId('resize-handle');
    expect(page.style.overflow).toBe('hidden');
    expect(page.contains(selection)).toBe(false);
    expect(page.contains(handle)).toBe(false);
    expect(selection.closest('.tpl-page-frame')).not.toBeNull();
    // y sigue a la misma escala que la hoja
    expect(selection.parentElement!.style.transform).toBe(page.style.transform);
  });

  describe('selección', () => {
    it('un clic en un elemento lo selecciona', () => {
      const { props } = setup();
      fireEvent.pointerDown(node('a'), { clientX: 150, clientY: 100, pointerId: 1, button: 0 });
      fireEvent.pointerUp(window, { pointerId: 1 });
      expect(props.onSelect).toHaveBeenCalledWith('a');
    });

    it('un clic en el fondo anula la selección', () => {
      const { props, container } = setup({ selId: 'a' });
      fireEvent.pointerDown(container.querySelector('.tpl-page')!, { clientX: 400, clientY: 700, pointerId: 1, button: 0 });
      expect(props.onSelect).toHaveBeenCalledWith(null);
    });

    it('selecciona el elemento de más arriba cuando hay varios superpuestos', () => {
      const { props } = setup({}, [el('abajo'), el('arriba')]);
      // el evento nace en el hijo de texto del elemento de arriba
      fireEvent.pointerDown(node('arriba').firstElementChild!, { clientX: 150, clientY: 100, pointerId: 1, button: 0 });
      expect(props.onSelect).toHaveBeenCalledWith('arriba');
    });

    it('el elemento seleccionado muestra su contorno y la manija de esquina', () => {
      setup({ selId: 'a' });
      const outline = screen.getByTestId('selection');
      expect(outline.style.left).toBe('10%');
      expect(outline.style.width).toBe('40%');
      expect(screen.getByTestId('resize-handle')).toBeInTheDocument();
    });

    it('un elemento fijo muestra el contorno punteado y no tiene manija', () => {
      setup({ selId: 'a' }, [el('a', { locked: true })]);
      expect(screen.getByTestId('selection').style.outlineStyle).toBe('dashed');
      expect(screen.queryByTestId('resize-handle')).not.toBeInTheDocument();
    });

    it('sin selección no hay contorno', () => {
      setup();
      expect(screen.queryByTestId('selection')).not.toBeInTheDocument();
    });

    it('un elemento oculto no se pinta ni se puede seleccionar con el lienzo', () => {
      setup({}, [el('a', { visible: false })]);
      expect(node('a')).toBeNull();
    });
  });

  describe('mover', () => {
    it('arrastrar mueve el elemento en % según el rectángulo de la página', () => {
      const { props } = setup();
      drag(node('a'), [150, 100], [150 + pct(5, PAGE_W), 100 + pct(7, PAGE_H)]);
      expect(props.onCheckpoint).toHaveBeenCalledTimes(1);
      expect(lastPatch(props)).toEqual({ x: 15, y: 17 });
    });

    it('selecciona el elemento al empezar a arrastrarlo', () => {
      const { props } = setup();
      drag(node('a'), [150, 100], [200, 130]);
      expect(props.onSelect).toHaveBeenCalledWith('a');
    });

    it('con la hoja escalada convierte los píxeles de pantalla a % de la página', () => {
      const scaled = { ...RECT, width: PAGE_W * 0.5, height: PAGE_H * 0.5 };
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(scaled as DOMRect);
      const { props } = setup({ scale: 0.5 });
      drag(node('a'), [150, 100], [150 + pct(10, PAGE_W * 0.5), 100]);
      expect(lastPatch(props)).toEqual({ x: 20, y: 10 });
    });

    it('el gesto completo es un solo paso de historial: un checkpoint y todos los parches siguen el movimiento', () => {
      const { props } = setup();
      drag(node('a'), [150, 100], [150 + pct(8, PAGE_W), 100], 10);
      expect(props.onCheckpoint).toHaveBeenCalledTimes(1);
      expect((props.onPatch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
      expect(lastPatch(props)).toEqual({ x: 18, y: 10 });
    });

    it('arrastrar muy lejos deja la posición dentro de lo que el servidor acepta', () => {
      const { props } = setup();
      drag(node('a'), [150, 100], [150 + pct(900, PAGE_W), 100 - pct(900, PAGE_H)]);
      expect(lastPatch(props)).toEqual({ x: RANGES.x[1], y: RANGES.y[0] });
    });

    it('un clic sin mover no agrega pasos de historial ni parches', () => {
      const { props } = setup();
      drag(node('a'), [150, 100], [150, 100]);
      expect(props.onCheckpoint).not.toHaveBeenCalled();
      expect(props.onPatch).not.toHaveBeenCalled();
    });

    it('se ajusta al centro y muestra la guía vertical mientras dura el arrastre', () => {
      const { props, container } = setup({}, [el('a', { x: 10, y: 10, w: 40, h: 10 })]);
      fireEvent.pointerDown(node('a'), { clientX: 150, clientY: 100, pointerId: 1, button: 0 });
      act(() => {
        fireEvent.pointerMove(window, { clientX: 150 + pct(21, PAGE_W), clientY: 100, pointerId: 1 });
      });
      expect(lastPatch(props)).toMatchObject({ x: 30 });
      expect(container.querySelector('[data-testid="guide-v"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="guide-h"]')).not.toBeInTheDocument();
      fireEvent.pointerUp(window, { pointerId: 1 });
      expect(container.querySelector('[data-testid="guide-v"]')).not.toBeInTheDocument();
    });

    it('un elemento bloqueado se selecciona pero no se mueve', () => {
      const { props } = setup({}, [el('a', { locked: true })]);
      drag(node('a'), [150, 100], [250, 200]);
      expect(props.onSelect).toHaveBeenCalledWith('a');
      expect(props.onCheckpoint).not.toHaveBeenCalled();
      expect(props.onPatch).not.toHaveBeenCalled();
    });

    it('dejar de arrastrar quita los oyentes de la ventana', () => {
      const { props } = setup();
      drag(node('a'), [150, 100], [200, 100]);
      const calls = (props.onPatch as ReturnType<typeof vi.fn>).mock.calls.length;
      act(() => {
        fireEvent.pointerMove(window, { clientX: 400, clientY: 400, pointerId: 1 });
      });
      expect((props.onPatch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
    });
  });

  describe('redimensionar desde la esquina', () => {
    it('arrastrar la manija cambia el ancho y el alto', () => {
      const { props } = setup({ selId: 'a' });
      drag(screen.getByTestId('resize-handle'), [300, 150], [300 + pct(5, PAGE_W), 150 + pct(2, PAGE_H)]);
      expect(lastPatch(props)).toEqual({ w: 45, h: 12 });
      expect(props.onCheckpoint).toHaveBeenCalledTimes(1);
    });

    it('respeta el ancho mínimo de 3 % y el alto mínimo de 0,3 %', () => {
      const { props } = setup({ selId: 'a' });
      drag(screen.getByTestId('resize-handle'), [300, 150], [0, 0]);
      expect(lastPatch(props)).toEqual({ w: 3, h: 0.3 });
    });

    it('agrandar muy lejos deja el tamaño dentro de lo que el servidor acepta', () => {
      const { props } = setup({ selId: 'a' });
      drag(screen.getByTestId('resize-handle'), [300, 150], [300 + pct(900, PAGE_W), 150 + pct(900, PAGE_H)]);
      expect(lastPatch(props)).toEqual({ w: RANGES.w[1], h: RANGES.h[1] });
    });

    it('la manija no mueve el elemento ni cambia la selección', () => {
      const { props } = setup({ selId: 'a' });
      drag(screen.getByTestId('resize-handle'), [300, 150], [330, 160]);
      expect(lastPatch(props)).not.toHaveProperty('x');
      expect(props.onSelect).not.toHaveBeenCalledWith(null);
    });
  });

  describe('bloques automáticos', () => {
    it('se pueden mover cuando están desbloqueados', () => {
      const t = baseTemplate('neon');
      const products = t.pages.productos.els.find((e) => e.type === 'products')!;
      products.locked = false;
      const onPatch = vi.fn();
      render(
        <Canvas template={t} page="productos" tokens={tokensFrom(DEFAULT_BUSINESS, 'RAMEN')} scale={SCALE} selId={null} onSelect={vi.fn()} onCheckpoint={vi.fn()} onPatch={onPatch} />,
      );
      drag(document.querySelector(`[data-el-id="${products.id}"]`)!, [200, 300], [200 + pct(5, PAGE_W), 300]);
      expect(onPatch).toHaveBeenCalledWith(products.id, { x: 5, y: 10.4 });
    });
  });
});
