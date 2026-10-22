import type { PageElement } from '../../../../backend/src/catalog/template';
import type { AlignEdge } from './useTemplateEditor';

/**
 * Trazos de cada ícono (viewBox 16×16): la barra gruesa es el elemento y la línea fina, el borde o el centro de la
 * hoja contra el que se alinea. En línea para no sumar una librería de íconos (constitución VI).
 */
const EDGES: readonly { edge: AlignEdge; label: string; path: string }[] = [
  { edge: 'left', label: 'Alinear a la izquierda', path: 'M2 1v14M5 5h8M5 11h5' },
  { edge: 'hcenter', label: 'Centrar horizontalmente', path: 'M8 1v14M3 5h10M5 11h6' },
  { edge: 'right', label: 'Alinear a la derecha', path: 'M14 1v14M3 5h8M6 11h5' },
  { edge: 'top', label: 'Alinear arriba', path: 'M1 2h14M5 5v8M11 5v5' },
  { edge: 'vcenter', label: 'Centrar verticalmente', path: 'M1 8h14M5 3v10M11 5v6' },
  { edge: 'bottom', label: 'Alinear abajo', path: 'M1 14h14M5 3v8M11 6v5' },
];

const LOCKED_HINT = 'Desbloquea el elemento para alinearlo';

/** Seis acciones que pegan el elemento a un borde o al centro de la hoja (FR-001 a FR-003). */
export default function AlignActions({ el, onAlign }: { el: PageElement; onAlign: (edge: AlignEdge) => void }) {
  return (
    <div className="ed-align" role="group" aria-label="Alinear a la página">
      {EDGES.map(({ edge, label, path }) => (
        <button
          key={edge}
          type="button"
          aria-label={label}
          title={el.locked ? LOCKED_HINT : label}
          disabled={el.locked}
          onClick={() => onAlign(edge)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      ))}
    </div>
  );
}
