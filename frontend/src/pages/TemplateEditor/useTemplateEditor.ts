import { useCallback, useMemo, useReducer } from 'react';
import {
  ELEMENT_LABELS,
  LIMITS,
  RANGES,
  isAutoBlock,
  type BaseId,
  type FontKey,
  type Page,
  type PageBg,
  type PageElement,
  type PageKey,
  type Palette,
  type PaletteKey,
  type Template,
} from '../../../../backend/src/catalog/template';
import { baseTemplate } from '../../../../backend/src/catalog/template-presets';
import { isHexColor } from '../../../../backend/src/catalog/theme';
import type { BusinessSettings } from '../../../../backend/src/catalog/types';

/** Pasos que se pueden deshacer (FR-010). */
export const HISTORY_LIMIT = 60;
/** Una acción continua con la misma clave en esta ventana cuenta como un solo paso. */
export const MERGE_WINDOW_MS = 800;

export type EditorTab = 'plantillas' | 'elementos' | 'estilo' | 'datos';
export type EditorView = 'editor' | 'plantillas';

/** Lo que se edita y se guarda: todas las plantillas, la predeterminada y los datos del negocio. */
export interface EditorWorkspace {
  templates: Template[];
  defaultId: string;
  business: BusinessSettings;
}

/**
 * Un paso del historial: la plantilla activa más la predeterminada y los datos (no todo el conjunto, que puede
 * tener 30 plantillas). Como las actualizaciones son inmutables, guardar referencias basta: no hace falta clonar.
 */
interface Snapshot {
  template: Template;
  defaultId: string;
  business: BusinessSettings;
}

export interface EditorMessage {
  text: string;
  /** Cambia con cada mensaje, para que repetir el mismo texto vuelva a mostrarse. */
  seq: number;
}

export interface EditorState {
  workspace: EditorWorkspace;
  /** Lo último guardado o cargado: `dirty` compara contra esto. */
  saved: EditorWorkspace;
  /** Revisión que recibió la pestaña; se envía al guardar (409 si otra pestaña guardó). */
  revision: number;
  activeId: string;
  page: PageKey;
  selId: string | null;
  tab: EditorTab;
  view: EditorView;
  preview: boolean;
  /** `null` = ajustar al espacio disponible. */
  zoom: number | null;
  past: Snapshot[];
  future: Snapshot[];
  mergeKey: string | null;
  mergeAt: number;
  message: EditorMessage | null;
}

export type EditorAction =
  | { type: 'selectPage'; page: PageKey }
  | { type: 'select'; id: string | null }
  | { type: 'setTab'; tab: EditorTab }
  | { type: 'setView'; view: EditorView }
  | { type: 'setPreview'; on: boolean }
  | { type: 'setZoom'; zoom: number | null }
  | { type: 'openTemplate'; id: string }
  | { type: 'checkpoint'; now: number }
  | { type: 'addElement'; el: PageElement }
  | {
      type: 'patch';
      id: string;
      patch: Partial<PageElement>;
      /** Clave de fusión (`id:propiedad`): las acciones seguidas con la misma clave son un solo paso. */
      key?: string;
      /** `false` en los parches de un gesto que ya hizo su `checkpoint`. */
      record?: boolean;
      now: number;
    }
  | { type: 'patchBg'; patch: Partial<PageBg>; now: number }
  | { type: 'delete'; id: string }
  | { type: 'duplicate'; id: string; newId: string; now: number }
  | { type: 'reorder'; id: string; dir: 1 | -1 }
  | { type: 'toggleLock'; id: string }
  | { type: 'toggleVisible'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }
  /** `sent` es lo que se envió al servidor: si el usuario siguió editando mientras tanto, esas ediciones se conservan. */
  | { type: 'saved'; workspace: EditorWorkspace; revision: number; sent?: EditorWorkspace }
  | { type: 'setDefault'; id: string }
  | { type: 'patchBusiness'; patch: Partial<BusinessSettings>; key?: string; now: number }
  | { type: 'rename'; name: string; now: number }
  /** Una plantilla nueva desde un estilo base ("Nueva · <estilo>"); se abre en el editor. Reinicia el historial. */
  | { type: 'createTemplate'; base: BaseId; id: string }
  /** Copia independiente ("<nombre> (copia)"); no cambia la plantilla abierta. Reinicia el historial. */
  | { type: 'duplicateTemplate'; id: string; newId: string }
  /** No la predeterminada ni la última. Reinicia el historial. */
  | { type: 'deleteTemplate'; id: string }
  /** Un color de la paleta; un valor que no es `#RRGGBB` se ignora. Los cambios seguidos del mismo color son un paso. */
  | { type: 'setPaletteColor'; key: PaletteKey; value: string; now: number }
  | { type: 'applyPalette'; palette: Palette }
  /** Vuelve a la paleta de fábrica del estilo base de la plantilla. */
  | { type: 'restorePalette' }
  | { type: 'setFonts'; fonts: { title: FontKey; body: FontKey } }
  | { type: 'say'; text: string }
  | { type: 'dismissMessage' };

export function createEditorState(workspace: EditorWorkspace, revision: number): EditorState {
  const activeId = workspace.templates.some((t) => t.id === workspace.defaultId)
    ? workspace.defaultId
    : (workspace.templates[0]?.id ?? '');
  return {
    workspace,
    saved: workspace,
    revision,
    activeId,
    page: 'portada',
    selId: null,
    tab: 'plantillas',
    view: 'editor',
    preview: false,
    zoom: null,
    past: [],
    future: [],
    mergeKey: null,
    mergeAt: 0,
    message: null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------------------------------------------

export function activeTemplate(s: EditorState): Template {
  return s.workspace.templates.find((t) => t.id === s.activeId) ?? s.workspace.templates[0]!;
}

export const currentPage = (s: EditorState): Page => activeTemplate(s).pages[s.page];

export function selectedElement(s: EditorState): PageElement | undefined {
  return s.selId ? currentPage(s).els.find((e) => e.id === s.selId) : undefined;
}

/**
 * ¿Hay cambios sin guardar? Compara por referencia las plantillas no tocadas (las actualizaciones son inmutables) y
 * por contenido solo las que cambiaron, para no serializar todo el conjunto en cada render.
 */
export function isDirty(s: EditorState): boolean {
  const a = s.workspace;
  const b = s.saved;
  if (a === b) return false;
  if (a.defaultId !== b.defaultId) return true;
  if (a.business !== b.business && JSON.stringify(a.business) !== JSON.stringify(b.business)) return true;
  if (a.templates.length !== b.templates.length) return true;
  return a.templates.some((t, i) => {
    const old = b.templates[i];
    return t !== old && (!old || JSON.stringify(t) !== JSON.stringify(old));
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Utilidades del reductor
// ---------------------------------------------------------------------------------------------------------------

const snapshot = (s: EditorState): Snapshot => ({
  template: activeTemplate(s),
  defaultId: s.workspace.defaultId,
  business: s.workspace.business,
});

function restore(s: EditorState, snap: Snapshot): EditorWorkspace {
  return {
    templates: s.workspace.templates.map((t) => (t.id === snap.template.id ? snap.template : t)),
    defaultId: snap.defaultId,
    business: snap.business,
  };
}

/** Registra un paso del historial, o lo fusiona con el anterior si es la misma acción continua. */
function record(s: EditorState, key: string | null, now: number): Pick<EditorState, 'past' | 'future' | 'mergeKey' | 'mergeAt'> {
  if (key && key === s.mergeKey && now - s.mergeAt < MERGE_WINDOW_MS) {
    return { past: s.past, future: s.future, mergeKey: key, mergeAt: now };
  }
  return { past: [...s.past.slice(-(HISTORY_LIMIT - 1)), snapshot(s)], future: [], mergeKey: key, mergeAt: now };
}

function withTemplate(s: EditorState, fn: (t: Template) => Template): EditorWorkspace {
  return {
    ...s.workspace,
    templates: s.workspace.templates.map((t) => (t.id === s.activeId ? fn(t) : t)),
  };
}

function withPage(s: EditorState, fn: (p: Page) => Page): EditorWorkspace {
  return withTemplate(s, (t) => ({ ...t, pages: { ...t.pages, [s.page]: fn(t.pages[s.page]) } }));
}

const labelOf = (el: PageElement) => el.name || ELEMENT_LABELS[el.type];
let messageSeq = 0;
const say = (s: EditorState, text: string): EditorState => ({ ...s, message: { text, seq: ++messageSeq } });

/** Los bloques automáticos no se giran ni se ocultan. */
function sanitize(el: PageElement, patch: Partial<PageElement>): Partial<PageElement> {
  if (!isAutoBlock(el)) return patch;
  const { rot: _rot, visible: _visible, ...rest } = patch;
  return rest;
}

const RESET_HISTORY: Pick<EditorState, 'past' | 'future' | 'mergeKey' | 'mergeAt'> = { past: [], future: [], mergeKey: null, mergeAt: 0 };
const TEMPLATE_LIMIT_MESSAGE = `Se alcanzó el máximo de ${LIMITS.templates} plantillas. Elimina alguna para crear otra.`;

const clampZoom = (z: number) => Math.round(Math.min(2, Math.max(0.2, z)) * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------------------------------------------
// Reductor
// ---------------------------------------------------------------------------------------------------------------

export function editorReducer(s: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'selectPage':
      return { ...s, page: action.page, selId: null, preview: false };
    case 'select':
      return { ...s, selId: action.id };
    case 'setTab':
      return { ...s, tab: action.tab };
    case 'setView':
      return { ...s, view: action.view };
    case 'setPreview':
      return { ...s, preview: action.on, selId: action.on ? null : s.selId };
    case 'setZoom':
      return { ...s, zoom: action.zoom === null ? null : clampZoom(action.zoom) };
    case 'dismissMessage':
      return { ...s, message: null };

    case 'openTemplate':
      if (!s.workspace.templates.some((t) => t.id === action.id)) return s;
      // Cambiar de plantilla reinicia el historial; los cambios sin guardar de la anterior siguen en el conjunto
      return { ...s, activeId: action.id, view: 'editor', selId: null, preview: false, past: [], future: [], mergeKey: null };

    case 'checkpoint':
      return { ...s, ...record(s, null, action.now) };

    case 'addElement': {
      const els = currentPage(s).els;
      const footer = els.findIndex((e) => e.type === 'footer');
      return {
        ...s,
        ...record(s, null, 0),
        workspace: withPage(s, (p) => ({
          ...p,
          els: footer >= 0 ? [...els.slice(0, footer), action.el, ...els.slice(footer)] : [...els, action.el],
        })),
        selId: action.el.id,
        preview: false,
      };
    }

    case 'patch': {
      const el = currentPage(s).els.find((e) => e.id === action.id);
      if (!el) return s;
      const patch = sanitize(el, action.patch);
      const history = action.record === false ? {} : record(s, action.key ?? null, action.now);
      return {
        ...s,
        ...history,
        workspace: withPage(s, (p) => ({
          ...p,
          els: p.els.map((e) => (e.id === action.id ? ({ ...e, ...patch } as PageElement) : e)),
        })),
      };
    }

    case 'patchBg':
      return {
        ...s,
        ...record(s, `bg:${s.page}:${Object.keys(action.patch).join(',')}`, action.now),
        workspace: withPage(s, (p) => ({ ...p, bg: { ...p.bg, ...action.patch } })),
      };

    case 'delete': {
      const el = currentPage(s).els.find((e) => e.id === action.id);
      if (!el) return s;
      if (isAutoBlock(el)) return say(s, 'Este bloque es obligatorio. Puedes moverlo o cambiar su estilo.');
      return {
        ...s,
        ...record(s, null, 0),
        workspace: withPage(s, (p) => ({ ...p, els: p.els.filter((e) => e.id !== action.id) })),
        selId: s.selId === action.id ? null : s.selId,
      };
    }

    case 'duplicate': {
      const el = currentPage(s).els.find((e) => e.id === action.id);
      if (!el) return s;
      if (isAutoBlock(el)) return say(s, 'Solo puede haber un bloque de este tipo por página.');
      const copy = {
        ...structuredClone(el),
        id: action.newId,
        x: round1(el.x + 3),
        y: round1(el.y + 2),
        name: `${labelOf(el)} copia`,
        locked: false,
      } as PageElement;
      return editorReducer(s, { type: 'addElement', el: copy });
    }

    case 'reorder': {
      const els = currentPage(s).els;
      const i = els.findIndex((e) => e.id === action.id);
      const j = Math.max(0, Math.min(els.length - 1, i + action.dir));
      if (i < 0 || i === j) return s;
      const next = [...els];
      const [moved] = next.splice(i, 1);
      next.splice(j, 0, moved!);
      return { ...s, ...record(s, null, 0), workspace: withPage(s, (p) => ({ ...p, els: next })) };
    }

    case 'toggleLock': {
      const el = currentPage(s).els.find((e) => e.id === action.id);
      if (!el) return s;
      return editorReducer(s, { type: 'patch', id: action.id, patch: { locked: !el.locked }, now: 0 });
    }

    case 'toggleVisible': {
      const el = currentPage(s).els.find((e) => e.id === action.id);
      if (!el) return s;
      if (isAutoBlock(el)) return say(s, 'Este bloque no se puede ocultar.');
      return editorReducer(s, { type: 'patch', id: action.id, patch: { visible: el.visible === false }, now: 0 });
    }

    case 'undo': {
      const prev = s.past.at(-1);
      if (!prev) return s;
      const workspace = restore(s, prev);
      return {
        ...s,
        workspace,
        past: s.past.slice(0, -1),
        future: [snapshot(s), ...s.future],
        mergeKey: null,
        selId: keepSelection(s, workspace),
      };
    }

    case 'redo': {
      const next = s.future[0];
      if (!next) return s;
      const workspace = restore(s, next);
      return {
        ...s,
        workspace,
        past: [...s.past, snapshot(s)],
        future: s.future.slice(1),
        mergeKey: null,
        selId: keepSelection(s, workspace),
      };
    }

    case 'saved': {
      // El servidor devuelve el conjunto normalizado: pasa a ser lo guardado y lo que se edita. El historial se conserva.
      // Si hubo ediciones durante el guardado, se conservan y siguen contando como cambios pendientes.
      const edited = action.sent !== undefined && action.sent !== s.workspace;
      return {
        ...s,
        workspace: edited ? s.workspace : action.workspace,
        saved: action.workspace,
        revision: action.revision,
        message: null,
      };
    }

    case 'setDefault': {
      const target = s.workspace.templates.find((t) => t.id === action.id);
      if (!target || action.id === s.workspace.defaultId) return s;
      return say(
        { ...s, ...record(s, null, 0), workspace: { ...s.workspace, defaultId: action.id } },
        `${target.name} se usará al generar.`,
      );
    }

    case 'patchBusiness':
      return {
        ...s,
        ...record(s, action.key ?? null, action.now),
        workspace: { ...s.workspace, business: { ...s.workspace.business, ...action.patch } },
      };

    case 'rename':
      return {
        ...s,
        ...record(s, `name:${s.activeId}`, action.now),
        workspace: withTemplate(s, (t) => ({ ...t, name: action.name.slice(0, LIMITS.nameMax) })),
      };

    case 'createTemplate': {
      if (s.workspace.templates.length >= LIMITS.templates) return say(s, TEMPLATE_LIMIT_MESSAGE);
      const base = baseTemplate(action.base);
      const created: Template = { ...base, id: action.id, name: `Nueva · ${base.name}`.slice(0, LIMITS.nameMax) };
      return {
        ...s,
        ...RESET_HISTORY,
        workspace: { ...s.workspace, templates: [...s.workspace.templates, created] },
        activeId: created.id,
        page: 'portada',
        selId: null,
        view: 'editor',
        preview: false,
      };
    }

    case 'duplicateTemplate': {
      const source = s.workspace.templates.find((t) => t.id === action.id);
      if (!source) return s;
      if (s.workspace.templates.length >= LIMITS.templates) return say(s, TEMPLATE_LIMIT_MESSAGE);
      const suffix = ' (copia)';
      const copy: Template = {
        ...structuredClone(source),
        id: action.newId,
        name: `${source.name.slice(0, LIMITS.nameMax - suffix.length)}${suffix}`,
      };
      return { ...s, ...RESET_HISTORY, workspace: { ...s.workspace, templates: [...s.workspace.templates, copy] } };
    }

    case 'deleteTemplate': {
      const target = s.workspace.templates.find((t) => t.id === action.id);
      if (!target) return s;
      if (action.id === s.workspace.defaultId) {
        return say(s, 'La plantilla predeterminada no se puede eliminar. Marca otra como predeterminada primero.');
      }
      if (s.workspace.templates.length <= 1) return say(s, 'Siempre debe quedar al menos una plantilla.');
      const templates = s.workspace.templates.filter((t) => t.id !== action.id);
      const next: EditorState = { ...s, ...RESET_HISTORY, workspace: { ...s.workspace, templates } };
      if (action.id !== s.activeId) return next;
      // Se eliminó la que estaba abierta: se abre la predeterminada y se avisa
      const fallback = templates.find((t) => t.id === s.workspace.defaultId) ?? templates[0]!;
      return say(
        { ...next, activeId: fallback.id, page: 'portada', selId: null, preview: false },
        `Se eliminó «${target.name}», que estabas editando. Ahora se abre «${fallback.name}».`,
      );
    }

    case 'setPaletteColor': {
      if (!isHexColor(action.value)) return s;
      const value = action.value.toUpperCase();
      if (activeTemplate(s).palette[action.key] === value) return s;
      return {
        ...s,
        ...record(s, `pal:${s.activeId}:${action.key}`, action.now),
        workspace: withTemplate(s, (t) => ({ ...t, palette: { ...t.palette, [action.key]: value } })),
      };
    }

    case 'applyPalette':
      return {
        ...s,
        ...record(s, null, 0),
        workspace: withTemplate(s, (t) => ({ ...t, palette: { ...action.palette } })),
      };

    case 'restorePalette': {
      const original = baseTemplate(activeTemplate(s).base).palette;
      return {
        ...s,
        ...record(s, null, 0),
        workspace: withTemplate(s, (t) => ({ ...t, palette: { ...original } })),
      };
    }

    case 'setFonts': {
      const { title, body } = activeTemplate(s).fonts;
      if (action.fonts.title === title && action.fonts.body === body) return s;
      return {
        ...s,
        ...record(s, null, 0),
        workspace: withTemplate(s, (t) => ({ ...t, fonts: { ...action.fonts } })),
      };
    }

    case 'say':
      return say(s, action.text);

    default:
      return s;
  }
}

/** Tras deshacer o rehacer, la selección solo se conserva si el elemento sigue existiendo en la página. */
function keepSelection(s: EditorState, workspace: EditorWorkspace): string | null {
  if (!s.selId) return null;
  const t = workspace.templates.find((x) => x.id === s.activeId);
  return t?.pages[s.page].els.some((e) => e.id === s.selId) ? s.selId : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------------------------------

/** Identificador de un elemento nuevo (único dentro de la página). */
export const newElementId = () => `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Identificador de una plantilla nueva: `t` + base 36, dentro del límite de 40 caracteres. */
export const newTemplateId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Clamps de posición y tamaño que comparten el arrastre y el inspector. */
export const clampBox = {
  x: (v: number) => Math.min(RANGES.x[1], Math.max(RANGES.x[0], v)),
  y: (v: number) => Math.min(RANGES.y[1], Math.max(RANGES.y[0], v)),
  w: (v: number) => Math.min(RANGES.w[1], Math.max(RANGES.w[0], v)),
  h: (v: number) => Math.min(RANGES.h[1], Math.max(RANGES.h[0], v)),
};

/** El estado del editor y sus acciones (cada una agrega la hora, para que el reductor siga siendo puro). */
export function useTemplateEditor(initial: { workspace: EditorWorkspace; revision: number }) {
  const [state, dispatch] = useReducer(editorReducer, initial, (i) => createEditorState(i.workspace, i.revision));

  const actions = useMemo(
    () => ({
      selectPage: (page: PageKey) => dispatch({ type: 'selectPage', page }),
      select: (id: string | null) => dispatch({ type: 'select', id }),
      setTab: (tab: EditorTab) => dispatch({ type: 'setTab', tab }),
      setView: (view: EditorView) => dispatch({ type: 'setView', view }),
      setPreview: (on: boolean) => dispatch({ type: 'setPreview', on }),
      setZoom: (zoom: number | null) => dispatch({ type: 'setZoom', zoom }),
      openTemplate: (id: string) => dispatch({ type: 'openTemplate', id }),
      checkpoint: () => dispatch({ type: 'checkpoint', now: Date.now() }),
      addElement: (el: PageElement) => dispatch({ type: 'addElement', el }),
      patch: (id: string, patch: Partial<PageElement>, key?: string) =>
        dispatch({ type: 'patch', id, patch, key, now: Date.now() }),
      /** Parche de un gesto que ya hizo `checkpoint`: no agrega pasos. */
      patchLive: (id: string, patch: Partial<PageElement>) =>
        dispatch({ type: 'patch', id, patch, record: false, now: Date.now() }),
      patchBg: (patch: Partial<PageBg>) => dispatch({ type: 'patchBg', patch, now: Date.now() }),
      remove: (id: string) => dispatch({ type: 'delete', id }),
      duplicate: (id: string) => dispatch({ type: 'duplicate', id, newId: newElementId(), now: Date.now() }),
      reorder: (id: string, dir: 1 | -1) => dispatch({ type: 'reorder', id, dir }),
      toggleLock: (id: string) => dispatch({ type: 'toggleLock', id }),
      toggleVisible: (id: string) => dispatch({ type: 'toggleVisible', id }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      saved: (workspace: EditorWorkspace, revision: number, sent?: EditorWorkspace) =>
        dispatch({ type: 'saved', workspace, revision, sent }),
      setDefault: (id: string) => dispatch({ type: 'setDefault', id }),
      patchBusiness: (patch: Partial<BusinessSettings>, key?: string) =>
        dispatch({ type: 'patchBusiness', patch, key, now: Date.now() }),
      rename: (name: string) => dispatch({ type: 'rename', name, now: Date.now() }),
      createTemplate: (base: BaseId) => dispatch({ type: 'createTemplate', base, id: newTemplateId() }),
      duplicateTemplate: (id: string) => dispatch({ type: 'duplicateTemplate', id, newId: newTemplateId() }),
      deleteTemplate: (id: string) => dispatch({ type: 'deleteTemplate', id }),
      setPaletteColor: (key: PaletteKey, value: string) =>
        dispatch({ type: 'setPaletteColor', key, value, now: Date.now() }),
      applyPalette: (palette: Palette) => dispatch({ type: 'applyPalette', palette }),
      restorePalette: () => dispatch({ type: 'restorePalette' }),
      setFonts: (fonts: { title: FontKey; body: FontKey }) => dispatch({ type: 'setFonts', fonts }),
      say: (text: string) => dispatch({ type: 'say', text }),
      dismissMessage: () => dispatch({ type: 'dismissMessage' }),
    }),
    [],
  );

  const dirty = useMemo(() => isDirty(state), [state]);
  const reset = useCallback((workspace: EditorWorkspace, revision: number) => dispatch({ type: 'saved', workspace, revision }), []);
  return { state, dispatch, actions, dirty, reset };
}

export type EditorActions = ReturnType<typeof useTemplateEditor>['actions'];
