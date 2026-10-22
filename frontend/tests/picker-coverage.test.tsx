import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BASE_TEMPLATES, draftText } from '../../backend/src/catalog/template-presets';
import { DEFAULT_BUSINESS } from '../../backend/src/catalog/settings.repo';
import type { PageElement, Template } from '../../backend/src/catalog/template';
import FieldRenderer from '../src/pages/TemplateEditor/FieldRenderer';
import { fieldsFor, pageFields, type FieldDesc } from '../src/pages/TemplateEditor/inspector-fields';
import { createEditorState, editorReducer, isDirty, type EditorState } from '../src/pages/TemplateEditor/useTemplateEditor';
import { usedColors } from '../src/pages/TemplateEditor/template-colors';
import { mockEditorApi, renderEditor, selectLayer } from './editor-helpers';

afterEach(() => vi.unstubAllGlobals());

/** Feature 009: teclado, recorrido de todas las propiedades, ida y vuelta sin cambios y rendimiento. */
const PAGES = ['portada', 'seccion', 'productos', 'politicas'] as const;
const kindsIn = (fields: readonly FieldDesc[]): FieldDesc[] => fields.flatMap((f) => (f.kind === 'section' ? kindsIn(f.fields) : [f]));

describe('teclado y accesibilidad (FR-018, SC-007)', () => {
  const start = async () => {
    mockEditorApi();
    await renderEditor();
    selectLayer(/^Banner/);
  };
  const button = (field: string) => screen.getByRole('button', { name: new RegExp(`^${field}: `) });

  it.each([
    ['Relleno', 'Color: Relleno', 'Buscar color por nombre o código'],
    ['Fuente', 'Fuente', 'Buscar fuente'],
  ])('«%s»: se abre, el foco va al buscador, Escape lo cierra y el foco vuelve al botón', async (field, dialogName, searchName) => {
    await start();
    fireEvent.click(button(field));
    expect(screen.getByRole('dialog', { name: dialogName })).toBeInTheDocument();
    expect(screen.getByLabelText(searchName)).toHaveFocus();
    fireEvent.keyDown(screen.getByLabelText(searchName), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button(field)).toHaveFocus();
  });

  it('el botón del selector es un botón nativo y su estado se anuncia: aria-expanded, aria-haspopup y el valor activo en el nombre', async () => {
    await start();
    const b = button('Relleno');
    expect(b.tagName).toBe('BUTTON');
    expect(b).toHaveAttribute('aria-haspopup', 'dialog');
    expect(b).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(b.getAttribute('aria-label')).toMatch(/^Relleno: .+/);
  });

  it('el color y la fuente activos se anuncian en una región de estado y todas las opciones son botones alcanzables con Tab', async () => {
    await start();
    fireEvent.click(button('Relleno'));
    expect(screen.getByRole('status')).toHaveTextContent(/^Color activo: /);
    for (const option of within(screen.getByRole('dialog')).getAllByRole('button')) {
      expect(option.tabIndex).toBeGreaterThanOrEqual(0);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(button('Fuente'));
    expect(screen.getByRole('status')).toHaveTextContent(/^Fuente activa: /);
    for (const option of within(screen.getByRole('dialog')).getAllByRole('button')) {
      expect(option.tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('Enter en el buscador de color aplica un código válido sin usar el ratón', async () => {
    await start();
    fireEvent.click(button('Relleno'));
    const search = screen.getByLabelText('Buscar color por nombre o código');
    fireEvent.change(search, { target: { value: '#0F0' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(button('Relleno')).toHaveAccessibleName('Relleno: #00FF00');
  });

  it('Escape cierra el selector sin quitar la selección del elemento (no llega a los atajos del editor)', async () => {
    await start();
    fireEvent.click(button('Relleno'));
    fireEvent.keyDown(screen.getByLabelText('Buscar color por nombre o código'), { key: 'Escape' });
    expect(button('Relleno')).toBeInTheDocument();
    expect(screen.getByTestId('inspector')).toHaveTextContent('Texto');
  });
});

describe('recorrido de cada propiedad de color y de fuente de cada tipo de elemento (SC-005)', () => {
  /** Un elemento de cada tipo en cada plantilla base, con los descriptores que el inspector le da. */
  const cases = BASE_TEMPLATES.flatMap((t) =>
    PAGES.flatMap((page) => t.pages[page].els.map((el) => ({ t, page, el }))),
  );

  it('hay elementos de todos los tipos para recorrer', () => {
    expect(new Set(cases.map((c) => c.el.type))).toEqual(new Set(['text', 'badge', 'shape', 'image', 'intro', 'products', 'terms', 'footer']));
  });

  it('cada descriptor de color abre un selector con la paleta completa, el selector gráfico y «Ninguno»/«Transparente» solo donde el descriptor las trae', () => {
    let colors = 0;
    const seen = new Set<string>();
    for (const { t, el } of cases) {
      const fields = kindsIn(fieldsFor(el, t));
      const signature = `${el.type}:${fields.filter((f) => f.kind === 'color' || f.kind === 'font').map((f) => (f.kind === 'color' ? `${f.key}/${f.none ?? '-'}` : f.key)).join(',')}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      const { unmount } = render(
        <FieldRenderer fields={fieldsFor(el, t)} values={el as unknown as Record<string, unknown>} palette={t.palette} template={t} onChange={() => {}} sectionOpen={{ 'text-advanced': true }} />,
      );
      for (const f of fields.filter((x): x is Extract<FieldDesc, { kind: 'color' }> => x.kind === 'color')) {
        colors++;
        const group = screen.getByRole('group', { name: f.label });
        fireEvent.click(within(group).getByRole('button', { name: new RegExp(`^${f.label}: `) }));
        const dialog = within(screen.getByRole('dialog', { name: `Color: ${f.label}` }));
        for (const name of ['Fondo', 'Acento 1', 'Acento 2', 'Acento 3', 'Texto de la paleta', 'Papel']) {
          expect(dialog.getAllByRole('button', { name }).length, `${signature} ${f.label} ${name}`).toBeGreaterThan(0);
        }
        expect(dialog.getByLabelText('Color personalizado')).toBeInTheDocument();
        const special = f.none === 'none' ? 'Ninguno' : f.none === 'transparent' ? 'Transparente' : null;
        for (const label of ['Ninguno', 'Transparente']) {
          if (label === special) expect(dialog.getByRole('button', { name: label })).toBeInTheDocument();
          else expect(dialog.queryByRole('button', { name: label }), `${signature} ${f.label} no debería ofrecer ${label}`).not.toBeInTheDocument();
        }
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      }
      for (const f of fields.filter((x) => x.kind === 'font')) {
        const group = screen.getByRole('group', { name: f.label });
        fireEvent.click(within(group).getByRole('button', { name: /^Fuente: / }));
        const dialog = within(screen.getByRole('dialog', { name: 'Fuente' }));
        for (const name of ['Fredoka', 'Poppins', 'Bungee', 'Zen Maru Gothic', 'Space Grotesk', 'DM Serif Display', /^Título · /, /^Cuerpo · /]) {
          expect(dialog.getAllByRole('button', { name }).length).toBeGreaterThan(0);
        }
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      }
      unmount();
    }
    expect(colors).toBeGreaterThan(20);
  });

  it('el fondo de cada página usa el mismo selector de color', () => {
    const t = BASE_TEMPLATES[0]!;
    for (const type of ['color', 'gradient'] as const) {
      const bg = { ...t.pages.portada.bg, type } as Template['pages']['portada']['bg'];
      const { unmount } = render(<FieldRenderer fields={pageFields(bg)} values={bg as unknown as Record<string, unknown>} palette={t.palette} template={t} onChange={() => {}} />);
      expect(screen.getAllByRole('button', { name: /^(Color|Color superior|Color inferior): / }).length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('abrir y guardar de nuevo no cambia ningún color ni fuente (SC-008)', () => {
  const COLOR_LIKE = /^(color|color2|stroke|glow|fill|border|boxFill|textColor|nameColor|nameFill|cardFill|ring|bubbleFill|priceFill|priceBorder|priceText|soldFill|chipFill|chipText|line)$/;

  it('elegir en el selector el valor que cada elemento ya tiene no cambia nada ni marca la plantilla como modificada', () => {
    const ws = { templates: structuredClone(BASE_TEMPLATES), defaultId: 'neon', business: structuredClone(DEFAULT_BUSINESS) };
    let checked = 0;
    for (const template of ws.templates) {
      let s: EditorState = createEditorState(ws, 1);
      s = editorReducer(s, { type: 'openTemplate', id: template.id });
      for (const page of PAGES) {
        s = editorReducer(s, { type: 'selectPage', page });
        const els = s.workspace.templates.find((t) => t.id === template.id)!.pages[page].els;
        for (const el of els) {
          const rec = el as unknown as Record<string, unknown>;
          for (const [k, v] of Object.entries(rec)) {
            if (!(COLOR_LIKE.test(k) || k === 'font') || typeof v !== 'string') continue;
            const next = editorReducer(s, { type: 'patch', id: el.id, patch: { [k]: v } as Partial<PageElement>, now: 1 });
            expect(next, `${template.id}/${page}/${el.id}.${k}`).toBe(s);
            checked++;
          }
        }
      }
      expect(isDirty(s)).toBe(false);
    }
    expect(checked).toBeGreaterThan(50);
  });
});

describe('rendimiento (SC-006)', () => {
  it('reunir los colores de una plantilla de 200 elementos tarda mucho menos de 0,2 s', () => {
    const t = structuredClone(BASE_TEMPLATES[0]!);
    t.pages.portada.els = Array.from({ length: 200 }, (_, i) => ({
      ...draftText({ color: `#${(0x100000 + i * 0x0a0b0c).toString(16).toUpperCase().padStart(6, '0').slice(-6)}`, stroke: i % 2 ? 'a1' : '#ABCDEF' }),
      id: `e${i}`,
    })) as PageElement[];
    const start = performance.now();
    const colors = usedColors(t);
    const ms = performance.now() - start;
    expect(colors.length).toBeGreaterThan(50);
    expect(ms).toBeLessThan(100);
  });
});
