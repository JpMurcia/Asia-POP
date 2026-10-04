import { useCallback, useEffect, useState } from 'react';
import type { PanelSummary } from '../../../backend/src/catalog/types';
import { api } from '../services/api';

/** Evento para pedir un nuevo resumen desde cualquier pantalla (por ejemplo, tras asignar una sección). */
export const SUMMARY_CHANGED_EVENT = 'app:summary-changed';

export function notifySummaryChanged(): void {
  window.dispatchEvent(new Event(SUMMARY_CHANGED_EVENT));
}

interface State {
  summary: PanelSummary | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * Resumen de Inicio compartido por la barra lateral y la pantalla Inicio.
 * Un fallo de red no rompe la pantalla: `summary` queda en `null` y `error` en `true`.
 * `reloadKey` (por ejemplo la ruta actual) vuelve a cargarlo al cambiar; el servidor lo cachea 60 s
 * y lo invalida al guardar cambios, así que recargar al navegar es barato.
 */
export function usePanelSummary(reloadKey = ''): State {
  const [summary, setSummary] = useState<PanelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (force: boolean) => {
    try {
      setSummary(await api.get<PanelSummary>(`/api/panel/summary${force ? '?refresh=1' : ''}`));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const onChanged = () => void load(false);
    window.addEventListener(SUMMARY_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(SUMMARY_CHANGED_EVENT, onChanged);
  }, [load, reloadKey]);

  const refresh = useCallback(() => load(true), [load]);
  return { summary, loading, error, refresh };
}
