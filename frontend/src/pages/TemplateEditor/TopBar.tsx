import { LIMITS } from '../../../../backend/src/catalog/template';
import { IMAGES } from '../../print/assets';
import type { EditorView } from './useTemplateEditor';

export interface TopBarProps {
  view: EditorView;
  onView: (view: EditorView) => void;
  name: string;
  onName: (name: string) => void;
  /** La plantilla abierta ya es la predeterminada. */
  isDefault: boolean;
  onUseDefault: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  dirty: boolean;
  /** Se puede guardar: hay cambios, no se está guardando, ninguna plantilla quedó sin nombre y los datos son válidos. */
  canSave: boolean;
  /** Por qué no se puede guardar, cuando hay cambios pero algo lo impide. */
  saveHint?: string;
  busy: boolean;
  preview: boolean;
  onTogglePreview: () => void;
  onSave: () => void;
  onBack: () => void;
}

/**
 * Barra superior: volver al menú, pestañas Editor/Plantillas, nombre de la plantilla, historial, estado de guardado,
 * plantilla predeterminada, vista previa y Guardar. En la galería solo quedan las pestañas, el estado y Guardar.
 */
export default function TopBar({
  view,
  onView,
  name,
  onName,
  isDefault,
  onUseDefault,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  dirty,
  canSave,
  saveHint,
  busy,
  preview,
  onTogglePreview,
  onSave,
  onBack,
}: TopBarProps) {
  const editing = view === 'editor';
  const blank = name.trim() === '';

  return (
    <header className="ed-topbar">
      <button type="button" className="ed-back" title="Volver al menú" onClick={onBack}>
        <img src={IMAGES.logo} alt="" draggable={false} />← Menú
      </button>
      <span className="ed-title">Apariencia</span>
      <div className="ed-views">
        <button type="button" aria-label="Vista Editor" aria-pressed={editing} onClick={() => onView('editor')}>
          Editor
        </button>
        <button type="button" aria-label="Vista Plantillas" aria-pressed={!editing} onClick={() => onView('plantillas')}>
          Plantillas
        </button>
      </div>
      {editing && (
        <>
          <input
            className="ed-name"
            aria-label="Nombre de la plantilla"
            aria-invalid={blank}
            maxLength={LIMITS.nameMax}
            value={name}
            onChange={(e) => onName(e.target.value)}
          />
          {blank && (
            <span className="ed-name-error" role="alert">
              El nombre no puede estar vacío.
            </span>
          )}
          <div className="ed-history">
            <button type="button" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
              ↶
            </button>
            <button type="button" aria-label="Rehacer" title="Rehacer (Ctrl+Mayús+Z)" disabled={!canRedo} onClick={onRedo}>
              ↷
            </button>
          </div>
        </>
      )}
      <span className="ed-spacer" />
      <span className="ed-status" data-testid="save-status" data-dirty={dirty ? 'true' : 'false'}>
        <span className="ed-status-dot" aria-hidden="true" />
        {dirty ? 'Cambios sin guardar' : 'Todo guardado'}
      </span>
      {editing && (
        <>
          <button type="button" className="ed-preview-btn" aria-pressed={preview} onClick={onTogglePreview}>
            {preview ? 'Editar' : 'Vista previa'}
          </button>
          <button
            type="button"
            className="ed-default-btn"
            aria-label={isDefault ? 'Predeterminada' : 'Usar al generar'}
            disabled={isDefault}
            onClick={onUseDefault}
          >
            {isDefault ? 'Predeterminada' : 'Usar'}
          </button>
        </>
      )}
      <button type="button" className="ed-save" disabled={!canSave} title={canSave ? undefined : saveHint} aria-busy={busy} onClick={onSave}>
        Guardar
      </button>
    </header>
  );
}
