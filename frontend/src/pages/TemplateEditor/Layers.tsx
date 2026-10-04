import { ELEMENT_LABELS, isAutoBlock, type PageElement } from '../../../../backend/src/catalog/template';

export interface LayersProps {
  /** Elementos de la página en orden de apilado (el último queda al frente). */
  els: readonly PageElement[];
  selId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
}

export const layerName = (el: PageElement) => el.name || ELEMENT_LABELS[el.type];
const layerType = (el: PageElement) => `${ELEMENT_LABELS[el.type]}${isAutoBlock(el) ? ' · automático' : ''}`;

/**
 * Capas de la página, de arriba hacia abajo (la primera es la que queda al frente). Es la única forma de elegir un
 * elemento oculto y de ocultar o fijar sin seleccionar.
 */
export default function Layers({ els, selId, onSelect, onToggleVisible, onToggleLock }: LayersProps) {
  const rows = [...els].reverse();
  return (
    <div data-testid="layers" className="ed-layers">
      <div className="ed-heading">Capas</div>
      <ol>
        {rows.map((el) => (
          <li key={el.id} data-selected={el.id === selId ? 'true' : undefined}>
            <button type="button" className="ed-layer-main" onClick={() => onSelect(el.id)}>
              <strong style={{ opacity: el.visible === false ? 0.45 : 1 }}>{layerName(el)}</strong>
              <span>{layerType(el)}</span>
            </button>
            <button type="button" className="ed-layer-btn" onClick={() => onToggleVisible(el.id)}>
              {el.visible === false ? 'Oculto' : 'Visible'}
            </button>
            <button type="button" className="ed-layer-btn" data-on={el.locked ? 'true' : undefined} onClick={() => onToggleLock(el.id)}>
              {el.locked ? 'Fijo' : 'Libre'}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
