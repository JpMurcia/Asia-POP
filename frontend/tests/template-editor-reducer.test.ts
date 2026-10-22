import { describe, expect, it } from 'vitest';
import { PAGE_H, PAGE_W, type PageElement, type ProductsEl, type TextEl } from '../../backend/src/catalog/template';
import { photoScaleLimits } from '../../backend/src/catalog/template-layout';
import { BASE_TEMPLATES, baseTemplate, draftText } from '../../backend/src/catalog/template-presets';
import { DEFAULT_BUSINESS } from '../../backend/src/catalog/settings.repo';
import {
  HISTORY_LIMIT,
  MERGE_WINDOW_MS,
  activeTemplate,
  alignBox,
  createEditorState,
  editorReducer,
  isDirty,
  selectedElement,
  type EditorAction,
  type EditorState,
} from '../src/pages/TemplateEditor/useTemplateEditor';

const workspace = () => ({
  templates: structuredClone(BASE_TEMPLATES),
  defaultId: 'neon',
  business: structuredClone(DEFAULT_BUSINESS),
});

const fresh = (): EditorState => createEditorState(workspace(), 1);
const run = (s: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, s);
const T0 = 1_000_000;

const els = (s: EditorState, page = s.page) => activeTemplate(s).pages[page].els;
const byId = (s: EditorState, id: string, page = s.page) => els(s, page).find((e) => e.id === id);
const text = (id: string, over: Partial<TextEl> = {}): PageElement => ({ ...draftText({ text: id, ...over }), id });

/** Un estado en Portada con un texto libre ya agregado. */
function withText(): EditorState {
  return run(fresh(), { type: 'selectPage', page: 'portada' }, { type: 'addElement', el: text('mio', { x: 10, y: 20, w: 40, h: 10 }) });
}

describe('estado inicial', () => {
  it('parte de la plantilla predeterminada, en Portada, sin selección ni cambios', () => {
    const s = fresh();
    expect(s.activeId).toBe('neon');
    expect(s.page).toBe('portada');
    expect(s.selId).toBeNull();
    expect(s.view).toBe('editor');
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(isDirty(s)).toBe(false);
  });

  it('abre la predeterminada aunque no sea la primera', () => {
    const w = workspace();
    w.defaultId = 'kraft';
    expect(createEditorState(w, 3).activeId).toBe('kraft');
  });
});

describe('agregar, mover, redimensionar y cambiar propiedades', () => {
  it('agregar deja el elemento seleccionado y lo ubica antes del pie', () => {
    const s = run(fresh(), { type: 'selectPage', page: 'productos' }, { type: 'addElement', el: text('nuevo') });
    expect(s.selId).toBe('nuevo');
    const ids = els(s).map((e) => e.id);
    const footer = els(s).findIndex((e) => e.type === 'footer');
    expect(ids.indexOf('nuevo')).toBe(footer - 1);
    expect(selectedElement(s)?.id).toBe('nuevo');
  });

  it('en una página sin pie agrega al final (al frente)', () => {
    const s = withText();
    expect(els(s).at(-1)?.id).toBe('mio');
  });

  it('mover cambia x e y sin tocar lo demás', () => {
    const s = run(withText(), { type: 'patch', id: 'mio', patch: { x: 33, y: 44 }, now: T0 });
    expect(byId(s, 'mio')).toMatchObject({ x: 33, y: 44, w: 40, h: 10 });
  });

  it('redimensionar cambia w y h', () => {
    const s = run(withText(), { type: 'patch', id: 'mio', patch: { w: 55, h: 12 }, now: T0 });
    expect(byId(s, 'mio')).toMatchObject({ w: 55, h: 12, x: 10 });
  });

  it('cambiar una propiedad propia del tipo', () => {
    const s = run(withText(), { type: 'patch', id: 'mio', patch: { color: 'a1', size: 60 } as Partial<PageElement>, now: T0 });
    expect(byId(s, 'mio')).toMatchObject({ color: 'a1', size: 60 });
  });

  it('el fondo de la página también se edita', () => {
    const s = run(fresh(), { type: 'patchBg', patch: { type: 'color', color: 'a3' }, now: T0 });
    expect(activeTemplate(s).pages.portada.bg).toMatchObject({ type: 'color', color: 'a3' });
  });

  it('no modifica el estado anterior (actualizaciones inmutables)', () => {
    const before = withText();
    const snapshot = JSON.stringify(before.workspace);
    run(before, { type: 'patch', id: 'mio', patch: { x: 99 }, now: T0 });
    expect(JSON.stringify(before.workspace)).toBe(snapshot);
  });

  it('las plantillas no tocadas conservan su identidad tras editar otra', () => {
    const before = fresh();
    const after = run(before, { type: 'selectPage', page: 'portada' }, { type: 'addElement', el: text('x') });
    expect(after.workspace.templates[0]).not.toBe(before.workspace.templates[0]);
    for (const i of [1, 2, 3]) expect(after.workspace.templates[i]).toBe(before.workspace.templates[i]);
    // y de la plantilla editada solo cambia la página tocada
    expect(activeTemplate(after).pages.seccion).toBe(activeTemplate(before).pages.seccion);
    expect(activeTemplate(after).pages.portada).not.toBe(activeTemplate(before).pages.portada);
  });
});

describe('eliminar, duplicar, ordenar, bloquear y ocultar', () => {
  it('eliminar quita el elemento y anula la selección', () => {
    const s = run(withText(), { type: 'delete', id: 'mio' });
    expect(byId(s, 'mio')).toBeUndefined();
    expect(s.selId).toBeNull();
  });

  it('duplicar crea una copia desplazada 3 % y 2 %, llamada "… copia", libre y seleccionada', () => {
    const s = run(
      withText(),
      { type: 'patch', id: 'mio', patch: { name: 'Título', locked: true }, now: T0 },
      { type: 'duplicate', id: 'mio', newId: 'copia1', now: T0 },
    );
    const copy = byId(s, 'copia1')!;
    expect(copy).toMatchObject({ x: 13, y: 22, w: 40, h: 10, name: 'Título copia', locked: false });
    expect(s.selId).toBe('copia1');
    expect(byId(s, 'mio')).toMatchObject({ x: 10, y: 20, locked: true });
  });

  it('un elemento sin nombre se duplica con el nombre de su tipo', () => {
    const s = run(withText(), { type: 'duplicate', id: 'mio', newId: 'c', now: T0 });
    expect(byId(s, 'c')).toMatchObject({ name: 'Texto copia' });
  });

  it('"al frente" y "atrás" mueven el elemento una capa', () => {
    let s = run(withText(), { type: 'addElement', el: text('otro') }, { type: 'addElement', el: text('tercero') });
    const order = () => els(s).map((e) => e.id).filter((id) => ['mio', 'otro', 'tercero'].includes(id));
    expect(order()).toEqual(['mio', 'otro', 'tercero']);
    s = run(s, { type: 'reorder', id: 'mio', dir: 1 });
    expect(order()).toEqual(['otro', 'mio', 'tercero']);
    s = run(s, { type: 'reorder', id: 'tercero', dir: -1 });
    expect(order()).toEqual(['otro', 'tercero', 'mio']);
  });

  it('no se sale de los extremos de la pila', () => {
    const s = withText();
    const last = run(s, { type: 'reorder', id: 'mio', dir: 1 });
    expect(els(last).at(-1)?.id).toBe('mio');
    const first = run(s, { type: 'selectPage', page: 'portada' }, { type: 'reorder', id: els(s)[0]!.id, dir: -1 });
    expect(els(first)[0]!.id).toBe(els(s)[0]!.id);
  });

  it('bloquear y desbloquear', () => {
    const locked = run(withText(), { type: 'toggleLock', id: 'mio' });
    expect(byId(locked, 'mio')?.locked).toBe(true);
    expect(byId(run(locked, { type: 'toggleLock', id: 'mio' }), 'mio')?.locked).toBe(false);
  });

  it('ocultar y mostrar', () => {
    const hidden = run(withText(), { type: 'toggleVisible', id: 'mio' });
    expect(byId(hidden, 'mio')?.visible).toBe(false);
    expect(byId(run(hidden, { type: 'toggleVisible', id: 'mio' }), 'mio')?.visible).toBe(true);
  });

  it('un elemento oculto sigue seleccionable y editable', () => {
    const s = run(withText(), { type: 'toggleVisible', id: 'mio' }, { type: 'select', id: 'mio' }, { type: 'patch', id: 'mio', patch: { x: 5 }, now: T0 });
    expect(selectedElement(s)).toMatchObject({ id: 'mio', visible: false, x: 5 });
  });
});

describe('bloques automáticos', () => {
  const onProducts = () => run(fresh(), { type: 'selectPage', page: 'productos' });
  const block = (s: EditorState, type: string) => els(s).find((e) => e.type === type)!;

  it('no se pueden eliminar: el mensaje explica por qué y no cambia nada', () => {
    const s = onProducts();
    const after = run(s, { type: 'delete', id: block(s, 'products').id });
    expect(els(after)).toBe(els(s));
    expect(after.message?.text).toMatch(/obligatorio/i);
    expect(after.past).toEqual([]);
  });

  it('no se pueden ocultar', () => {
    const s = onProducts();
    const after = run(s, { type: 'toggleVisible', id: block(s, 'footer').id });
    expect(block(after, 'footer').visible).toBe(true);
    expect(after.message?.text).toMatch(/ocultar/i);
  });

  it('no se pueden duplicar', () => {
    const s = onProducts();
    const after = run(s, { type: 'duplicate', id: block(s, 'products').id, newId: 'x', now: T0 });
    expect(els(after)).toBe(els(s));
    expect(after.message?.text).toMatch(/un bloque de este tipo/i);
  });

  it('sí se pueden mover, redimensionar y cambiar de estilo una vez desbloqueados', () => {
    const s0 = onProducts();
    const id = block(s0, 'products').id;
    const s = run(
      s0,
      { type: 'toggleLock', id },
      { type: 'patch', id, patch: { x: 5, w: 80, layout: 'lista', sold: 'cinta' } as Partial<PageElement>, now: T0 },
    );
    expect(block(s, 'products')).toMatchObject({ locked: false, x: 5, w: 80, layout: 'lista', sold: 'cinta' });
  });

  it('no se giran ni se ocultan con un parche directo', () => {
    const s0 = onProducts();
    const id = block(s0, 'products').id;
    const s = run(s0, { type: 'patch', id, patch: { rot: 30, visible: false } as Partial<PageElement>, now: T0 });
    expect(block(s, 'products')).toMatchObject({ rot: 0, visible: true });
  });
});

describe('deshacer y rehacer', () => {
  it('cada acción se deshace y se rehace devolviendo el diseño exactamente al estado anterior (SC-005)', () => {
    const steps: EditorAction[] = [
      { type: 'addElement', el: text('a') },
      { type: 'patch', id: 'a', patch: { x: 50 }, now: T0 },
      { type: 'patch', id: 'a', patch: { w: 70 }, now: T0 + 5_000 },
      { type: 'duplicate', id: 'a', newId: 'b', now: T0 },
      { type: 'reorder', id: 'a', dir: 1 },
      { type: 'toggleLock', id: 'a' },
      { type: 'toggleVisible', id: 'a' },
      { type: 'delete', id: 'b' },
      { type: 'patchBg', patch: { type: 'gradient' }, now: T0 + 10_000 },
    ];
    let s = run(fresh(), { type: 'selectPage', page: 'portada' });
    const states = [s];
    for (const a of steps) {
      s = run(s, a);
      states.push(s);
    }
    // deshacer hasta el principio
    for (let i = steps.length - 1; i >= 0; i--) {
      s = run(s, { type: 'undo' });
      expect(s.workspace, `deshacer paso ${i}`).toEqual(states[i]!.workspace);
    }
    // rehacer hasta el final
    for (let i = 0; i < steps.length; i++) {
      s = run(s, { type: 'redo' });
      expect(s.workspace, `rehacer paso ${i}`).toEqual(states[i + 1]!.workspace);
    }
  });

  it('una acción nueva descarta lo que se podía rehacer', () => {
    const s = run(withText(), { type: 'patch', id: 'mio', patch: { x: 1 }, now: T0 }, { type: 'undo' });
    expect(s.future).toHaveLength(1);
    expect(run(s, { type: 'patch', id: 'mio', patch: { x: 2 }, now: T0 + 5_000 }).future).toEqual([]);
  });

  it('deshacer o rehacer sin pasos no hace nada', () => {
    const s = fresh();
    expect(run(s, { type: 'undo' })).toBe(s);
    expect(run(s, { type: 'redo' })).toBe(s);
  });

  it('el historial guarda 60 pasos como máximo', () => {
    let s = withText();
    for (let i = 0; i < 80; i++) {
      s = run(s, { type: 'patch', id: 'mio', patch: { x: i }, now: T0 + i * 10_000 });
    }
    expect(HISTORY_LIMIT).toBe(60);
    expect(s.past).toHaveLength(60);
    for (let i = 0; i < 60; i++) s = run(s, { type: 'undo' });
    expect(s.past).toHaveLength(0);
    expect(byId(s, 'mio')?.x).toBe(19); // los primeros 20 pasos ya no se pueden deshacer
  });

  it('el historial incluye la plantilla predeterminada y los datos del negocio', () => {
    const s0 = fresh();
    const s = run(s0, { type: 'setDefault', id: 'pop' }, { type: 'patchBusiness', patch: { phone1: '300 000 0000' }, now: T0 });
    expect(s.workspace.defaultId).toBe('pop');
    expect(s.workspace.business.phone1).toBe('300 000 0000');
    const back = run(s, { type: 'undo' }, { type: 'undo' });
    expect(back.workspace.defaultId).toBe('neon');
    expect(back.workspace.business.phone1).toBe(DEFAULT_BUSINESS.phone1);
    const fwd = run(back, { type: 'redo' }, { type: 'redo' });
    expect(fwd.workspace).toEqual(s.workspace);
  });

  describe('acciones continuas', () => {
    it('la misma clave en menos de 800 ms es un solo paso', () => {
      const s = run(
        withText(),
        { type: 'patch', id: 'mio', patch: { size: 41 } as Partial<PageElement>, key: 'mio:size', now: T0 },
        { type: 'patch', id: 'mio', patch: { size: 42 } as Partial<PageElement>, key: 'mio:size', now: T0 + 300 },
        { type: 'patch', id: 'mio', patch: { size: 43 } as Partial<PageElement>, key: 'mio:size', now: T0 + 700 },
      );
      expect(MERGE_WINDOW_MS).toBe(800);
      expect(s.past).toHaveLength(2); // agregar + un paso del control
      expect((byId(s, 'mio') as TextEl).size).toBe(43);
      const undone = run(s, { type: 'undo' });
      expect((byId(undone, 'mio') as TextEl).size).toBe(40);
    });

    it('la ventana se renueva con cada cambio', () => {
      const s = run(
        withText(),
        { type: 'patch', id: 'mio', patch: { x: 1 }, key: 'k', now: T0 },
        { type: 'patch', id: 'mio', patch: { x: 2 }, key: 'k', now: T0 + 700 },
        { type: 'patch', id: 'mio', patch: { x: 3 }, key: 'k', now: T0 + 1_400 },
      );
      expect(s.past).toHaveLength(2);
    });

    it('pasada la ventana es otro paso', () => {
      const s = run(
        withText(),
        { type: 'patch', id: 'mio', patch: { x: 1 }, key: 'k', now: T0 },
        { type: 'patch', id: 'mio', patch: { x: 2 }, key: 'k', now: T0 + 900 },
      );
      expect(s.past).toHaveLength(3);
    });

    it('claves distintas son pasos distintos', () => {
      const s = run(
        withText(),
        { type: 'patch', id: 'mio', patch: { x: 1 }, key: 'mio:x', now: T0 },
        { type: 'patch', id: 'mio', patch: { y: 1 }, key: 'mio:y', now: T0 + 100 },
      );
      expect(s.past).toHaveLength(3);
    });

    it('un deshacer corta la fusión: lo siguiente es un paso nuevo', () => {
      const s = run(
        withText(),
        { type: 'patch', id: 'mio', patch: { x: 1 }, key: 'k', now: T0 },
        { type: 'undo' },
        { type: 'patch', id: 'mio', patch: { x: 2 }, key: 'k', now: T0 + 100 },
      );
      expect(s.past).toHaveLength(2);
      expect(byId(s, 'mio')?.x).toBe(2);
    });

    it('un gesto (arrastrar) es un solo paso: checkpoint y luego parches sin historial', () => {
      let s = withText();
      const before = s.past.length;
      s = run(s, { type: 'checkpoint', now: T0 });
      for (let i = 1; i <= 25; i++) s = run(s, { type: 'patch', id: 'mio', patch: { x: 10 + i }, record: false, now: T0 + i });
      expect(s.past).toHaveLength(before + 1);
      expect(byId(s, 'mio')?.x).toBe(35);
      expect(byId(run(s, { type: 'undo' }), 'mio')?.x).toBe(10);
    });
  });

  it('cambiar de plantilla reinicia el historial y no pierde los cambios sin guardar', () => {
    let s = withText();
    s = run(s, { type: 'openTemplate', id: 'pop' });
    expect(s.activeId).toBe('pop');
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.selId).toBeNull();
    expect(s.view).toBe('editor');
    // los cambios de Neón Noche siguen en el conjunto y cuentan como cambios sin guardar
    expect(s.workspace.templates[0]!.pages.portada.els.some((e) => e.id === 'mio')).toBe(true);
    expect(isDirty(s)).toBe(true);
  });
});

describe('cambios sin guardar (dirty)', () => {
  it('un cambio marca sucio y deshacerlo lo deja limpio', () => {
    const s = withText();
    expect(isDirty(s)).toBe(true);
    expect(isDirty(run(s, { type: 'undo' }))).toBe(false);
  });

  it('compara con lo guardado, no con el paso anterior', () => {
    const s = run(withText(), { type: 'patch', id: 'mio', patch: { x: 1 }, now: T0 }, { type: 'patch', id: 'mio', patch: { x: 10 }, now: T0 + 5_000 });
    expect(isDirty(s)).toBe(true); // el elemento existe y antes no
  });

  it('un cambio y su inverso vuelven a limpio', () => {
    const s = run(fresh(), { type: 'setDefault', id: 'pop' });
    expect(isDirty(s)).toBe(true);
    expect(isDirty(run(s, { type: 'setDefault', id: 'neon' }))).toBe(false);
  });

  it('los datos del negocio también cuentan', () => {
    expect(isDirty(run(fresh(), { type: 'patchBusiness', patch: { address: 'otra' }, now: T0 }))).toBe(true);
  });

  it('guardar deja limpio, conserva el historial y toma la revisión nueva', () => {
    const s = withText();
    const saved = run(s, { type: 'saved', workspace: s.workspace, revision: 2 });
    expect(isDirty(saved)).toBe(false);
    expect(saved.revision).toBe(2);
    expect(saved.past).toEqual(s.past);
    expect(run(saved, { type: 'undo' }).workspace).not.toEqual(saved.workspace);
    expect(isDirty(run(saved, { type: 'undo' }))).toBe(true);
  });

  it('guardar con la respuesta del servidor (colores normalizados) deja limpio', () => {
    const s = withText();
    const server = structuredClone(s.workspace);
    server.templates[0]!.palette.a1 = '#FF007A';
    const saved = run(s, { type: 'saved', workspace: server, revision: 2 });
    expect(isDirty(saved)).toBe(false);
    expect(saved.workspace).toBe(saved.saved);
  });

  it('lo editado mientras se guardaba se conserva y sigue contando como pendiente', () => {
    const s = withText();
    const sent = s.workspace;
    const server = structuredClone(sent); // lo que el servidor guardó: lo que se envió
    const edited = run(s, { type: 'patch', id: 'mio', patch: { x: 33 }, now: T0 }); // el usuario siguió editando
    const saved = run(edited, { type: 'saved', workspace: server, revision: 2, sent });
    expect((byId(saved, 'mio') as TextEl).x).toBe(33);
    expect(saved.saved).toBe(server);
    expect(saved.revision).toBe(2);
    expect(isDirty(saved)).toBe(true);
  });

  it('sin ediciones durante el guardado, `sent` no cambia el resultado', () => {
    const s = withText();
    const server = structuredClone(s.workspace);
    const saved = run(s, { type: 'saved', workspace: server, revision: 2, sent: s.workspace });
    expect(saved.workspace).toBe(server);
    expect(isDirty(saved)).toBe(false);
  });
});

describe('paleta y tipografía', () => {
  const palette = (s: EditorState) => activeTemplate(s).palette;

  it('un color de la paleta se guarda en mayúsculas', () => {
    const s = run(fresh(), { type: 'setPaletteColor', key: 'a1', value: '#00aaff', now: T0 });
    expect(palette(s).a1).toBe('#00AAFF');
    expect(isDirty(s)).toBe(true);
  });

  it.each(['rosa', '#FFF', '#12345', '#1234567', '12AB34', '#12AB3G', ''])('rechaza %j y deja el estado como estaba', (value) => {
    const s = fresh();
    expect(run(s, { type: 'setPaletteColor', key: 'a1', value, now: T0 })).toBe(s);
  });

  it('el mismo valor no agrega un paso al historial', () => {
    const s = fresh();
    expect(run(s, { type: 'setPaletteColor', key: 'a1', value: palette(s).a1, now: T0 })).toBe(s);
  });

  it('arrastrar el selector de color (muchos cambios del mismo color) es un solo paso', () => {
    const s = run(
      fresh(),
      { type: 'setPaletteColor', key: 'a1', value: '#111111', now: T0 },
      { type: 'setPaletteColor', key: 'a1', value: '#222222', now: T0 + 100 },
      { type: 'setPaletteColor', key: 'a1', value: '#333333', now: T0 + 200 },
    );
    expect(s.past).toHaveLength(1);
    expect(palette(run(s, { type: 'undo' })).a1).toBe('#FF007A');
  });

  it('colores distintos son pasos distintos', () => {
    const s = run(
      fresh(),
      { type: 'setPaletteColor', key: 'a1', value: '#111111', now: T0 },
      { type: 'setPaletteColor', key: 'a2', value: '#222222', now: T0 + 100 },
    );
    expect(s.past).toHaveLength(2);
  });

  it('aplicar una paleta reemplaza los seis colores sin compartir la referencia, y se deshace', () => {
    const preset = { bg: '#000001', a1: '#000002', a2: '#000003', a3: '#000004', ink: '#000005', paper: '#000006' };
    const s = run(fresh(), { type: 'applyPalette', palette: preset });
    expect(palette(s)).toEqual(preset);
    expect(palette(s)).not.toBe(preset);
    expect(palette(run(s, { type: 'undo' })).bg).toBe('#11052C');
  });

  it('restaurar vuelve a la paleta del estilo base de la plantilla activa, no a la de otra', () => {
    const s = run(fresh(), { type: 'openTemplate', id: 'kraft' }, { type: 'setPaletteColor', key: 'bg', value: '#FFFFFF', now: T0 });
    const restored = run(s, { type: 'restorePalette' });
    expect(palette(restored)).toEqual(BASE_TEMPLATES.find((t) => t.id === 'kraft')!.palette);
    expect(isDirty(restored)).toBe(false);
    // las demás plantillas no se tocan
    expect(restored.workspace.templates.find((t) => t.id === 'neon')).toBe(s.workspace.templates.find((t) => t.id === 'neon'));
  });

  it('cambiar el par tipográfico cambia títulos y cuerpo; el mismo par no hace nada', () => {
    const s = run(fresh(), { type: 'setFonts', fonts: { title: 'bungee', body: 'poppins' } });
    expect(activeTemplate(s).fonts).toEqual({ title: 'bungee', body: 'poppins' });
    expect(s.past).toHaveLength(1);
    expect(run(s, { type: 'setFonts', fonts: { title: 'bungee', body: 'poppins' } })).toBe(s);
    expect(activeTemplate(run(s, { type: 'undo' })).fonts).toEqual({ title: 'fredoka', body: 'poppins' });
  });

  it('los elementos con fuente específica no cambian al cambiar el par', () => {
    const s = run(fresh(), { type: 'addElement', el: { ...draftText({ font: 'grotesk' }), id: 'g' } as PageElement }, { type: 'setFonts', fonts: { title: 'serif', body: 'zen' } });
    expect((byId(s, 'g') as TextEl).font).toBe('grotesk');
  });
});

describe('gestión de plantillas', () => {
  const names = (s: EditorState) => s.workspace.templates.map((t) => t.name);

  it('crear desde un estilo base agrega "Nueva · <estilo>", la abre en el editor y no la hace predeterminada', () => {
    const s = run(
      fresh(),
      { type: 'selectPage', page: 'productos' },
      { type: 'setPreview', on: true },
      { type: 'setView', view: 'plantillas' },
      { type: 'createTemplate', base: 'kawaii', id: 'tnueva' },
    );
    expect(names(s).at(-1)).toBe('Nueva · Kawaii pastel');
    expect(s.activeId).toBe('tnueva');
    expect(s.view).toBe('editor');
    expect(s.page).toBe('portada');
    expect(s.preview).toBe(false);
    expect(s.workspace.defaultId).toBe('neon');
    expect(activeTemplate(s).base).toBe('kawaii');
    expect(isDirty(s)).toBe(true);
  });

  it('crear parte de la plantilla de fábrica, no de una copia editada', () => {
    const s = run(fresh(), { type: 'setPaletteColor', key: 'bg', value: '#FFFFFF', now: T0 }, { type: 'createTemplate', base: 'neon', id: 'tn' });
    expect(activeTemplate(s).palette.bg).toBe('#11052C');
  });

  it('crear, duplicar y eliminar reinician el historial', () => {
    const edited = withText();
    expect(edited.past.length).toBeGreaterThan(0);
    expect(run(edited, { type: 'createTemplate', base: 'pop', id: 'a' }).past).toEqual([]);
    expect(run(edited, { type: 'duplicateTemplate', id: 'pop', newId: 'b' }).past).toEqual([]);
    expect(run(edited, { type: 'deleteTemplate', id: 'kraft' }).past).toEqual([]);
    expect(run(edited, { type: 'createTemplate', base: 'pop', id: 'a' }).future).toEqual([]);
  });

  it('duplicar crea "<nombre> (copia)", independiente, sin abrirla ni cambiar la predeterminada', () => {
    const s = run(fresh(), { type: 'duplicateTemplate', id: 'neon', newId: 'tcopia' });
    expect(names(s).at(-1)).toBe('Neón Noche (copia)');
    expect(s.activeId).toBe('neon');
    expect(s.workspace.defaultId).toBe('neon');
    const copy = s.workspace.templates.find((t) => t.id === 'tcopia')!;
    const original = s.workspace.templates.find((t) => t.id === 'neon')!;
    expect(copy.pages).toEqual(original.pages);
    expect(copy.pages).not.toBe(original.pages);
    expect(copy.palette).not.toBe(original.palette);
  });

  it('duplicar copia también lo que aún no se guardó', () => {
    const s = run(fresh(), { type: 'rename', name: 'Navidad', now: T0 }, { type: 'duplicateTemplate', id: 'neon', newId: 'tc' });
    expect(names(s).at(-1)).toBe('Navidad (copia)');
  });

  it('el nombre de la copia nunca pasa de 60 caracteres', () => {
    const s = run(fresh(), { type: 'rename', name: 'N'.repeat(60), now: T0 }, { type: 'duplicateTemplate', id: 'neon', newId: 'tc' });
    const copy = names(s).at(-1)!;
    expect(copy).toHaveLength(60);
    expect(copy.endsWith(' (copia)')).toBe(true);
  });

  it('renombrar recorta a 60 caracteres', () => {
    expect(activeTemplate(run(fresh(), { type: 'rename', name: 'x'.repeat(100), now: T0 })).name).toHaveLength(60);
  });

  it('no se crean ni duplican plantillas por encima del límite de 30', () => {
    let s = fresh();
    for (let i = s.workspace.templates.length; i < 30; i++) s = run(s, { type: 'duplicateTemplate', id: 'neon', newId: `t${i}` });
    expect(s.workspace.templates).toHaveLength(30);
    const full = run(s, { type: 'createTemplate', base: 'pop', id: 'extra' });
    expect(full.workspace.templates).toHaveLength(30);
    expect(full.message?.text).toMatch(/máximo de 30/);
    expect(run(s, { type: 'duplicateTemplate', id: 'neon', newId: 'otra' }).workspace.templates).toHaveLength(30);
  });

  it('eliminar quita la plantilla; la predeterminada no se elimina', () => {
    const s = run(fresh(), { type: 'deleteTemplate', id: 'kraft' });
    expect(s.workspace.templates.map((t) => t.id)).toEqual(['neon', 'pop', 'kawaii', 'base']);
    const blocked = run(fresh(), { type: 'deleteTemplate', id: 'neon' });
    expect(blocked.workspace.templates).toHaveLength(5);
    expect(blocked.message?.text).toMatch(/predeterminada/i);
  });

  it('nunca queda sin plantillas', () => {
    let s = fresh();
    for (const id of ['pop', 'kawaii', 'kraft', 'base']) s = run(s, { type: 'deleteTemplate', id });
    expect(s.workspace.templates.map((t) => t.id)).toEqual(['neon']);
    expect(run(s, { type: 'deleteTemplate', id: 'neon' }).workspace.templates).toHaveLength(1);
  });

  it('una predeterminada nueva sí permite eliminar la anterior', () => {
    const s = run(fresh(), { type: 'setDefault', id: 'pop' }, { type: 'deleteTemplate', id: 'neon' });
    expect(s.workspace.templates.map((t) => t.id)).toEqual(['pop', 'kawaii', 'kraft', 'base']);
  });

  it('eliminar la que se edita abre la predeterminada y lo avisa; eliminar otra no cambia la abierta', () => {
    const open = run(fresh(), { type: 'openTemplate', id: 'pop' });
    const deleted = run(open, { type: 'deleteTemplate', id: 'pop' });
    expect(deleted.activeId).toBe('neon');
    expect(deleted.message?.text).toMatch(/Pop crema/);
    expect(deleted.message?.text).toMatch(/Neón Noche/);
    expect(run(open, { type: 'deleteTemplate', id: 'kraft' }).activeId).toBe('pop');
  });

  it('marcar una predeterminada avisa con su nombre', () => {
    expect(run(fresh(), { type: 'setDefault', id: 'pop' }).message?.text).toBe('Pop crema se usará al generar.');
  });

  it('un id desconocido no cambia nada', () => {
    const s = fresh();
    expect(run(s, { type: 'deleteTemplate', id: 'nope' })).toBe(s);
    expect(run(s, { type: 'duplicateTemplate', id: 'nope', newId: 'x' })).toBe(s);
  });
});

describe('nombre y avisos', () => {
  it('renombrar cambia el nombre, cuenta como cambio y se deshace', () => {
    const s = run(fresh(), { type: 'rename', name: 'Navidad', now: T0 });
    expect(activeTemplate(s).name).toBe('Navidad');
    expect(isDirty(s)).toBe(true);
    const undone = run(s, { type: 'undo' });
    expect(activeTemplate(undone).name).toBe('Neón Noche');
    expect(isDirty(undone)).toBe(false);
  });

  it('escribir el nombre seguido es un solo paso del historial', () => {
    const s = run(
      fresh(),
      { type: 'rename', name: 'N', now: T0 },
      { type: 'rename', name: 'Na', now: T0 + 100 },
      { type: 'rename', name: 'Nav', now: T0 + 200 },
    );
    expect(s.past).toHaveLength(1);
  });

  it('un aviso reemplaza al anterior aunque el texto se repita (cambia `seq`)', () => {
    const a = run(fresh(), { type: 'say', text: 'Hola' });
    const b = run(a, { type: 'say', text: 'Hola' });
    expect(b.message?.text).toBe('Hola');
    expect(b.message?.seq).not.toBe(a.message?.seq);
    expect(run(b, { type: 'dismissMessage' }).message).toBeNull();
  });
});

describe('interfaz', () => {
  it('cambiar de página anula la selección y sale de la vista previa', () => {
    const s = run(withText(), { type: 'setPreview', on: true }, { type: 'selectPage', page: 'productos' });
    expect(s.page).toBe('productos');
    expect(s.selId).toBeNull();
    expect(s.preview).toBe(false);
  });

  it('seleccionar y anular la selección', () => {
    const s = run(withText(), { type: 'select', id: null });
    expect(s.selId).toBeNull();
    expect(run(s, { type: 'select', id: 'mio' }).selId).toBe('mio');
  });

  it('el zoom se limita a 20 %–200 %; null ajusta', () => {
    expect(run(fresh(), { type: 'setZoom', zoom: 5 }).zoom).toBe(2);
    expect(run(fresh(), { type: 'setZoom', zoom: 0.01 }).zoom).toBe(0.2);
    expect(run(fresh(), { type: 'setZoom', zoom: 1.2 }, { type: 'setZoom', zoom: null }).zoom).toBeNull();
  });

  it('el mensaje se puede descartar', () => {
    const s0 = run(fresh(), { type: 'selectPage', page: 'productos' });
    const blocked = run(s0, { type: 'delete', id: els(s0).find((e) => e.type === 'products')!.id });
    expect(blocked.message).not.toBeNull();
    expect(run(blocked, { type: 'dismissMessage' }).message).toBeNull();
  });
});

describe('bloque de productos: tamaño de la zona y de la foto (feature 007)', () => {
  const ZONE_MESSAGE = 'La zona de productos debe medir al menos 40 % de ancho y 30 % de alto.';
  /** Neón Noche abierta en Productos; su bloque es de distribución `alternado`. */
  const inProducts = () => run(fresh(), { type: 'selectPage', page: 'productos' });
  const block = (s: EditorState) => els(s).find((e) => e.type === 'products') as ProductsEl;
  const patch = (s: EditorState, p: Partial<ProductsEl>, over: { record?: false; now?: number } = {}) =>
    run(s, { type: 'patch', id: block(s).id, patch: p, now: over.now ?? T0, ...(over.record === false ? { record: false } : {}) });
  /** Máximo de la foto en la zona y la distribución actuales del bloque. */
  const maxOf = (s: EditorState) => {
    const b = block(s);
    return photoScaleLimits(b.layout, (b.w / 100) * PAGE_W, (b.h / 100) * PAGE_H, { nameStyle: b.nameStyle });
  };

  describe('zona mínima', () => {
    it('un ancho o un alto por debajo del mínimo queda en el mínimo y el editor avisa', () => {
      const s = patch(inProducts(), { w: 20 });
      expect(block(s).w).toBe(40);
      expect(s.message?.text).toBe(ZONE_MESSAGE);
      const t = patch(inProducts(), { h: 10 });
      expect(block(t).h).toBe(30);
      expect(t.message?.text).toBe(ZONE_MESSAGE);
    });

    it('el mínimo exacto no avisa', () => {
      const s = patch(inProducts(), { w: 40, h: 30 });
      expect(block(s)).toMatchObject({ w: 40, h: 30 });
      expect(s.message).toBeNull();
    });

    it('vale igual cuando el cambio viene del arrastre de la esquina (parche sin historial)', () => {
      const s = run(inProducts(), { type: 'checkpoint', now: T0 });
      const t = patch(s, { w: 12, h: 9 }, { record: false });
      expect(block(t)).toMatchObject({ w: 40, h: 30 });
      expect(t.message?.text).toBe(ZONE_MESSAGE);
      expect(t.past).toEqual(s.past);
    });

    it('los demás elementos conservan su mínimo de siempre (un texto puede medir 3 %)', () => {
      const s = run(withText(), { type: 'patch', id: 'mio', patch: { w: 3, h: 0.3 }, now: T0 });
      expect(byId(s, 'mio')).toMatchObject({ w: 3, h: 0.3 });
      expect(s.message).toBeNull();
    });

    it('repetir el mismo aviso no crea un mensaje nuevo cada vez (el arrastre manda muchos parches)', () => {
      const first = patch(inProducts(), { w: 10 }, { record: false });
      const again = patch(first, { w: 11 }, { record: false });
      expect(again.message).toBe(first.message);
    });
  });

  describe('escala de la foto', () => {
    it('un ancho de foto sobre el máximo de la zona queda en el máximo, con su aviso', () => {
      const tarjetas = patch(inProducts(), { layout: 'tarjetas' });
      const max = maxOf(tarjetas).w[1];
      expect(max).toBeLessThan(150);
      const s = patch(tarjetas, { photoW: 150 });
      expect(block(s).photoW).toBe(max);
      expect(s.message?.text).toBe(`El ancho máximo de la foto en esta zona es ${max} %. Agranda la zona para darle más espacio.`);
    });

    it('un alto de foto sobre el máximo de la zona queda en el máximo, con su aviso', () => {
      const s0 = inProducts();
      const max = maxOf(s0).h[1];
      expect(max).toBeLessThan(150);
      const s = patch(s0, { photoH: 150 });
      expect(block(s).photoH).toBe(max);
      expect(s.message?.text).toBe(`El alto máximo de la foto en esta zona es ${max} %. Agranda el alto de la zona para darle más espacio.`);
    });

    it('un valor dentro de los límites se guarda tal cual y no avisa', () => {
      const s = patch(inProducts(), { photoW: 80, photoH: 90 });
      expect(block(s)).toMatchObject({ photoW: 80, photoH: 90 });
      expect(s.message).toBeNull();
    });

    it('por debajo de 50 queda en 50 sin aviso (el rango ya lo dice)', () => {
      const s = patch(inProducts(), { photoW: 10, photoH: 0 });
      expect(block(s)).toMatchObject({ photoW: 50, photoH: 50 });
      expect(s.message).toBeNull();
    });

    it('el máximo se calcula con la zona del mismo parche (primero se recorta la zona)', () => {
      const s = patch(inProducts(), { w: 20, photoW: 100 });
      expect(block(s)).toMatchObject({ w: 40, photoW: 100 });
    });

    it('cambiar la zona o la distribución no reescribe un photoW guardado: solo se dibuja recortado', () => {
      let s = patch(inProducts(), { photoW: 140, photoH: 106 });
      expect(block(s)).toMatchObject({ photoW: 140, photoH: 106 });
      // `tarjetas` admite un ancho de foto de ~107 %: lo guardado sigue siendo 140
      s = patch(s, { layout: 'tarjetas', h: 35 }, { now: T0 + 5000 });
      expect(block(s)).toMatchObject({ layout: 'tarjetas', h: 35, photoW: 140, photoH: 106 });
      expect(s.message).toBeNull();
    });

    it('otros elementos no reciben estos avisos', () => {
      const s = run(withText(), { type: 'patch', id: 'mio', patch: { w: 50 }, now: T0 });
      expect(s.message).toBeNull();
    });
  });

  describe('restaurar tamaños originales', () => {
    it('pone la foto en 100 % y la zona en la de fábrica de la plantilla de la que partió, en un solo paso', () => {
      let s = inProducts();
      s = patch(s, { w: 60, h: 50, photoW: 70, photoH: 60 }, { now: T0 });
      s = patch(s, { x: 7 }, { now: T0 + 5000 });
      const factory = baseTemplate('neon').pages.productos.els.find((e) => e.type === 'products') as ProductsEl;
      const after = run(s, { type: 'restoreProductSizes', id: block(s).id });
      expect(block(after)).toMatchObject({ w: factory.w, h: factory.h, photoW: 100, photoH: 100 });
      // la posición y el estilo no se tocan
      expect(block(after).x).toBe(7);
      expect(after.past).toHaveLength(s.past.length + 1);
      const undone = run(after, { type: 'undo' });
      expect(block(undone)).toMatchObject({ w: 60, h: 50, photoW: 70, photoH: 60 });
      expect(run(undone, { type: 'redo' }).workspace).toEqual(after.workspace);
    });

    it('usa el estilo base de la plantilla (`base`), no su id', () => {
      const s0 = run(fresh(), { type: 'createTemplate', base: 'kraft', id: 'mia' }, { type: 'selectPage', page: 'productos' });
      const s = patch(s0, { w: 60, h: 45 });
      const after = run(s, { type: 'restoreProductSizes', id: block(s).id });
      const factory = baseTemplate('kraft').pages.productos.els.find((e) => e.type === 'products') as ProductsEl;
      expect(block(after)).toMatchObject({ w: factory.w, h: factory.h });
    });

    it('con un elemento que no es el bloque de productos no hace nada', () => {
      const s = withText();
      expect(run(s, { type: 'restoreProductSizes', id: 'mio' })).toBe(s);
      expect(run(s, { type: 'restoreProductSizes', id: 'no-existe' })).toBe(s);
    });
  });
});

describe('alinear a la página (feature 007)', () => {
  const box = { x: 10, y: 20, w: 30, h: 40 };
  const align = (id: string, edge: Parameters<typeof alignBox>[1], now = T0): EditorAction => ({ type: 'align', id, edge, now });

  it.each([
    ['left', { x: 0 }],
    ['hcenter', { x: 35 }],
    ['right', { x: 70 }],
    ['top', { y: 0 }],
    ['vcenter', { y: 30 }],
    ['bottom', { y: 60 }],
  ] as const)('alignBox %s', (edge, expected) => {
    expect(alignBox(box, edge)).toEqual(expected);
  });

  it('un elemento más ancho que la hoja va al borde sin cambiar de tamaño', () => {
    expect(alignBox({ x: 5, y: 0, w: 120, h: 10 }, 'left')).toEqual({ x: 0 });
    expect(alignBox({ x: 5, y: 0, w: 120, h: 10 }, 'hcenter')).toEqual({ x: -10 });
  });

  it('respeta los rangos de posición del editor', () => {
    expect(alignBox({ x: 0, y: 0, w: 500, h: 500 }, 'right')).toEqual({ x: -300 });
    expect(alignBox({ x: 0, y: 0, w: 3, h: 0.3 }, 'bottom')).toEqual({ y: 99.7 });
  });

  it('redondea a una décima, como el resto de posiciones', () => {
    expect(alignBox({ x: 0, y: 0, w: 33.33, h: 10 }, 'hcenter')).toEqual({ x: 33.3 });
  });

  it('solo cambia el eje de la acción y agrega un paso', () => {
    const s = withText();
    const left = run(s, align('mio', 'left'));
    expect(byId(left, 'mio')).toMatchObject({ x: 0, y: 20, w: 40, h: 10 });
    const bottom = run(s, align('mio', 'bottom'));
    expect(byId(bottom, 'mio')).toMatchObject({ x: 10, y: 90, w: 40, h: 10 });
    expect(left.past).toHaveLength(s.past.length + 1);
  });

  it('un elemento bloqueado, inexistente o ya alineado devuelve el mismo estado, sin paso nuevo', () => {
    const s = withText();
    const locked = run(s, { type: 'toggleLock', id: 'mio' });
    expect(run(locked, align('mio', 'left'))).toBe(locked);
    expect(run(s, align('nada', 'left'))).toBe(s);
    const once = run(s, align('mio', 'left'));
    expect(run(once, align('mio', 'left', T0 + 10))).toBe(once);
  });

  it('dos alineaciones seguidas son dos pasos y se deshacen y rehacen', () => {
    const s = withText();
    const two = run(s, align('mio', 'left'), align('mio', 'top', T0 + 10));
    expect(two.past).toHaveLength(s.past.length + 2);
    const back = run(two, { type: 'undo' });
    expect(byId(back, 'mio')).toMatchObject({ x: 0, y: 20 });
    const start = run(back, { type: 'undo' });
    expect(byId(start, 'mio')).toMatchObject({ x: 10, y: 20 });
    expect(byId(run(start, { type: 'redo' }, { type: 'redo' }), 'mio')).toMatchObject({ x: 0, y: 0 });
  });

  it('alinea un bloque automático una vez desbloqueado', () => {
    const s = run(fresh(), { type: 'selectPage', page: 'productos' });
    const products = els(s).find((e) => e.type === 'products')!;
    expect(run(s, align(products.id, 'left'))).toBe(s);
    const free = run(s, { type: 'toggleLock', id: products.id }, align(products.id, 'left'));
    expect(byId(free, products.id)!.x).toBe(0);
  });
});

describe('ajustes avanzados de texto (feature 008)', () => {
  const patch = (s: EditorState, p: Partial<TextEl>, now = T0, key?: string): EditorState =>
    run(s, { type: 'patch', id: 'mio', patch: p, now, ...(key ? { key } : {}) });
  const mio = (s: EditorState) => byId(s, 'mio') as TextEl;

  it.each([
    [9, 2.5],
    [0.1, 0.5],
    [1.375, 1.38],
    [1.37, 1.37],
  ])('la altura de línea %s se guarda como %s', (typed, saved) => {
    expect(mio(patch(withText(), { lh: typed })).lh).toBe(saved);
  });

  it.each([
    [99, 60],
    [-99, -10],
    [12.34, 12.3],
    [-10, -10],
  ])('el espaciado %s se guarda como %s', (typed, saved) => {
    expect(mio(patch(withText(), { ls: typed })).ls).toBe(saved);
  });

  it('un parche que no cambia el valor no agrega paso ni vacía el rehacer', () => {
    const s0 = patch(patch(withText(), { lh: 1.5 }), { lh: 2 }, T0 + 5_000);
    const undone = run(s0, { type: 'undo' });
    expect(undone.future).toHaveLength(1);
    const same = patch(undone, { lh: 1.5 }, T0 + 9_000);
    expect(same).toBe(undone);
    expect(same.future).toHaveLength(1);
  });

  it('escribir un valor fuera de rango que ya está en el límite tampoco agrega paso', () => {
    const s0 = patch(withText(), { lh: 2.5 });
    expect(patch(s0, { lh: 9 }, T0 + 5_000)).toBe(s0);
  });

  it('el valor por defecto de un opcional ausente cuenta como «sin cambio» (lh 1,05, anclaje centro)', () => {
    const s = withText();
    expect(mio(s).lh).toBeUndefined();
    expect(patch(s, { lh: 1.05 })).toBe(s);
    expect(patch(s, { vAlign: 'middle' })).toBe(s);
    expect(mio(patch(s, { vAlign: 'bottom' })).vAlign).toBe('bottom');
  });

  it('un arrastre continuo (misma clave) es un solo paso de deshacer', () => {
    let s = withText();
    const before = s.past.length;
    for (const [i, v] of [0.6, 0.9, 1.4, 2].entries()) s = patch(s, { lh: v }, T0 + i * 100, 'lh');
    expect(mio(s).lh).toBe(2);
    expect(s.past.length).toBe(before + 1);
    expect(mio(run(s, { type: 'undo' })).lh).toBeUndefined();
  });

  it('un elemento que no es texto no se recorta ni se descarta', () => {
    const s = run(fresh(), { type: 'selectPage', page: 'portada' });
    const shape = els(s).find((e) => e.type === 'shape' || e.type === 'image')!;
    const next = run(s, { type: 'patch', id: shape.id, patch: { x: shape.x }, now: T0 });
    expect(next.past.length).toBe(s.past.length + 1);
  });
});
