import type { AlegraDataStatus } from '../../../../backend/src/catalog/types';
import Card from './Card';

/**
 * Alto mínimo del área de la lista de Artículos de Alegra. La pantalla de carga y la lista usan el mismo, así que al
 * llegar los datos nada cambia de lugar (feature 007, SC-008).
 */
export const LIST_AREA_MIN_HEIGHT = '36rem';

/** Mismas formas que la pantalla real: una barra de búsqueda, unas etiquetas y ocho filas. */
const CHIP_WIDTHS = ['w-16', 'w-24', 'w-20', 'w-28', 'w-20', 'w-24'];
const ROWS = Array.from({ length: 8 }, (_, i) => i);
const PULSE = 'animate-pulse motion-reduce:animate-none';

/**
 * Pantalla de carga de «Artículos de Alegra» mientras se descargan los datos por primera vez (o al actualizar). Cuenta lo
 * recibido (Alegra no informa el total, así que el indicador no promete un porcentaje) y reserva el espacio de la lista.
 */
export default function LoadingScreen({ status }: { status: AlegraDataStatus | null }) {
  const received = status?.progress?.phase === 'items' ? status.progress.received : 0;
  return (
    <div data-testid="loading-screen" className="flex flex-col gap-4" style={{ minHeight: LIST_AREA_MIN_HEIGHT }}>
      <Card className="flex flex-col gap-3 !shadow-none">
        <h2 className="text-[17px] font-semibold">Descargando los artículos de Alegra</h2>
        <p className="text-sm text-pop-muted">
          Solo pasa la primera vez o cuando actualizas. Puedes ir a otra pantalla: la descarga sigue.
        </p>
        <div
          role="progressbar"
          aria-label="Descargando los artículos de Alegra"
          aria-busy="true"
          className={`h-2 w-full rounded-full bg-pop-stripe overflow-hidden ${PULSE}`}
        >
          <div className="h-full w-1/3 rounded-full bg-pop-accent" />
        </div>
        <p className="text-sm font-semibold" aria-live="polite">
          {received > 0 ? `${received} artículos recibidos` : 'Conectando con Alegra…'}
        </p>
      </Card>

      <div aria-hidden="true" className="flex flex-col gap-4">
        <div data-skeleton="search" className={`h-11 rounded-pop bg-pop-stripe ${PULSE}`} />
        <div className="flex flex-wrap gap-2">
          {CHIP_WIDTHS.map((w, i) => (
            <div key={i} data-skeleton="chip" className={`h-9 rounded-full bg-pop-stripe ${w} ${PULSE}`} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {ROWS.map((i) => (
            <div key={i} data-skeleton="row" className={`h-12 rounded-pop bg-pop-surface2 ${PULSE}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
