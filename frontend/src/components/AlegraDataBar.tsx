import { Button } from './ui';
import { useAlegraData } from '../hooks/useAlegraData';
import { timeAgo, useNow } from '../hooks/useNow';

/** Sin el punto final: el mensaje de Alegra se inserta en una frase que ya lleva el suyo. */
const bare = (message: string) => message.replace(/[.\s]+$/, '');

/**
 * Estado de los datos de Alegra guardados en el equipo (feature 007), con el botón para actualizarlos. Va en Artículos,
 * Sin categoría, Combos y Conexión Alegra. Sin datos todavía no dibuja nada: la pantalla muestra su propia carga o error.
 * `onRefreshed` se llama cuando termina una actualización pedida desde aquí, para que la pantalla recargue su lista.
 */
export default function AlegraDataBar({ onRefreshed }: { onRefreshed?: () => void }) {
  const { status, refresh } = useAlegraData({ onRefreshed });
  const now = useNow();
  if (!status || status.state === 'none') return null;

  const ago = status.syncedAt ? (timeAgo(status.syncedAt, now) ?? 'hace un tiempo') : 'hace un tiempo';
  const syncing = status.state === 'syncing';
  const received = status.progress?.phase === 'items' ? status.progress.received : 0;
  const failed = !syncing && status.lastError !== null;

  let text: string;
  if (syncing) {
    text = received > 0 ? `Actualizando desde Alegra… ${received} artículos recibidos.` : 'Conectando con Alegra…';
  } else if (failed) {
    text = `No se pudo actualizar desde Alegra: ${bare(status.lastError!.message)}. Estás viendo los datos de ${ago}.`;
  } else {
    text = `Datos de Alegra actualizados ${ago}.`;
  }

  return (
    <div
      className="flex items-center justify-between gap-3 flex-wrap rounded-pop border border-pop-line bg-pop-surface2 px-4 py-2.5 text-sm"
      data-testid="alegra-data-bar"
      data-state={failed ? 'error' : status.state}
    >
      <span aria-live="polite" className={failed ? 'text-pop-warn-text font-semibold' : 'text-pop-muted'}>
        {text}
      </span>
      <Button
        variant="secondary"
        className="h-9"
        disabled={syncing}
        aria-busy={syncing || undefined}
        onClick={() => void refresh()}
      >
        {failed ? 'Reintentar' : 'Actualizar desde Alegra'}
      </Button>
    </div>
  );
}
