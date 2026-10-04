import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { businessIssues } from '../../../../backend/src/catalog/business-limits';
import {
  PAGE_H,
  PAGE_W,
  type TemplateWarning,
  type WorkspaceState,
} from '../../../../backend/src/catalog/template';
import { confirmLeave, useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { api, ApiError } from '../../services/api';
import Canvas from './Canvas';
import Gallery from './Gallery';
import Inspector from './Inspector';
import PageStrip from './PageStrip';
import PreviewPages from './PreviewPages';
import SideRail from './SideRail';
import TopBar from './TopBar';
import ZoomControls from './ZoomControls';
import { pageData } from './sample-data';
import {
  activeTemplate,
  clampBox,
  selectedElement,
  useTemplateEditor,
  type EditorWorkspace,
} from './useTemplateEditor';
import './editor.css';

interface Loaded {
  workspace: EditorWorkspace;
  revision: number;
}

interface Problem {
  message: string;
  details: { field: string; message: string }[];
  /** El conjunto cambió desde otra pestaña: se ofrece recargar lo guardado. */
  reload: boolean;
}

const SAVED_MESSAGE = 'Cambios guardados. Se usarán en el próximo catálogo.';
const RELOAD_CONFIRM =
  'Se descartarán tus cambios sin guardar y se cargará lo último guardado. ¿Continuar?';
const TOAST_MS = 4500;
/** Margen alrededor de la hoja en el área del lienzo, en px de pantalla. */
const AREA_PAD = 24;
const PREVIEW_GAP = 24;
/** Escala mínima de la vista previa: a menos, el texto de las páginas no se lee. */
const PREVIEW_MIN = 0.3;
const FIT_FALLBACK = 0.6;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

async function fetchWorkspace(): Promise<Loaded> {
  const res = await api.get<WorkspaceState>('/api/settings/templates');
  return {
    workspace: { templates: res.templates, defaultId: res.defaultId, business: res.business },
    revision: res.revision,
  };
}

const loadErrorText = (e: unknown) =>
  e instanceof ApiError ? e.message : 'No se pudo cargar el editor.';

/**
 * Editor de plantillas (`/apariencia`). Esta capa solo carga el conjunto guardado; `EditorScreen` lo edita. Recargar
 * (tras un `409`) vuelve a montar la pantalla con otra `key`, así el estado nace limpio sin lógica de reinicio.
 */
export default function TemplateEditor() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState('');

  const reload = useCallback(async (): Promise<string | null> => {
    try {
      setLoaded(await fetchWorkspace());
      setEpoch((n) => n + 1);
      setError('');
      return null;
    } catch (e) {
      return loadErrorText(e);
    }
  }, []);

  useEffect(() => {
    void reload().then((message) => message && setError(message));
  }, [reload]);

  if (error) {
    return (
      <div className="ed-state" role="alert">
        <p>{error}</p>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="ed-state">
        <p>Cargando…</p>
      </div>
    );
  }
  return <EditorScreen key={epoch} initial={loaded} onReload={reload} />;
}

const isField = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.isContentEditable);

function EditorScreen({
  initial,
  onReload,
}: {
  initial: Loaded;
  onReload: () => Promise<string | null>;
}) {
  const navigate = useNavigate();
  const { state, actions, dirty } = useTemplateEditor(initial);
  const template = activeTemplate(state);
  const el = selectedElement(state);
  const business = state.workspace.business;

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [warnings, setWarnings] = useState<TemplateWarning[]>([]);
  const [overflow, setOverflow] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useUnsavedGuard(dirty);

  // --- Tamaño del lienzo: la hoja se ajusta al espacio disponible --------------------------------------------------
  const area = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = area.current;
    if (!node) return undefined;
    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [state.view]); // el área se vuelve a crear al volver de la galería

  const measured = size.w > 2 * AREA_PAD && size.h > 2 * AREA_PAD;
  const fit = measured
    ? round2(
        clamp(Math.min((size.w - 2 * AREA_PAD) / PAGE_W, (size.h - 2 * AREA_PAD) / PAGE_H), 0.2, 2),
      )
    : FIT_FALLBACK;
  const scale = state.zoom ?? fit;
  // Las cuatro páginas lado a lado. En ventanas angostas no caben legibles: se deja un mínimo y el área se desplaza.
  const previewScale = measured
    ? round2(
        clamp(
          Math.min(
            (size.w - 2 * AREA_PAD - 3 * PREVIEW_GAP) / (4 * PAGE_W),
            (size.h - 2 * AREA_PAD - 32) / PAGE_H,
          ),
          PREVIEW_MIN,
          1,
        ),
      )
    : 0.4;

  // --- Datos que dibuja la página activa -----------------------------------------------------------------------------
  const data = useMemo(() => pageData(state.page, business), [state.page, business]);

  // --- Advertencia de bloque reducido: `useFit` marca `data-overflow` en el DOM ---------------------------------------
  useEffect(() => {
    const root = stage.current;
    const id = state.selId;
    if (!root || !id) {
      setOverflow(false);
      return undefined;
    }
    const check = () => {
      const node = Array.from(root.querySelectorAll<HTMLElement>('[data-el-id]')).find(
        (n) => n.getAttribute('data-el-id') === id,
      );
      setOverflow(
        !!node &&
          (node.matches('[data-overflow="true"]') ||
            !!node.querySelector('[data-overflow="true"]')),
      );
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-overflow'],
    });
    return () => observer.disconnect();
  }, [state.selId, state.page, state.activeId, state.preview, state.view]);

  // --- Aviso emergente -------------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!state.message) return undefined;
    const timer = setTimeout(actions.dismissMessage, TOAST_MS);
    return () => clearTimeout(timer);
  }, [state.message, actions]);

  // --- Atajos de teclado: un solo oyente, que ignora los campos de texto -------------------------------------------------
  const live = useRef({ state, actions });
  useEffect(() => {
    live.current = { state, actions };
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isField(e.target)) return;
      const { state: s, actions: a } = live.current;
      if (s.view !== 'editor') return; // en la galería no hay elementos que mover ni borrar
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) a.redo();
        else a.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        a.redo();
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault(); // el navegador lo usa para agregar a marcadores
        if (s.selId) a.duplicate(s.selId);
        return;
      }
      if (mod || e.altKey) return;

      const selected = selectedElement(s);
      if (key === 'escape') {
        a.select(null);
      } else if (key === 'delete' || key === 'backspace') {
        if (!selected) return;
        e.preventDefault();
        a.remove(selected.id);
      } else if (key.startsWith('arrow')) {
        if (!selected || selected.locked || s.preview) return;
        e.preventDefault();
        const step = e.shiftKey ? 2 : 0.5;
        const dx = key === 'arrowright' ? step : key === 'arrowleft' ? -step : 0;
        const dy = key === 'arrowdown' ? step : key === 'arrowup' ? -step : 0;
        a.patch(
          selected.id,
          {
            x: clampBox.x(Math.round((selected.x + dx) * 10) / 10),
            y: clampBox.y(Math.round((selected.y + dy) * 10) / 10),
          },
          `nudge:${selected.id}`,
        );
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- Guardar y recargar ----------------------------------------------------------------------------------------------
  // Una plantilla sin nombre no se guarda (el servidor la rechazaría): se evita desde aquí, con el aviso en la barra
  const blankName = state.workspace.templates.some((t) => t.name.trim() === '');
  // Lo mismo con los datos del negocio: los límites son los del servidor (`business-limits.ts`)
  const issues = useMemo(() => businessIssues(business), [business]);
  const canSave = dirty && !busy && !blankName && issues.length === 0;
  const saveHint = issues[0]?.message ?? (blankName ? 'Una plantilla no tiene nombre.' : undefined);

  async function save() {
    if (!canSave) return;
    const sent = state.workspace;
    setBusy(true);
    setProblem(null);
    try {
      const res = await api.put<WorkspaceState>('/api/settings/templates', {
        templates: sent.templates,
        defaultId: sent.defaultId,
        business: sent.business,
        expectedRevision: state.revision,
      });
      actions.saved(
        { templates: res.templates, defaultId: res.defaultId, business: res.business },
        res.revision,
        sent,
      );
      setWarnings(res.warnings ?? []);
      actions.say(SAVED_MESSAGE);
    } catch (e) {
      if (e instanceof ApiError) {
        const details = Array.isArray(e.details)
          ? (e.details as { field?: unknown; message?: unknown }[])
              .filter((d) => typeof d?.message === 'string')
              .map((d) => ({ field: String(d.field ?? ''), message: String(d.message) }))
          : [];
        setProblem({ message: e.message, details, reload: e.status === 409 });
      } else {
        setProblem({
          message: 'No se pudo guardar. Revisa la conexión e inténtalo de nuevo.',
          details: [],
          reload: false,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    if (dirty && !window.confirm(RELOAD_CONFIRM)) return;
    const failure = await onReload();
    if (failure) setProblem({ message: failure, details: [], reload: false });
  }

  function back() {
    if (confirmLeave()) navigate('/');
  }

  const current = state.zoom ?? fit;
  const deselect = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) actions.select(null);
  };

  return (
    <div className="ed-root" data-testid="template-editor">
      <TopBar
        view={state.view}
        onView={actions.setView}
        name={template.name}
        onName={actions.rename}
        isDefault={template.id === state.workspace.defaultId}
        onUseDefault={() => actions.setDefault(template.id)}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        onUndo={actions.undo}
        onRedo={actions.redo}
        dirty={dirty}
        canSave={canSave}
        saveHint={saveHint}
        busy={busy}
        preview={state.preview}
        onTogglePreview={() => actions.setPreview(!state.preview)}
        onSave={() => void save()}
        onBack={back}
      />

      {problem && (
        <div className="ed-alert" role="alert">
          <div>
            <strong>{problem.message}</strong>
            {problem.details.length > 0 && (
              <ul>
                {problem.details.map((d, i) => (
                  <li key={`${d.field}-${i}`}>
                    {d.message} {d.field && <code>{d.field}</code>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="ed-alert-actions">
            {problem.reload && (
              <button type="button" onClick={() => void reload()}>
                Recargar
              </button>
            )}
            <button type="button" onClick={() => setProblem(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="ed-warnings" data-testid="warnings">
          <strong>Avisos de legibilidad</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={`${w.templateId}-${w.code}-${i}`}>{w.message}</li>
            ))}
          </ul>
          <button type="button" onClick={() => setWarnings([])}>
            Entendido
          </button>
        </div>
      )}

      {state.view === 'plantillas' ? (
        <Gallery
          templates={state.workspace.templates}
          defaultId={state.workspace.defaultId}
          business={business}
          actions={actions}
        />
      ) : (
        <div className="ed-grid">
          <SideRail
            tab={state.tab}
            onTab={actions.setTab}
            template={template}
            workspace={state.workspace}
            activeId={state.activeId}
            actions={actions}
          />

          <section className="ed-stage">
            <div className="ed-area" ref={area} onPointerDown={deselect}>
              {state.preview ? (
                <PreviewPages template={template} business={business} scale={previewScale} />
              ) : (
                <div className="ed-page-wrap" ref={stage} onPointerDown={deselect}>
                  <Canvas
                    template={template}
                    page={state.page}
                    tokens={data.tokens}
                    items={data.items}
                    terms={data.terms}
                    introText={data.introText}
                    photoPositions={data.photoPositions}
                    scale={scale}
                    selId={state.selId}
                    onSelect={actions.select}
                    onCheckpoint={actions.checkpoint}
                    onPatch={actions.patchLive}
                    testId="canvas-page"
                  />
                </div>
              )}
            </div>
            <footer className="ed-footer">
              <PageStrip
                template={template}
                business={business}
                page={state.page}
                preview={state.preview}
                onPick={actions.selectPage}
              />
              {!state.preview && (
                <ZoomControls
                  label={`${Math.round(current * 100)}%`}
                  onIn={() => actions.setZoom(current + 0.1)}
                  onOut={() => actions.setZoom(current - 0.1)}
                  onFit={() => actions.setZoom(null)}
                />
              )}
            </footer>
          </section>

          <Inspector
            template={template}
            page={state.page}
            el={el}
            actions={actions}
            overflow={overflow}
          />
        </div>
      )}

      {state.message && (
        <div className="ed-toast" role="status" data-testid="toast">
          {state.message.text}
        </div>
      )}
    </div>
  );
}
