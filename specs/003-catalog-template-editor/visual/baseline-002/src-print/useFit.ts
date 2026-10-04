import { useLayoutEffect, type RefObject } from 'react';

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

/**
 * Ajusta el tamaño del texto de un bloque de altura limitada para que no desborde.
 *
 * Escribe `--fit` (1 = tamaño normal) en el elemento y la reduce hasta que `scrollHeight` cabe en el límite.
 * `print.css` multiplica los tamaños de letra por `var(--fit, 1)`. Se repite cuando las fuentes terminan de cargar,
 * porque con la fuente de reserva las medidas serían otras. En jsdom las medidas son 0 y no hace nada.
 */
export function useFit<T extends HTMLElement>(ref: RefObject<T | null>, deps: readonly unknown[]): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const fit = () => {
      let scale = 1;
      el.style.setProperty('--fit', '1');
      while (scale > MIN_FIT && el.scrollHeight > heightLimit(el) + 1) {
        scale = Math.max(MIN_FIT, scale * STEP);
        el.style.setProperty('--fit', scale.toFixed(3));
      }
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
