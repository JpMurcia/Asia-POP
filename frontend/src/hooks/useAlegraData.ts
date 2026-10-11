import { useCallback, useEffect, useRef, useState } from 'react';
import type { AlegraDataStatus } from '../../../backend/src/catalog/types';
import { api } from '../services/api';
import { notifySummaryChanged } from './usePanelSummary';

/** Cada cuánto se consulta el avance de una descarga en curso (la descarga completa tarda menos de un minuto). */
export const POLL_MS = 800;

const STATUS_URL = '/api/alegra/data';

interface Options {
  /** Se llama una vez cuando termina una actualización que pidió esta pantalla (para volver a cargar su lista). */
  onRefreshed?: () => void;
}

interface State {
  /** `null` mientras se consulta por primera vez (o si la consulta falló). */
  status: AlegraDataStatus | null;
  loading: boolean;
  /** Pide una actualización desde Alegra y sigue su avance. No espera a que termine. */
  refresh: () => Promise<void>;
}

/**
 * Estado de los datos de Alegra guardados en el equipo (feature 007). Consulta `GET /api/alegra/data` al montar y,
 * mientras haya una descarga en curso, cada ~800 ms; deja de hacerlo al terminar o al salir de la pantalla. La consulta
 * nunca llega a Alegra: es el estado local del servidor.
 */
export function useAlegraData({ onRefreshed }: Options = {}): State {
  const [status, setStatus] = useState<AlegraDataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  /** La actualización en curso la pidió esta pantalla: al terminar, avisa. Una descarga ajena no la dispara. */
  const requested = useRef(false);
  const mounted = useRef(true);
  const callback = useRef(onRefreshed);
  callback.current = onRefreshed;

  const apply = useCallback((next: AlegraDataStatus) => {
    if (!mounted.current) return;
    setStatus(next);
    if (next.state !== 'syncing' && requested.current) {
      requested.current = false;
      callback.current?.();
      notifySummaryChanged(); // Inicio y la barra lateral muestran la nueva antigüedad
    }
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api.get<AlegraDataStatus>(STATUS_URL));
    } catch {
      /* sin respuesta: se queda lo último que se vio */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  // Mientras se descarga, vuelve a preguntar; al terminar (o al desmontar) el temporizador se limpia solo
  const syncing = status?.state === 'syncing';
  useEffect(() => {
    if (!syncing) return undefined;
    const id = setTimeout(() => void load(), POLL_MS);
    return () => clearTimeout(id);
  }, [syncing, status, load]);

  const refresh = useCallback(async () => {
    requested.current = true;
    try {
      apply(await api.post<AlegraDataStatus>('/api/alegra/data/refresh'));
    } catch {
      requested.current = false; // no se pudo pedir: la barra sigue mostrando lo guardado
    }
  }, [apply]);

  return { status, loading, refresh };
}

/**
 * El avance de la descarga mientras `active` es verdadero (la pantalla de carga): consulta de inmediato y luego cada
 * ~800 ms. Devuelve el último estado conocido, o `null` si aún no hay.
 */
export function useAlegraProgress(active: boolean): AlegraDataStatus | null {
  const [status, setStatus] = useState<AlegraDataStatus | null>(null);
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const next = await api.get<AlegraDataStatus>(STATUS_URL);
        if (!cancelled) setStatus(next);
      } catch {
        /* se reintenta en el siguiente ciclo */
      }
      if (!cancelled) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active]);
  return status;
}
