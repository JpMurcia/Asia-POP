import {
  ELEMENT_LABELS,
  PAGE_LABELS,
  type PageBg,
  type PageElement,
  type PageKey,
  type Template,
} from '../../../../backend/src/catalog/template';
import FieldRenderer from './FieldRenderer';
import Layers, { layerName } from './Layers';
import { fieldsFor, pageFields } from './inspector-fields';
import type { EditorActions } from './useTemplateEditor';

export const PAGE_NOTES: Record<PageKey, string> = {
  portada: 'Primera página',
  seccion: 'Antes de cada sección',
  productos: 'Hasta 3 por hoja',
  politicas: 'Última página',
};

export interface InspectorProps {
  template: Template;
  page: PageKey;
  el: PageElement | undefined;
  actions: EditorActions;
  /** El bloque seleccionado llegó al tamaño mínimo legible y aun así no cabe (`data-overflow`). */
  overflow: boolean;
}

/**
 * Panel derecho. Con un elemento seleccionado: su tipo y nombre, las acciones y los campos que le corresponden.
 * Sin selección: el fondo de la página y la lista de capas (FR-013).
 */
export default function Inspector({ template, page, el, actions, overflow }: InspectorProps) {
  const { bg, els } = template.pages[page];

  return (
    <aside className="ed-inspector" data-testid="inspector">
      {el ? (
        <>
          <div className="ed-inspector-head">
            <span className="ed-kicker">{ELEMENT_LABELS[el.type]}</span>
            <span className="ed-inspector-title">{layerName(el)}</span>
          </div>
          <div className="ed-actions">
            <button type="button" onClick={() => actions.duplicate(el.id)}>
              Duplicar
            </button>
            <button type="button" onClick={() => actions.reorder(el.id, 1)}>
              Al frente
            </button>
            <button type="button" onClick={() => actions.reorder(el.id, -1)}>
              Atrás
            </button>
            <button type="button" onClick={() => actions.toggleLock(el.id)}>
              {el.locked ? 'Desbloquear' : 'Bloquear'}
            </button>
            <button type="button" onClick={() => actions.toggleVisible(el.id)}>
              {el.visible === false ? 'Mostrar' : 'Ocultar'}
            </button>
            <button type="button" className="ed-danger" onClick={() => actions.remove(el.id)}>
              Eliminar
            </button>
          </div>
          {overflow && (
            <p className="ed-overflow" data-testid="overflow-warning">
              Este bloque llegó al tamaño mínimo legible (6 pt) y aun así no cabe. Agrándalo o reduce su contenido; el
              catálogo se genera igual.
            </p>
          )}
          <FieldRenderer
            key={el.id}
            fields={fieldsFor(el, template)}
            values={el as unknown as Record<string, unknown>}
            palette={template.palette}
            onChange={(patch, mergeKey) => actions.patch(el.id, patch as Partial<PageElement>, mergeKey ? `${el.id}:${mergeKey}` : undefined)}
          />
        </>
      ) : (
        <>
          <div className="ed-inspector-head">
            <span className="ed-kicker">Página</span>
            <span className="ed-inspector-title">{PAGE_LABELS[page]}</span>
            <span className="ed-note">{PAGE_NOTES[page]}. Haz clic en un elemento para editarlo.</span>
          </div>
          <FieldRenderer
            key={`bg-${page}`}
            fields={pageFields(bg)}
            values={bg as unknown as Record<string, unknown>}
            palette={template.palette}
            onChange={(patch) => actions.patchBg(patch as Partial<PageBg>)}
          />
          <Layers els={els} selId={null} onSelect={actions.select} onToggleVisible={actions.toggleVisible} onToggleLock={actions.toggleLock} />
          <div className="ed-tip">
            <strong>Atajos</strong>
            <span>Arrastra para mover, usa la esquina para cambiar el tamaño. Flechas para ajustar, Supr para borrar, Ctrl+D para duplicar.</span>
          </div>
        </>
      )}
    </aside>
  );
}
