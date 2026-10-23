import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokensFrom, type PageElement, type Template, type TextEl } from '../../backend/src/catalog/template';
import { baseTemplate, draftText } from '../../backend/src/catalog/template-presets';
import TemplatePage from '../src/print/TemplatePage';
import { canvas, canvasEl, fireEvent, mockEditorApi, renderEditor, screen, selectLayer, within } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 012: texto estilo Canva (formato, efectos en cuadrícula, curvar y copiar estilo). */
const tokens = tokensFrom({ storeName: 'ASIANPOP', phone1: '1', phone2: '2', address: 'x', coverTitle: 'y' }, 'RAMEN');

function pageWith(el: PageElement): HTMLElement {
  const t: Template = baseTemplate('neon');
  t.pages.portada.els = [el];
  return render(<TemplatePage template={t} page="portada" tokens={tokens} items={[]} />).container;
}
const text = (over: Partial<TextEl> = {}): PageElement => ({ ...draftText({ text: 'Hola mundo', x: 10, y: 10, w: 60, h: 20, ...over }), id: 'tx' });
const textDiv = (c: HTMLElement) => c.querySelector<HTMLElement>('.tpl-text')!;

describe('render: sin formato nuevo el marcado es el de siempre', () => {
  it.each([
    ['texto libre', 'Hola mundo'],
    ['texto con datos', '{tienda}'],
  ])('%s: sin campos nuevos no hay <svg>, <span> ni decoración', (_n, t) => {
    const div = textDiv(pageWith(text({ text: t })));
    expect(div.querySelector('span, svg, div')).toBeNull();
    expect(div.style.fontStyle).toBe('');
    expect(div.style.textDecorationLine).toBe('');
    expect(div.style.textShadow).toBe('');
  });
});

describe('render: formato (US1)', () => {
  it('cursiva y subrayado', () => {
    const div = textDiv(pageWith(text({ italic: true, underline: true })));
    expect(div.style.fontStyle).toBe('italic');
    expect(div.style.textDecorationLine).toBe('underline');
  });

  it('subrayado y tachado se combinan', () => {
    const div = textDiv(pageWith(text({ underline: true, strike: true })));
    expect(div.style.textDecorationLine).toBe('underline line-through');
  });

  it('justificado: text-align justify y ancho completo', () => {
    const div = textDiv(pageWith(text({ align: 'justify' })));
    expect(div.style.textAlign).toBe('justify');
    expect(div.style.width).toBe('100%');
  });

  it('viñetas: una línea por renglón con marcador y sangría francesa; las líneas vacías no llevan marcador', () => {
    const div = textDiv(pageWith(text({ text: 'Uno\n\nDos', list: 'bullet' })));
    const rows = Array.from(div.children) as HTMLElement[];
    expect(rows).toHaveLength(3);
    expect(rows[0]!.textContent).toBe('• Uno');
    expect(rows[1]!.textContent).toBe(' ');
    expect(rows[2]!.textContent).toBe('• Dos');
    expect(rows[0]!.style.textIndent).toBe('-1.4em');
    expect(rows[0]!.style.paddingLeft).toBe('1.4em');
  });

  it('numerada: cuenta solo las líneas no vacías', () => {
    const rows = Array.from(textDiv(pageWith(text({ text: 'A\n\nB\nC', list: 'number' }))).children);
    expect(rows.map((r) => r.textContent)).toEqual(['1. A', ' ', '2. B', '3. C']);
  });

  it('«Sin lista» se dibuja como un texto normal', () => {
    expect(textDiv(pageWith(text({ text: 'A\nB', list: 'none' }))).children).toHaveLength(0);
  });

  it('una lista con fondo envuelve cada línea no vacía', () => {
    const rows = Array.from(textDiv(pageWith(text({ text: 'A\n\nB', list: 'bullet', bg: true }))).children);
    expect(rows[0]!.querySelector('span')).not.toBeNull();
    expect(rows[1]!.querySelector('span')).toBeNull();
  });

  it('una lista en un texto con datos insertables también se dibuja', () => {
    const rows = textDiv(pageWith(text({ text: '{tienda}', list: 'bullet' }))).children;
    expect(rows).toHaveLength(1);
  });
});

describe('render: efectos (US2)', () => {
  const shadow = (over: Partial<TextEl>) => textDiv(pageWith(text(over))).style.textShadow;

  it('brillo: dos capas sin desplazamiento del color elegido', () => {
    const css = shadow({ bright: true, fxColor: '#00AA00', fxI: 50 });
    expect(css).toContain('calc(15px');
    expect(css).toContain('calc(30px');
    expect(css.match(/#00AA00/g)).toHaveLength(2);
  });

  it('eco: tres copias cada vez más lejos y más tenues', () => {
    const css = shadow({ echo: true, fxColor: '#112233', fxDist: 5 });
    expect(css).toContain('calc(5px * var(--fit, 1)) calc(5px');
    expect(css).toContain('calc(10px * var(--fit, 1)) calc(10px');
    expect(css).toContain('calc(15px * var(--fit, 1)) calc(15px');
    expect(css).toContain('rgba(17,34,51,0.6)');
    expect(css).toContain('rgba(17,34,51,0.2)');
  });

  it('desalineado: dos copias en sentidos opuestos', () => {
    const css = shadow({ misalign: true, fxDist: 4, fxColor: '#112233' });
    expect(css).toContain('calc(4px * var(--fit, 1)) calc(4px');
    expect(css).toContain('calc(-4px * var(--fit, 1)) calc(-4px');
  });

  it('distorsión: una copia de cada color a izquierda y derecha', () => {
    const css = shadow({ glitch: true, fxDist: 3, fxColor: '#FF0000', fxColor2: '#0000FF' });
    expect(css).toContain('calc(3px * var(--fit, 1)) calc(0px * var(--fit, 1)) calc(0px * var(--fit, 1)) #FF0000');
    expect(css).toContain('calc(-3px * var(--fit, 1)) calc(0px * var(--fit, 1)) calc(0px * var(--fit, 1)) #0000FF');
  });

  it('sin relleno: relleno transparente y borde con el color del texto', () => {
    const div = textDiv(pageWith(text({ hollow: true, color: '#102030' })));
    expect(div.style.color).toBe('transparent');
    expect(div.getAttribute('style')).toContain('-webkit-text-stroke: calc(2px * var(--fit, 1)) #102030');
  });

  it('sin relleno usa el contorno del texto cuando lo hay', () => {
    const div = textDiv(pageWith(text({ hollow: true, stroke: '#FF0000', strokeW: 3 })));
    expect(div.getAttribute('style')).toContain('calc(3px * var(--fit, 1)) #FF0000');
  });

  it('todos a la vez, con neón y sombra: orden fijo (neón → brillo → eco → desalineado → distorsión → sombra)', () => {
    const css = shadow({ glow: '#FF007A', bright: true, echo: true, misalign: true, glitch: true, shadow: true, fxColor: '#111111', fxColor2: '#222222', shColor: '#333333' });
    const at = (needle: string) => css.indexOf(needle);
    expect(at('#FF007A')).toBeGreaterThan(-1);
    expect(at('calc(15px')).toBeGreaterThan(at('#FF007A'));
    expect(at('rgba(17,17,17,0.6)')).toBeGreaterThan(at('calc(15px'));
    expect(at('#222222')).toBeGreaterThan(at('rgba(17,17,17,0.6)'));
    expect(css.lastIndexOf('rgba(51,51,51')).toBeGreaterThan(at('#222222'));
  });
});

describe('render: curvar (US3)', () => {
  it('con curvatura 0 o sin el campo no hay <svg>', () => {
    expect(pageWith(text({ curve: 0 })).querySelector('svg.tpl-text-curve')).toBeNull();
    expect(pageWith(text()).querySelector('svg.tpl-text-curve')).toBeNull();
  });

  it('con curvatura aparece un <svg> con el texto sobre un arco', () => {
    const svg = pageWith(text({ curve: 60 })).querySelector('svg.tpl-text-curve')!;
    expect(svg).not.toBeNull();
    expect(svg.querySelector('textPath')!.textContent).toBe('Hola mundo');
    expect(svg.querySelector('path')!.getAttribute('d')).toMatch(/^M 0 [\d.]+ A /);
  });

  it('el signo cambia la dirección del arco', () => {
    const up = pageWith(text({ curve: 60 })).querySelector('svg path')!.getAttribute('d')!;
    const down = pageWith(text({ curve: -60 })).querySelector('svg path')!.getAttribute('d')!;
    expect(up).toMatch(/0 0 1 /);
    expect(down).toMatch(/0 0 0 /);
  });

  it('solo se curva la primera línea', () => {
    const svg = pageWith(text({ text: 'Primera\nSegunda', curve: 30 })).querySelector('svg.tpl-text-curve')!;
    expect(svg.querySelector('textPath')!.textContent).toBe('Primera');
  });

  it('conserva color, contorno, mayúsculas, cursiva y sombra', () => {
    const svg = pageWith(text({ curve: 40, color: '#102030', stroke: '#FF0000', strokeW: 2, upper: true, italic: true, shadow: true })).querySelector('svg.tpl-text-curve')!;
    const t = svg.querySelector('text')!;
    expect(t.getAttribute('fill')).toBe('#102030');
    expect(t.getAttribute('stroke')).toBe('#FF0000');
    expect(t.getAttribute('font-style')).toBe('italic');
    expect(svg.querySelector('textPath')!.textContent).toBe('HOLA MUNDO');
    expect((svg as unknown as HTMLElement).style.filter).toContain('drop-shadow');
  });

  it('varias instancias del mismo elemento no comparten el trazado', () => {
    const a = pageWith(text({ curve: 60 })).querySelector('svg path')!.getAttribute('id');
    const b = pageWith(text({ curve: -60 })).querySelector('svg path')!.getAttribute('id');
    expect(a).not.toBe(b);
  });
});

const BANNER = 'neon-p2';
const slider = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const field = (label: string) => screen.getByLabelText(`${label} (valor)`) as HTMLInputElement;
const cell = (label: string) => screen.getByRole('button', { name: label });
const toggle = (label: string) => screen.getByRole('switch', { name: label });
const textOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!;
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
async function start() {
  mockEditorApi();
  await renderEditor();
  selectLayer(/^Banner/);
}
function type(label: string, value: string) {
  const input = field(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('inspector: formato (US1)', () => {
  it('Cursiva y Subrayado son interruptores que cambian el lienzo; un cambio = un paso de deshacer', async () => {
    await start();
    expect(toggle('Cursiva')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle('Cursiva'));
    fireEvent.click(toggle('Subrayado'));
    expect(textOf(BANNER).style.fontStyle).toBe('italic');
    expect(textOf(BANNER).style.textDecorationLine).toBe('underline');
    undo();
    expect(textOf(BANNER).style.textDecorationLine).toBe('');
    expect(textOf(BANNER).style.fontStyle).toBe('italic');
    undo();
    expect(textOf(BANNER).style.fontStyle).toBe('');
  });

  it('la alineación incluye «Justificado»', async () => {
    await start();
    fireEvent.click(within(screen.getByRole('group', { name: 'Alineación' })).getByRole('button', { name: 'Justificado' }));
    expect(textOf(BANNER).style.textAlign).toBe('justify');
  });

  it('Lista: Sin lista por defecto; Viñetas y Numerada dibujan marcadores', async () => {
    await start();
    const list = within(screen.getByRole('group', { name: 'Lista' }));
    expect(list.getByRole('button', { name: 'Sin lista' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(list.getByRole('button', { name: 'Viñetas' }));
    expect(textOf(BANNER).textContent).toContain('•');
    fireEvent.click(list.getByRole('button', { name: 'Numerada' }));
    expect(textOf(BANNER).textContent).toContain('1.');
    fireEvent.click(list.getByRole('button', { name: 'Sin lista' }));
    expect(textOf(BANNER).textContent).not.toContain('•');
  });

  it('con el elemento bloqueado, Cursiva y Subrayado quedan deshabilitados', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(toggle('Cursiva')).toBeDisabled();
    expect(toggle('Subrayado')).toBeDisabled();
  });
});

describe('inspector: cuadrícula de efectos (US2)', () => {
  const NAMES = ['Ninguno', 'Sombra', 'Brillo', 'Eco', 'Contorno', 'Fondo', 'Desalineado', 'Sin relleno', 'Neón', 'Distorsión'];

  it('muestra los diez estilos con su vista previa «Ag»', async () => {
    await start();
    const grid = within(screen.getByRole('group', { name: 'Efectos' }));
    for (const n of NAMES) {
      const c = grid.getByRole('button', { name: n });
      expect(c.querySelector('.ed-fx-preview')!.textContent).toBe('Ag');
    }
  });

  it('el Banner de Neón Noche trae el neón activo; «Ninguno» no está marcado', async () => {
    await start();
    expect(cell('Neón')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('Ninguno')).toHaveAttribute('aria-pressed', 'false');
  });

  it('elegir un estilo lo marca, lo dibuja y muestra sus parámetros; volver a pulsarlo lo quita', async () => {
    await start();
    fireEvent.click(cell('Eco'));
    expect(cell('Eco')).toHaveAttribute('aria-pressed', 'true');
    expect(slider('Distancia de los efectos')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Color de los efectos' })).toBeInTheDocument();
    expect(textOf(BANNER).style.textShadow).toContain('calc(6px');
    fireEvent.click(cell('Eco'));
    expect(cell('Eco')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Distancia de los efectos')).toBeNull();
  });

  it('se pueden combinar dos estilos', async () => {
    await start();
    fireEvent.click(cell('Sombra'));
    fireEvent.click(cell('Distorsión'));
    expect(cell('Sombra')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('Distorsión')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Segundo color de la distorsión' })).toBeInTheDocument();
  });

  it('«Ninguno» quita todos los efectos de un solo clic y deshacer los devuelve', async () => {
    await start();
    fireEvent.click(cell('Sombra'));
    fireEvent.click(cell('Fondo'));
    fireEvent.click(cell('Brillo'));
    fireEvent.click(cell('Ninguno'));
    for (const n of ['Sombra', 'Fondo', 'Brillo', 'Neón', 'Contorno']) expect(cell(n)).toHaveAttribute('aria-pressed', 'false');
    expect(cell('Ninguno')).toHaveAttribute('aria-pressed', 'true');
    expect(textOf(BANNER).style.textShadow).toBe('');
    expect(textOf(BANNER).querySelector('span')).toBeNull();
    undo();
    expect(cell('Sombra')).toHaveAttribute('aria-pressed', 'true');
    expect(cell('Neón')).toHaveAttribute('aria-pressed', 'true');
  });

  it('un parámetro de efecto es un paso de deshacer y se recorta al rango', async () => {
    await start();
    fireEvent.click(cell('Eco'));
    type('Distancia de los efectos', '99');
    expect(field('Distancia de los efectos').value).toBe('40');
    undo();
    expect(field('Distancia de los efectos').value).toBe('6');
  });

  it('el brillo muestra su intensidad', async () => {
    await start();
    fireEvent.click(cell('Brillo'));
    expect(field('Intensidad del brillo').value).toBe('50');
  });

  it('con el elemento bloqueado, la cuadrícula queda deshabilitada', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    for (const n of NAMES) expect(cell(n)).toBeDisabled();
  });
});

describe('inspector: Curvar (US3)', () => {
  it('aparece en «Forma», va de −100 a 100 y un cambio es un paso', async () => {
    await start();
    const s = slider('Curvar');
    expect([Number(s.min), Number(s.max)]).toEqual([-100, 100]);
    expect(field('Curvar').value).toBe('0');
    type('Curvar', '60');
    expect(canvasEl(BANNER)!.querySelector('svg.tpl-text-curve')).not.toBeNull();
    undo();
    expect(canvasEl(BANNER)!.querySelector('svg.tpl-text-curve')).toBeNull();
  });

  it('fuera de rango se recorta', async () => {
    await start();
    type('Curvar', '500');
    expect(field('Curvar').value).toBe('100');
    type('Curvar', '-500');
    expect(field('Curvar').value).toBe('-100');
  });

  it('avisa que Curvar admite una línea cuando el texto tiene varias', async () => {
    await start();
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Uno\nDos' } });
    type('Curvar', '30');
    expect(screen.getByText(/Curvar admite una línea/)).toBeInTheDocument();
  });

  it('con el elemento bloqueado, Curvar queda deshabilitado', async () => {
    await start();
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(slider('Curvar')).toBeDisabled();
  });
});

describe('copiar estilo (US4)', () => {
  /** Otro texto desbloqueado de la portada, distinto del Banner. */
  const otherText = () => {
    const els = Array.from(canvas().querySelectorAll<HTMLElement>('[data-el-type="text"]')).filter((e) => e.getAttribute('data-el-id') !== BANNER && !e.getAttribute('data-locked'));
    return els[0]!;
  };
  const click = (el: Element) => fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1, button: 0 });

  async function formatted() {
    await start();
    fireEvent.click(cell('Sombra'));
    fireEvent.click(toggle('Cursiva'));
    fireEvent.click(toggle('Subrayado'));
    type('Curvar', '25');
  }

  it('pega el formato en otro texto sin tocar su contenido, posición, tamaño ni nombre', async () => {
    await formatted();
    const target = otherText();
    const id = target.getAttribute('data-el-id')!;
    const before = { text: target.textContent, left: target.style.left, top: target.style.top, width: target.style.width, height: target.style.height };
    fireEvent.click(screen.getByRole('button', { name: 'Copiar estilo' }));
    expect(screen.getByRole('button', { name: 'Copiar estilo' })).toHaveAttribute('aria-pressed', 'true');
    click(canvasEl(id)!);
    const after = canvasEl(id)!;
    const t = after.querySelector<HTMLElement>('.tpl-text, .tpl-text-curve')!;
    expect(t.getAttribute('class')).toContain('tpl-text-curve');
    expect(after.style.left).toBe(before.left);
    expect(after.style.top).toBe(before.top);
    expect(after.style.width).toBe(before.width);
    expect(after.style.height).toBe(before.height);
    expect(after.textContent).toBe(before.text);
  });

  it('pegar es un solo paso de deshacer y la brocha se apaga', async () => {
    await formatted();
    const id = otherText().getAttribute('data-el-id')!;
    fireEvent.click(screen.getByRole('button', { name: 'Copiar estilo' }));
    click(canvasEl(id)!);
    expect(canvasEl(id)!.querySelector('svg.tpl-text-curve')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Copiar estilo' })).toHaveAttribute('aria-pressed', 'false');
    undo();
    expect(canvasEl(id)!.querySelector('svg.tpl-text-curve')).toBeNull();
  });

  it('Escape cancela sin cambiar nada', async () => {
    await formatted();
    const id = otherText().getAttribute('data-el-id')!;
    fireEvent.click(screen.getByRole('button', { name: 'Copiar estilo' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    click(canvasEl(id)!);
    expect(canvasEl(id)!.querySelector('svg.tpl-text-curve')).toBeNull();
  });

  it('un clic en vacío cancela la brocha', async () => {
    await formatted();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar estilo' }));
    fireEvent.pointerDown(canvas().querySelector('.tpl-page')!, { clientX: 5, clientY: 5, pointerId: 1, button: 0 });
    expect(screen.getByRole('button', { name: 'Copiar estilo' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('un elemento que no es texto no recibe el estilo y la brocha sigue activa', async () => {
    await formatted();
    const notText = Array.from(canvas().querySelectorAll<HTMLElement>('[data-el-id]')).find((e) => e.getAttribute('data-el-type') !== 'text')!;
    fireEvent.click(screen.getByRole('button', { name: 'Copiar estilo' }));
    click(notText);
    expect(screen.getByRole('button', { name: 'Copiar estilo' })).toHaveAttribute('aria-pressed', 'true');
  });
});
