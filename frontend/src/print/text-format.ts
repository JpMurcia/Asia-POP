import { TEXT_DEFAULTS, type TextEl } from '../../../backend/src/catalog/template';

/**
 * Formato de texto estilo Canva (feature 012): listas, subrayado y arco. Funciones puras compartidas por el lienzo,
 * las miniaturas, la vista previa y el PDF (constitución IV).
 */

export interface ListLine {
  /** `null` en una línea vacía: se conserva como espacio y no cuenta en la numeración. */
  marker: string | null;
  text: string;
}

/** Una línea por renglón; la numeración cuenta solo las líneas no vacías, empezando en 1. */
export function listLines(text: string, kind: 'bullet' | 'number'): ListLine[] {
  let n = 0;
  return text.split('\n').map((line) => {
    if (line.trim() === '') return { marker: null, text: line };
    n += 1;
    return { marker: kind === 'bullet' ? '•' : `${n}.`, text: line };
  });
}

/** Sangría francesa de una lista: el marcador cuelga a la izquierda y las líneas largas se alinean con el texto. */
export const LIST_INDENT = '1.4em';

/** `text-decoration-line` del texto: subrayado y tachado se pueden combinar. `undefined` si no hay ninguno (marcado de siempre). */
export function decorationLine(el: Pick<TextEl, 'underline' | 'strike'>): string | undefined {
  const parts: string[] = [];
  if (el.underline) parts.push('underline');
  if ((el.strike ?? TEXT_DEFAULTS.strike) === true) parts.push('line-through');
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/** Máxima flecha del arco, como fracción del ancho de la caja, con la curvatura en 100. */
const MAX_SAGITTA = 0.35;

/**
 * Trazado del arco sobre el que corre el texto curvo, en el espacio de una caja de `w` × `h`.
 * Curvatura 0: línea recta por el medio. Positiva: arco hacia arriba. Negativa: hacia abajo.
 */
export function arcPath(w: number, h: number, curve: number): string {
  const mid = h / 2;
  if (!curve) return `M 0 ${mid} L ${w} ${mid}`;
  const s = (Math.max(-100, Math.min(100, curve)) / 100) * w * MAX_SAGITTA;
  const abs = Math.abs(s);
  const r = (w * w) / 4 / abs / 2 + abs / 2;
  const endY = mid + s / 2;
  const f = (n: number) => Math.round(n * 100) / 100;
  return `M 0 ${f(endY)} A ${f(r)} ${f(r)} 0 0 ${s > 0 ? 1 : 0} ${f(w)} ${f(endY)}`;
}
