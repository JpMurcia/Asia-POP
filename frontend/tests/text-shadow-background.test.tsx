import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokensFrom, type PageElement, type Template, type TextEl } from '../../backend/src/catalog/template';
import { baseTemplate, draftText } from '../../backend/src/catalog/template-presets';
import TemplatePage from '../src/print/TemplatePage';
import { canvasEl, fireEvent, mockEditorApi, openElements, renderEditor, saveButton, screen, selectLayer, waitFor } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 011: sombra y fondo del texto (render, inspector, historial, bloqueo) y «Agregar subtítulo». */
const tokens = tokensFrom({ storeName: 'ASIANPOP', phone1: '1', phone2: '2', address: 'x', coverTitle: 'y' }, 'RAMEN');

function pageWith(el: PageElement): HTMLElement {
  const t: Template = baseTemplate('neon');
  t.pages.portada.els = [el];
  return render(<TemplatePage template={t} page="portada" tokens={tokens} items={[]} />).container;
}
const text = (over: Partial<TextEl> = {}): PageElement => ({ ...draftText({ text: 'Hola mundo', x: 10, y: 10, w: 60, h: 20, ...over }), id: 'tx' });
const textDiv = (c: HTMLElement) => c.querySelector<HTMLElement>('.tpl-text')!;

describe('render: sin efectos el marcado es el de siempre', () => {
  it.each([
    ['texto libre', 'Hola mundo'],
    ['texto con datos', '{tienda}'],
  ])('%s: sin sombra ni fondo no hay <span> de fondo ni sombra', (_n, t) => {
    const div = textDiv(pageWith(text({ text: t })));
    expect(div.querySelector('span')).toBeNull();
    expect(div.style.textShadow).toBe('');
  });

  it('con el resplandor solo, el textShadow es el de antes', () => {
    const div = textDiv(pageWith(text({ glow: '#FF007A' })));
    expect(div.style.textShadow).toBe('0 0 10px #FF007A, 0 0 24px #FF007A');
  });
});

describe('render: sombra (US1)', () => {
  it('aparece en el estilo del texto', () => {
    const div = textDiv(pageWith(text({ shadow: true, shDist: 4, shAngle: 90, shBlur: 2, shAlpha: 100, shColor: '#000000' })));
    expect(div.style.textShadow).toContain('rgba(0,0,0,1)');
  });

  it('va después del resplandor cuando hay los dos', () => {
    const div = textDiv(pageWith(text({ glow: '#FF007A', shadow: true, shColor: '#00AA00' })));
    const css = div.style.textShadow;
    expect(css.indexOf('#FF007A')).toBeGreaterThan(-1);
    expect(css.indexOf('rgba(0,170,0')).toBeGreaterThan(css.indexOf('#FF007A'));
  });

  it('un color transparente no falla', () => {
    expect(() => pageWith(text({ shadow: true, shColor: 'transparent' }))).not.toThrow();
  });
});

describe('render: fondo (US2)', () => {
  it('envuelve el texto en un <span> con color, relleno y esquinas', () => {
    const div = textDiv(pageWith(text({ bg: true, bgColor: '#102030', bgAlpha: 50, bgPad: 6, bgRadius: 3 })));
    const span = div.querySelector<HTMLElement>('span')!;
    expect(span.textContent).toBe('Hola mundo');
    expect(span.style.backgroundColor).toBe('rgba(16, 32, 48, 0.5)');
    expect(span.getAttribute('style')).toContain('box-decoration-break: clone');
  });

  it('también en un texto con datos insertables', () => {
    const div = textDiv(pageWith(text({ text: '{tienda}', bg: true })));
    expect(div.querySelector('span')).not.toBeNull();
  });

  it('un texto vacío no deja fondo', () => {
    expect(textDiv(pageWith(text({ text: '', bg: true }))).querySelector('span')).toBeNull();
  });

  it('sombra y fondo a la vez, con contorno y resplandor, no se pisan', () => {
    const div = textDiv(pageWith(text({ bg: true, shadow: true, stroke: '#FFFFFF', strokeW: 2, glow: '#FF007A' })));
    expect(div.querySelector('span')).not.toBeNull();
    expect(div.style.textShadow).toBeTruthy();
    expect(div.getAttribute('style')).toContain('-webkit-text-stroke');
  });
});

const BANNER = 'neon-p2';
const slider = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const field = (label: string) => screen.getByLabelText(`${label} (valor)`) as HTMLInputElement;
const toggle = (label: string) => screen.getByRole('button', { name: label });
const textOf = (id: string) => canvasEl(id)!.querySelector<HTMLElement>('.tpl-text')!;
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
const undo = () => fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));

describe('inspector: sombra (US1)', () => {
  it('sin encender no muestra sus controles', async () => {
    await start();
    expect(toggle('Sombra')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Distancia de la sombra')).toBeNull();
  });

  it('al encenderla aparecen los cinco controles con sus valores por defecto y se ve en el lienzo', async () => {
    await start();
    fireEvent.click(toggle('Sombra'));
    for (const l of ['Distancia de la sombra', 'Dirección de la sombra', 'Desenfoque de la sombra', 'Transparencia de la sombra']) expect(slider(l)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Color de la sombra' })).toBeInTheDocument();
    expect(field('Distancia de la sombra').value).toBe('6');
    expect(field('Dirección de la sombra').value).toBe('45');
    expect(field('Transparencia de la sombra').value).toBe('50');
    expect(textOf(BANNER).style.textShadow).toContain('rgba(0,0,0,0.5)');
  });

  it('un cambio es un solo paso de deshacer y un valor igual no agrega paso', async () => {
    await start();
    fireEvent.click(toggle('Sombra'));
    type('Desenfoque de la sombra', '20');
    type('Desenfoque de la sombra', '20');
    expect(textOf(BANNER).style.textShadow).toContain('calc(20px');
    undo();
    expect(textOf(BANNER).style.textShadow).toContain('calc(6px');
    undo();
    expect(textOf(BANNER).style.textShadow).not.toContain('rgba(0,0,0,0.5)');
  });

  it('un valor fuera de rango se recorta al límite', async () => {
    await start();
    fireEvent.click(toggle('Sombra'));
    type('Desenfoque de la sombra', '99');
    expect(field('Desenfoque de la sombra').value).toBe('50');
    type('Transparencia de la sombra', '-5');
    expect(field('Transparencia de la sombra').value).toBe('0');
  });

  it('apagar y volver a encender conserva los ajustes', async () => {
    await start();
    fireEvent.click(toggle('Sombra'));
    type('Distancia de la sombra', '15');
    fireEvent.click(toggle('Sombra'));
    expect(textOf(BANNER).style.textShadow).not.toContain('rgba(0,0,0');
    fireEvent.click(toggle('Sombra'));
    expect(field('Distancia de la sombra').value).toBe('15');
  });

  it('con el elemento bloqueado, el interruptor y los controles están deshabilitados', async () => {
    await start();
    fireEvent.click(toggle('Sombra'));
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(toggle('Sombra')).toBeDisabled();
    expect(slider('Distancia de la sombra')).toBeDisabled();
    expect(field('Distancia de la sombra')).toBeDisabled();
  });
});

describe('inspector: fondo (US2)', () => {
  it('al encenderlo aparecen sus cuatro controles y el fondo se dibuja', async () => {
    await start();
    fireEvent.click(toggle('Fondo'));
    for (const l of ['Redondez del fondo', 'Separación del fondo', 'Transparencia del fondo']) expect(slider(l)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Color del fondo' })).toBeInTheDocument();
    expect(textOf(BANNER).querySelector('span')).not.toBeNull();
    undo();
    expect(textOf(BANNER).querySelector('span')).toBeNull();
  });

  it('un cambio de separación es un paso y el bloqueo deshabilita los controles', async () => {
    await start();
    fireEvent.click(toggle('Fondo'));
    type('Separación del fondo', '20');
    expect(textOf(BANNER).querySelector('span')!.style.padding).toContain('20px');
    undo();
    expect(textOf(BANNER).querySelector('span')!.style.padding).toContain('8px');
    fireEvent.click(screen.getByRole('button', { name: 'Bloquear' }));
    expect(toggle('Fondo')).toBeDisabled();
    expect(slider('Redondez del fondo')).toBeDisabled();
  });

  it('duplicar un texto con sombra y fondo conserva los campos', async () => {
    await start();
    fireEvent.click(toggle('Sombra'));
    fireEvent.click(toggle('Fondo'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar' }));
    expect(toggle('Sombra')).toHaveAttribute('aria-pressed', 'true');
    expect(toggle('Fondo')).toHaveAttribute('aria-pressed', 'true');
  });

  it('se guarda con la plantilla y viaja con todos sus parámetros (ida y vuelta)', async () => {
    const api = mockEditorApi();
    await renderEditor();
    selectLayer(/^Banner/);
    fireEvent.click(toggle('Sombra'));
    type('Distancia de la sombra', '12');
    fireEvent.click(toggle('Fondo'));
    type('Redondez del fondo', '20');
    fireEvent.click(saveButton());
    await waitFor(() => expect(api.puts()).toHaveLength(1));
    const neon = (api.puts()[0]!.body!.templates as { pages: { portada: { els: Record<string, unknown>[] } } }[])[0]!;
    expect(neon.pages.portada.els.find((e) => e.id === BANNER)).toMatchObject({ shadow: true, shDist: 12, bg: true, bgRadius: 20 });
  });
});

describe('«Agregar subtítulo» (US3)', () => {
  it('agrega un texto con fuente de cuerpo, 24 px y peso 700, entre el título y el texto', async () => {
    mockEditorApi();
    await renderEditor();
    openElements();
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names.indexOf('Agregar subtítulo')).toBe(names.indexOf('Agregar título') + 1);
    expect(names.indexOf('Agregar texto')).toBe(names.indexOf('Agregar subtítulo') + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar subtítulo' }));
    // queda seleccionado: el inspector muestra su tamaño y su peso
    expect(Number(slider('Tamaño').value)).toBe(24);
    expect(screen.getByRole('button', { name: 'Negrita' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('título y texto conservan su formato', async () => {
    mockEditorApi();
    await renderEditor();
    openElements();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar título' }));
    expect(Number(slider('Tamaño').value)).toBe(40);
    openElements();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar texto' }));
    expect(Number(slider('Tamaño').value)).toBe(16);
  });
});
