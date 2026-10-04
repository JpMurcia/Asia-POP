export interface ZoomControlsProps {
  /** Texto del zoom actual, por ejemplo `65%`. */
  label: string;
  onIn: () => void;
  onOut: () => void;
  onFit: () => void;
}

/** Acercar, alejar y Ajustar (el zoom va de 20 % a 200 %; `Ajustar` lo devuelve al espacio disponible). */
export default function ZoomControls({ label, onIn, onOut, onFit }: ZoomControlsProps) {
  return (
    <div className="ed-zoom">
      <button type="button" aria-label="Alejar" onClick={onOut}>
        −
      </button>
      <span data-testid="zoom-label">{label}</span>
      <button type="button" aria-label="Acercar" onClick={onIn}>
        +
      </button>
      <button type="button" className="ed-zoom-fit" onClick={onFit}>
        Ajustar
      </button>
    </div>
  );
}
