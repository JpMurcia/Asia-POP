import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokensFrom, type PageElement, type Template } from '../../backend/src/catalog/template';
import { baseTemplate, draftBadge, draftImage, draftShape, draftText } from '../../backend/src/catalog/template-presets';
import TemplatePage from '../src/print/TemplatePage';
import { fireEvent, mockEditorApi, openElements, pickColor, renderEditor, saveButton, screen, waitFor, within } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 013: formas, borde, línea, voltear, proporción y enlace (render, inspector, panel e historial). */
const tokens = tokensFrom({ storeName: 'ASIANPOP', phone1: '1', phone2: '2', address: 'x', coverTitle: 'y' }, 'RAMEN');

function pageWith(el: PageElement): HTMLElement {
  const t: Template = baseTemplate('neon');
  t.pages.portada.els = [el];
  return render(<TemplatePage template={t} page="portada" tokens={tokens} items={[]} />).container;
}
const shape = (over: Record<string, unknown> = {}): PageElement => ({ ...draftShape(over as never), id: 'sh' }) as PageElement;
const wrapperOf = (c: HTMLElement) => c.querySelector<HTMLElement>('.tpl-el')!;
const SVG_KINDS = ['triangle', 'diamond', 'star', 'burst', 'arrow', 'bubble'] as const;

describe('render: sin campos nuevos el marcado es el de siempre', () => {
  it.each(['rect', 'circle', 'pill'] as const)('%s sigue siendo un <div> con su CSS, sin <svg> ni transform', (kind) => {
    const c = pageWith(shape({ kind, border: '#112233', bw: 2 }));
    const body = c.querySelector<HTMLElement>('.tpl-shape')!;
    expect(body.tagName).toBe('DIV');
    expect(c.querySelector('svg')).toBeNull();
    expect(body.style.border).toBe('2px solid rgb(17, 34, 51)');
    expect(wrapperOf(c).style.transform).toBe('');
    expect(c.querySelector('a')).toBeNull();
  });

  it('una forma girada solo trae el giro de siempre', () => {
    expect(wrapperOf(pageWith(shape({ rot: 12 }))).style.transform).toBe('rotate(12deg)');
  });

  it('una línea hecha con un rectángulo delgado (plantillas base y guardadas) no cambia', () => {
    const c = pageWith(shape({ kind: 'rect', fill: 'ink', radius: 0, h: 0.3, w: 84 }));
    expect(c.querySelector('.tpl-shape')!.tagName).toBe('DIV');
    expect(c.querySelector('svg')).toBeNull();
  });
});

describe('render: formas nuevas (US1)', () => {
  it.each(SVG_KINDS)('%s se dibuja como <svg> con su contorno y su relleno', (kind) => {
    const c = pageWith(shape({ kind, fill: '#FF007A' }));
    const path = c.querySelector('svg.tpl-shape path')!;
    expect(path.getAttribute('d')).toMatch(/^M/);
    expect(path.getAttribute('fill')).toBe('#FF007A');
    expect(path.getAttribute('stroke')).toBe('none');
    expect(c.querySelector('div.tpl-shape')).toBeNull();
  });

  it('el borde queda dentro de la caja: el contorno se reduce y se desplaza medio grosor', () => {
    const c = pageWith(shape({ kind: 'diamond', border: '#00AA00', bw: 8 }));
    const path = c.querySelector('svg path')!;
    expect(path.getAttribute('stroke')).toBe('#00AA00');
    expect(path.getAttribute('stroke-width')).toBe('8');
    expect(path.getAttribute('transform')).toBe('translate(4 4)');
  });

  it('el resplandor sigue la figura con un drop-shadow', () => {
    const c = pageWith(shape({ kind: 'star', glow: '#FF007A' }));
    expect(c.querySelector<SVGElement>('svg')!.style.filter).toContain('drop-shadow');
  });
});

describe('render: estilo de borde (US2)', () => {
  it.each(['dashed', 'dotted'] as const)('%s cambia el border-style de rectángulo, círculo y píldora', (bs) => {
    for (const kind of ['rect', 'circle', 'pill'] as const) {
      const c = pageWith(shape({ kind, border: '#112233', bw: 3, bs }));
      expect(c.querySelector<HTMLElement>('.tpl-shape')!.style.border).toBe(`3px ${bs} rgb(17, 34, 51)`);
    }
  });

  it('en las formas SVG se dibuja con stroke-dasharray; el punteado con puntas redondas', () => {
    const dashed = pageWith(shape({ kind: 'star', border: '#112233', bw: 4, bs: 'dashed' })).querySelector('svg path')!;
    expect(dashed.getAttribute('stroke-dasharray')).toBe('12 8');
    const dotted = pageWith(shape({ kind: 'arrow', border: '#112233', bw: 4, bs: 'dotted' })).querySelector('svg path')!;
    expect(dotted.getAttribute('stroke-dasharray')).toBe('0 8');
    expect(dotted.getAttribute('stroke-linecap')).toBe('round');
  });

  it('sólido o sin estilo no lleva guiones', () => {
    const p = pageWith(shape({ kind: 'star', border: '#112233', bw: 4, bs: 'solid' })).querySelector('svg path')!;
    expect(p.getAttribute('stroke-dasharray')).toBeNull();
  });
});

describe('render: línea (US3)', () => {
  const line = (over: Record<string, unknown> = {}) => shape({ kind: 'line', fill: '#112233', bw: 3, w: 70, h: 2, ...over });

  it('es un <svg> con una línea del color y del grosor pedidos', () => {
    const l = pageWith(line()).querySelector('svg line')!;
    expect(l.getAttribute('stroke')).toBe('#112233');
    expect(l.getAttribute('stroke-width')).toBe('3');
    expect(pageWith(line()).querySelectorAll('svg path')).toHaveLength(0);
  });

  it('el grosor mínimo al dibujar es 1', () => {
    expect(pageWith(line({ bw: 0 })).querySelector('svg line')!.getAttribute('stroke-width')).toBe('1');
  });

  it('discontinua y punteada', () => {
    expect(pageWith(line({ bs: 'dashed' })).querySelector('svg line')!.getAttribute('stroke-dasharray')).toBe('9 6');
    const dotted = pageWith(line({ bs: 'dotted' })).querySelector('svg line')!;
    expect(dotted.getAttribute('stroke-dasharray')).toBe('0 6');
    expect(dotted.getAttribute('stroke-linecap')).toBe('round');
  });

  it.each(['arrow', 'circle', 'square', 'diamond'] as const)('el extremo %s se dibuja relleno del color de la línea', (cap) => {
    const c = pageWith(line({ capStart: cap, capEnd: cap }));
    const paths = c.querySelectorAll('svg path');
    expect(paths).toHaveLength(2);
    for (const p of paths) expect(p.getAttribute('fill')).toBe('#112233');
  });

  it('con un solo extremo hay una sola figura y la línea sigue entera del otro lado', () => {
    const c = pageWith(line({ capEnd: 'arrow' }));
    expect(c.querySelectorAll('svg path')).toHaveLength(1);
    expect(Number(c.querySelector('svg line')!.getAttribute('x1'))).toBe(0);
  });

  it('girada, se dibuja con la rotación de siempre', () => {
    expect(wrapperOf(pageWith(line({ rot: -20 }))).style.transform).toBe('rotate(-20deg)');
  });
});

describe('render: voltear (US4)', () => {
  it.each([
    [{ flipH: true }, 'scale(-1, 1)'],
    [{ flipV: true }, 'scale(1, -1)'],
    [{ flipH: true, flipV: true }, 'scale(-1, -1)'],
  ])('%j → %s', (flip, expected) => {
    expect(wrapperOf(pageWith(shape({ kind: 'arrow', ...flip }))).style.transform).toBe(expected);
    expect(wrapperOf(pageWith({ ...draftImage(), id: 'im', ...flip } as PageElement)).style.transform).toBe(expected);
  });

  it('con giro, el volteo se compone después: rotate(r) scale(...)', () => {
    expect(wrapperOf(pageWith(shape({ rot: 15, flipH: true }))).style.transform).toBe('rotate(15deg) scale(-1, 1)');
  });

  it('false equivale a no voltear', () => {
    expect(wrapperOf(pageWith(shape({ flipH: false, flipV: false }))).style.transform).toBe('');
  });

  it('un texto no se voltea aunque traiga el campo', () => {
    expect(wrapperOf(pageWith({ ...draftText({ text: 'Hola' }), id: 'tx', flipH: true } as unknown as PageElement)).style.transform).toBe('');
  });
});

describe('render: enlace (US6)', () => {
  const HREF = 'https://wa.me/573106690585';
  const els: [string, PageElement][] = [
    ['texto', { ...draftText({ text: 'Hola' }), id: 'e', href: HREF } as PageElement],
    ['insignia', { ...draftBadge(), id: 'e', href: HREF } as PageElement],
    ['forma', shape({ href: HREF })],
    ['imagen', { ...draftImage(), id: 'e', href: HREF } as PageElement],
  ];

  it.each(els)('%s con enlace: el cuerpo va en un <a> que abre en otra pestaña con rel seguro', (_n, el) => {
    const c = pageWith(el);
    const a = c.querySelector('a.tpl-link')!;
    expect(a.getAttribute('href')).toBe(HREF);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.children.length).toBeGreaterThan(0);
  });

  it.each(els)('%s sin enlace o con enlace vacío: no hay <a>', (_n, el) => {
    expect(pageWith({ ...el, href: undefined } as PageElement).querySelector('a')).toBeNull();
    expect(pageWith({ ...el, href: '' } as PageElement).querySelector('a')).toBeNull();
  });

  it('una línea y una forma SVG también se enlazan', () => {
    expect(pageWith(shape({ kind: 'line', href: HREF })).querySelector('a svg')).not.toBeNull();
    expect(pageWith(shape({ kind: 'star', href: HREF })).querySelector('a svg')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------------------------------------------

const group = (name: string) => screen.getByRole('group', { name });
const inGroup = (g: string, button: string | RegExp) => within(group(g)).getByRole('button', { name: button });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const toggle = (label: string) => screen.getByRole('switch', { name: label });
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
const selection = () => screen.getByTestId('selection');

async function start() {
  mockEditorApi();
  return renderEditor();
}
async function add(name: string) {
  openElements();
  click(name);
}
/** El elemento seleccionado en el lienzo, por el contorno de selección (sus % son los del elemento). */
const boxOf = () => {
  const s = selection().style;
  return { w: parseFloat(s.width), h: parseFloat(s.height), left: s.left, top: s.top };
};

describe('panel «Elementos» (US1, US3)', () => {
  it('ofrece las nueve formas y la línea', async () => {
    await start();
    openElements();
    for (const n of ['Rectángulo', 'Círculo', 'Píldora', 'Línea', 'Triángulo', 'Rombo', 'Estrella', 'Estallido', 'Flecha', 'Globo']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
  });

  it.each(['Triángulo', 'Rombo', 'Estrella', 'Estallido', 'Flecha', 'Globo'])('agregar %s deja una figura SVG visible y seleccionada', async (name) => {
    await start();
    await add(name);
    expect(group('Forma')).toBeInTheDocument();
    expect(inGroup('Forma', name)).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-testid="canvas-page"] svg.tpl-shape')).not.toBeNull();
    const b = boxOf();
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });

  it('agregar una línea crea una forma de tipo línea sin extremos', async () => {
    await start();
    await add('Línea');
    expect(document.querySelector('[data-testid="canvas-page"] svg.tpl-shape line')).not.toBeNull();
    expect(document.querySelectorAll('[data-testid="canvas-page"] svg.tpl-shape path')).toHaveLength(0);
    expect(inGroup('Extremo inicial', 'Ninguno')).toHaveAttribute('aria-pressed', 'true');
    expect(inGroup('Extremo final', 'Ninguno')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('inspector: formas (US1, US2)', () => {
  it('ofrece los nueve tipos y cambiar el tipo conserva relleno, tamaño y posición', async () => {
    await start();
    await add('Rectángulo');
    for (const k of ['Rectángulo', 'Círculo', 'Píldora', 'Triángulo', 'Rombo', 'Estrella', 'Estallido', 'Flecha', 'Globo']) expect(inGroup('Forma', k)).toBeInTheDocument();
    const before = boxOf();
    fireEvent.click(inGroup('Forma', 'Estrella'));
    expect(boxOf()).toEqual(before);
    expect(inGroup('Forma', 'Estrella')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-testid="canvas-page"] svg.tpl-shape path')).not.toBeNull();
    undo();
    expect(inGroup('Forma', 'Rectángulo')).toHaveAttribute('aria-pressed', 'true');
  });

  it('«Esquinas» solo con rectángulo', async () => {
    await start();
    await add('Estrella');
    expect(screen.queryByLabelText('Esquinas')).not.toBeInTheDocument();
    fireEvent.click(inGroup('Forma', 'Rectángulo'));
    expect(screen.getByLabelText('Esquinas')).toBeInTheDocument();
  });

  it('el estilo del borde aparece solo con borde y su cambio es un paso de deshacer', async () => {
    await start();
    await add('Rectángulo');
    expect(screen.queryByRole('group', { name: 'Estilo del borde' })).not.toBeInTheDocument();
    pickColor('Borde', 'Acento 3');
    fireEvent.change(screen.getByLabelText('Grosor del borde'), { target: { value: '4' } });
    expect(inGroup('Estilo del borde', 'Sólido')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(inGroup('Estilo del borde', 'Discontinuo'));
    const body = () => document.querySelector<HTMLElement>('[data-testid="canvas-page"] .tpl-shape')!;
    expect(body().style.border).toContain('dashed');
    undo();
    expect(body().style.border).toContain('solid');
  });

  it('elegir el estilo que ya tiene no agrega un paso', async () => {
    await start();
    await add('Rectángulo');
    pickColor('Borde', 'Acento 3');
    const hist = () => screen.getByRole('button', { name: 'Deshacer' });
    undo(); // quita el borde
    fireEvent.click(screen.getByRole('button', { name: 'Rehacer' }));
    expect(hist()).toBeEnabled();
    fireEvent.click(inGroup('Estilo del borde', 'Sólido'));
    undo(); // si hubiese agregado un paso, esto solo lo quitaría y el borde seguiría
    expect(screen.queryByRole('group', { name: 'Estilo del borde' })).not.toBeInTheDocument();
  });
});

describe('inspector: línea (US3)', () => {
  it('cada extremo cambia la figura y un cambio es un paso de deshacer', async () => {
    await start();
    await add('Línea');
    const paths = () => document.querySelectorAll('[data-testid="canvas-page"] svg.tpl-shape path').length;
    fireEvent.click(inGroup('Extremo inicial', 'Flecha'));
    expect(paths()).toBe(1);
    fireEvent.click(inGroup('Extremo final', 'Rombo'));
    expect(paths()).toBe(2);
    undo();
    expect(paths()).toBe(1);
    undo();
    expect(paths()).toBe(0);
  });

  it('estilo y grosor se reflejan en el lienzo', async () => {
    await start();
    await add('Línea');
    fireEvent.click(inGroup('Estilo', 'Discontinuo'));
    const line = () => document.querySelector('[data-testid="canvas-page"] svg.tpl-shape line')!;
    expect(line().getAttribute('stroke-dasharray')).toBe('9 6');
    fireEvent.change(screen.getByLabelText('Grosor'), { target: { value: '8' } });
    expect(line().getAttribute('stroke-width')).toBe('8');
  });

  it('con la línea bloqueada, sus controles quedan deshabilitados', async () => {
    await start();
    await add('Línea');
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(toggle('Voltear horizontal')).toBeDisabled();
    expect(screen.getByLabelText('Enlace')).toBeDisabled();
  });
});

describe('inspector: voltear (US4)', () => {
  it('forma e imagen los ofrecen; texto, insignia y bloques no', async () => {
    await start();
    await add('Flecha');
    expect(toggle('Voltear horizontal')).toBeInTheDocument();
    expect(toggle('Voltear vertical')).toBeInTheDocument();
    await add('Collage');
    expect(toggle('Voltear horizontal')).toBeInTheDocument();
    await add('Agregar título');
    expect(screen.queryByRole('switch', { name: 'Voltear horizontal' })).not.toBeInTheDocument();
    await add('Insignia');
    expect(screen.queryByRole('switch', { name: 'Voltear horizontal' })).not.toBeInTheDocument();
  });

  it('cada interruptor refleja la forma y se deshace en un paso', async () => {
    await start();
    await add('Flecha');
    const wrapper = () => document.querySelector<HTMLElement>('[data-testid="canvas-page"] [data-el-type="shape"]')!;
    fireEvent.click(toggle('Voltear horizontal'));
    expect(wrapper().style.transform).toBe('scale(-1, 1)');
    expect(toggle('Voltear horizontal')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle('Voltear vertical'));
    expect(wrapper().style.transform).toBe('scale(-1, -1)');
    undo();
    expect(wrapper().style.transform).toBe('scale(-1, 1)');
    undo();
    expect(wrapper().style.transform).toBe('');
  });
});

describe('inspector: bloquear proporción (US5)', () => {
  const widthField = () => screen.getByLabelText('Ancho %') as HTMLInputElement;
  const heightField = () => screen.getByLabelText('Alto %') as HTMLInputElement;
  const commit = (input: HTMLInputElement, value: string) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
  };

  it('sin bloqueo, el ancho y el alto son independientes', async () => {
    await start();
    await add('Estrella');
    const h = heightField().value;
    commit(widthField(), '20');
    expect(heightField().value).toBe(h);
  });

  it('con bloqueo, cambiar el ancho ajusta el alto y viceversa, conservando la relación', async () => {
    await start();
    await add('Rectángulo'); // 40 × 16
    fireEvent.click(toggle('Bloquear proporción'));
    commit(widthField(), '20');
    expect(heightField().value).toBe('8');
    commit(heightField(), '16');
    expect(widthField().value).toBe('40');
  });

  it('un valor que se saldría de los límites se recorta sin perder la relación', async () => {
    await start();
    await add('Rectángulo');
    fireEvent.click(toggle('Bloquear proporción'));
    commit(widthField(), '900');
    const w = Number(widthField().value);
    const h = Number(heightField().value);
    expect(w).toBeLessThanOrEqual(500);
    expect(h / w).toBeCloseTo(0.4, 1);
  });

  it('un cambio de ancho con el bloqueo es un solo paso de deshacer', async () => {
    await start();
    await add('Rectángulo');
    fireEvent.click(toggle('Bloquear proporción'));
    commit(widthField(), '20');
    undo();
    expect(widthField().value).toBe('40');
    expect(heightField().value).toBe('16');
  });

  it('también está en las imágenes', async () => {
    await start();
    await add('Collage');
    expect(toggle('Bloquear proporción')).toBeInTheDocument();
  });

  it('arrastrar la manija con el bloqueo conserva la relación', async () => {
    await start();
    await add('Rectángulo');
    fireEvent.click(toggle('Bloquear proporción'));
    const before = boxOf();
    const handle = screen.getByTestId('resize-handle');
    const page = screen.getByTestId('canvas-page');
    vi.spyOn(page.parentElement!, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 500, height: 700, right: 500, bottom: 700, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 150, clientY: 100 });
    fireEvent.pointerUp(window);
    const after = boxOf();
    expect(after.w).toBeGreaterThan(before.w);
    expect(after.h / after.w).toBeCloseTo(before.h / before.w, 1);
  });
});

describe('inspector: enlace (US6)', () => {
  const field = () => screen.getByLabelText('Enlace') as HTMLInputElement;
  const type = (value: string) => {
    fireEvent.change(field(), { target: { value } });
    fireEvent.blur(field());
  };

  it('texto, insignia, forma, línea e imagen lo ofrecen', async () => {
    await start();
    for (const name of ['Agregar título', 'Insignia', 'Rectángulo', 'Línea', 'Collage']) {
      await add(name);
      expect(field()).toBeInTheDocument();
    }
  });

  it('escribirlo envuelve el elemento en un <a>, que se quita al vaciar el campo; cada cambio es un paso', async () => {
    await start();
    await add('Collage');
    const anchor = () => document.querySelector('[data-testid="canvas-page"] a.tpl-link');
    type('https://example.com/tienda');
    expect(anchor()?.getAttribute('href')).toBe('https://example.com/tienda');
    type('');
    expect(anchor()).toBeNull();
    undo();
    expect(anchor()?.getAttribute('href')).toBe('https://example.com/tienda');
    undo();
    expect(anchor()).toBeNull();
  });

  it('escribir lo mismo (o nada) no agrega un paso', async () => {
    await start();
    await add('Collage');
    type('');
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeEnabled(); // el paso de «agregar»
    undo();
    expect(screen.queryByLabelText('Enlace')).not.toBeInTheDocument(); // se deshizo agregar, no el enlace
  });

  it('se guarda con la plantilla y viaja con todos sus campos (ida y vuelta)', async () => {
    const api = mockEditorApi();
    await renderEditor();
    openElements();
    click('Estrella');
    type('https://example.com/promo');
    fireEvent.click(toggle('Voltear horizontal'));
    fireEvent.click(toggle('Bloquear proporción'));
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    const saved = (api.puts()[0]!.body!.templates as { pages: { portada: { els: Record<string, unknown>[] } } }[])[0]!;
    expect(saved.pages.portada.els.find((e) => e.type === 'shape' && e.kind === 'star')).toMatchObject({
      href: 'https://example.com/promo',
      flipH: true,
      lockAspect: true,
    });
  });

  it('en el editor, un elemento enlazado solo se selecciona: el <a> no recibe clics', async () => {
    await start();
    await add('Collage');
    type('https://example.com');
    const a = document.querySelector<HTMLElement>('[data-testid="canvas-page"] a.tpl-link')!;
    // jsdom no aplica las hojas de estilo: se comprueba la regla que desactiva los clics del enlace en el editor
    expect(a.className).toBe('tpl-link');
    expect(readFileSync(resolve(__dirname, '../src/pages/TemplateEditor/editor.css'), 'utf8')).toMatch(/\.ed-canvas \.tpl-link\s*\{\s*pointer-events:\s*none/);
    expect(selection()).toBeInTheDocument();
  });
});
