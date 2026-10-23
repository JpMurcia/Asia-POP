import { RANGES } from '../../../../backend/src/catalog/template';

interface Size {
  w: number;
  h: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Tamaño que conserva la relación alto/ancho de `origin` (en % de la hoja; es constante con cualquier zoom) cuando el
 * parche trae solo `w` o solo `h`. Si el resultado se sale de `RANGES.w` o `RANGES.h`, se recorta el eje que se pasa y
 * el otro se recalcula, de modo que la relación no se pierde. Con los dos (o ninguno) el parche queda igual.
 */
export function lockedSize(origin: Size, patch: { w?: number; h?: number }): { w?: number; h?: number } {
  const hasW = patch.w !== undefined;
  const hasH = patch.h !== undefined;
  if (hasW === hasH || !origin.w || !origin.h) return patch;
  const ratio = origin.h / origin.w;
  let w = hasW ? patch.w! : patch.h! / ratio;
  w = Math.min(Math.max(w, RANGES.w[0], RANGES.h[0] / ratio), Math.min(RANGES.w[1], RANGES.h[1] / ratio));
  return { w: round1(w), h: round1(w * ratio) };
}
