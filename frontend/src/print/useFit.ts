import { useLayoutEffect, type RefObject } from 'react';
import { MIN_FONT_PX } from '../../../backend/src/catalog/template';

/** Escala mínima: por debajo el texto ya no se lee; el recorte por líneas es la última defensa. */
export const MIN_FIT = 0.45;
const STEP = 0.93;

/**
 * Altura máxima que puede ocupar el bloque: su `max-height` calculado (en px) o, si no tiene, su `clientHeight`.
 * Comparar con `clientHeight` solo sería incorrecto en bloques con `max-height` y altura automática: los glifos
 * de algunas fuentes sobresalen un poco de la caja de línea y un título corto parecería desbordar.
 */
export function heightLimit(el: HTMLElement): number {
  const raw = getComputedStyle(el).maxHeight;
  if (raw.endsWith('%')) {
    // El navegador devuelve el porcentaje tal cual: se resuelve contra el bloque posicionado que lo contiene
    const parent = el.offsetParent as HTMLElement | null;
    return parent ? (parent.clientHeight * parseFloat(raw)) / 100 : el.clientHeight;
  }
  const px = parseFloat(raw);
  return Number.isFinite(px) ? px : el.clientHeight;
}

export interface FitOptions {
  /**
   * Qué desborde se corrige: `height` (por defecto: no cambia a los llamadores anteriores), `width` (una línea,
   * como el pie) o `both` (títulos y textos con datos insertables, cuyo largo depende de los datos).
   */
  axis?: 'height' | 'width' | 'both';
  /** Tamaño mínimo de letra en px lógicos (6 pt, FR-031). Se cuenta sobre el texto más pequeño del bloque. */
  minFontPx?: number;
  /**
   * Último recurso cuando, con la letra en su mínimo, el contenido aún no cabe: variables CSS que se aplican al
   * elemento paso a paso (por ejemplo, menos líneas visibles en cada párrafo) hasta que cabe. Así los textos
   * extremos se cortan con "…" en lugar de bajar de 6 pt.
   */
  lastResort?: Record<string, string>[];
}

/**
 * Ajusta el tamaño del texto de un bloque de tamaño limitado para que no desborde.
 *
 * Escribe `--fit` (1 = tamaño normal) en el elemento y la reduce hasta que `scrollHeight` (y/o `scrollWidth`) cabe.
 * Los tamaños de letra se escriben como `calc(Npx * var(--fit, 1))`. El factor mínimo es
 * `máx(MIN_FIT, minFontPx / tamaño base del elemento)`: un texto de 8 px no baja de 6 px y uno de 40 px llega a
 * 18 px; en un bloque con textos de varios tamaños se cuenta sobre el más pequeño de sus hijos. Si al llegar al mínimo
 * aún no cabe, aplica los pasos de `lastResort` y, si ni así cabe, marca `data-overflow="true"` (el editor lo muestra
 * como advertencia).
 * Se repite cuando las fuentes terminan de cargar, porque con la fuente de reserva las medidas serían otras.
 * En jsdom las medidas son 0 y no hace nada.
 */
export function useFit<T extends HTMLElement>(
  ref: RefObject<T | null>,
  deps: readonly unknown[],
  { axis = 'height', minFontPx = MIN_FONT_PX, lastResort = [] }: FitOptions = {},
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const overflows = () =>
      (axis !== 'width' && el.scrollHeight > heightLimit(el) + 1) ||
      (axis !== 'height' && el.scrollWidth > el.clientWidth + 1);

    const stepKeys = [...new Set(lastResort.flatMap((step) => Object.keys(step)))];

    /** El texto más pequeño del bloque (el contenedor o cualquiera de sus hijos), con --fit en 1. */
    const smallestFont = () => {
      let smallest = parseFloat(getComputedStyle(el).fontSize);
      el.querySelectorAll('*').forEach((child) => {
        const size = parseFloat(getComputedStyle(child).fontSize);
        if (Number.isFinite(size) && size > 0 && (!Number.isFinite(smallest) || size < smallest)) smallest = size;
      });
      return smallest;
    };

    const fit = () => {
      el.style.setProperty('--fit', '1');
      for (const key of stepKeys) el.style.removeProperty(key);
      const base = smallestFont();
      const min = Math.min(1, Math.max(MIN_FIT, Number.isFinite(base) && base > 0 ? minFontPx / base : 0));
      let scale = 1;
      while (scale > min && overflows()) {
        scale = Math.max(min, scale * STEP);
        el.style.setProperty('--fit', scale.toFixed(3));
      }
      // Con la letra en su mínimo: recortar líneas, paso a paso, hasta que quepa
      for (const step of lastResort) {
        if (!overflows()) break;
        for (const [key, value] of Object.entries(step)) el.style.setProperty(key, value);
      }
      if (overflows()) el.setAttribute('data-overflow', 'true');
      else el.removeAttribute('data-overflow');
    };

    fit();
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
    };
  }, deps);
}
