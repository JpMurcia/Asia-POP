import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { RANGES, type PageElement } from '../../../../backend/src/catalog/template';
import { clampBox } from './useTemplateEditor';

/** Tamaños mínimos de un elemento (% de la página). */
export const MIN_W = RANGES.w[0];
export const MIN_H = RANGES.h[0];
/** El elemento se ajusta al centro de la página cuando su centro queda a menos de esto (% de la página). */
export const CENTER_TOLERANCE_X = 1.2;
export const CENTER_TOLERANCE_Y = 0.9;
/** Por debajo de este desplazamiento (% de la página) el gesto cuenta como un clic, no como un arrastre. */
const DRAG_THRESHOLD = 0.3;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DragMode = 'move' | 'resize';

export interface DragResult {
  patch: Partial<Box>;
  /** Guía vertical (el centro horizontal de la página) y horizontal (el centro vertical). */
  guideV: boolean;
  guideH: boolean;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Posición o tamaño nuevos tras desplazar el puntero `dx` × `dy` (en % de la página) desde `origin`. Mover se ajusta
 * al centro horizontal y vertical con tolerancia; redimensionar (desde la esquina) respeta los mínimos. Ambos quedan
 * dentro de los rangos del esquema (`clampBox`): un arrastre muy largo con el zoom al mínimo, si no, dejaría valores
 * que el servidor rechaza con 422 al guardar.
 */
export function computeDrag(mode: DragMode, origin: Box, dx: number, dy: number): DragResult {
  if (mode === 'resize') {
    return {
      patch: { w: clampBox.w(round1(origin.w + dx)), h: clampBox.h(round1(origin.h + dy)) },
      guideV: false,
      guideH: false,
    };
  }
  let x = origin.x + dx;
  let y = origin.y + dy;
  let guideV = false;
  let guideH = false;
  if (Math.abs(x + origin.w / 2 - 50) < CENTER_TOLERANCE_X) {
    x = 50 - origin.w / 2;
    guideV = true;
  }
  if (Math.abs(y + origin.h / 2 - 50) < CENTER_TOLERANCE_Y) {
    y = 50 - origin.h / 2;
    guideH = true;
  }
  return { patch: { x: clampBox.x(round1(x)), y: clampBox.y(round1(y)) }, guideV, guideH };
}

interface Session {
  id: string;
  mode: DragMode;
  startX: number;
  startY: number;
  origin: Box;
  rect: DOMRect;
  started: boolean;
}

interface Handlers {
  /** Se llama una vez, al empezar a mover de verdad (no en un clic): un gesto es un solo paso de historial. */
  onCheckpoint: () => void;
  onPatch: (id: string, patch: Partial<PageElement>) => void;
}

/**
 * Mover y redimensionar con Pointer Events sobre coordenadas porcentuales: convierte los píxeles de pantalla a % del
 * rectángulo de la hoja (que ya incluye el zoom), así funciona igual a cualquier escala. Los oyentes van en `window`
 * para seguir al puntero aunque salga del elemento.
 */
export function usePointerDrag(pageRef: RefObject<HTMLElement | null>, handlers: Handlers) {
  const session = useRef<Session | null>(null);
  const latest = useRef(handlers);
  latest.current = handlers;
  const [guides, setGuides] = useState({ v: false, h: false });

  const onMove = useCallback((e: PointerEvent) => {
    const s = session.current;
    if (!s || !s.rect.width || !s.rect.height) return;
    const dx = ((e.clientX - s.startX) / s.rect.width) * 100;
    const dy = ((e.clientY - s.startY) / s.rect.height) * 100;
    if (!s.started) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      s.started = true;
      latest.current.onCheckpoint();
    }
    const r = computeDrag(s.mode, s.origin, dx, dy);
    latest.current.onPatch(s.id, r.patch);
    setGuides((g) => (g.v === r.guideV && g.h === r.guideH ? g : { v: r.guideV, h: r.guideH }));
  }, []);

  const stop = useCallback(() => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
    session.current = null;
    setGuides((g) => (g.v || g.h ? { v: false, h: false } : g));
  }, [onMove]);

  useEffect(() => stop, [stop]);

  /** Empieza un gesto sobre un elemento libre. Devuelve `false` si no hay hoja que medir. */
  const begin = useCallback(
    (e: { clientX: number; clientY: number }, id: string, mode: DragMode, origin: Box): boolean => {
      const rect = pageRef.current?.getBoundingClientRect();
      if (!rect) return false;
      stop();
      session.current = { id, mode, startX: e.clientX, startY: e.clientY, origin: { ...origin }, rect, started: false };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      return true;
    },
    [pageRef, onMove, stop],
  );

  return { begin, guides };
}
