import type { TextEl } from '../../../../backend/src/catalog/template';

/**
 * «Copiar estilo» (feature 012): las propiedades de formato que viajan de un texto a otro. Nunca el contenido
 * (`text`), la posición (`x`, `y`), el tamaño de la caja (`w`, `h`), la rotación, la opacidad ni el nombre.
 */
export const STYLE_KEYS = [
  'font',
  'size',
  'weight',
  'color',
  'align',
  'upper',
  'ls',
  'lh',
  'strike',
  'vAlign',
  'italic',
  'underline',
  'list',
  'stroke',
  'strokeW',
  'glow',
  'shadow',
  'shDist',
  'shAngle',
  'shBlur',
  'shAlpha',
  'shColor',
  'bg',
  'bgRadius',
  'bgPad',
  'bgAlpha',
  'bgColor',
  'bright',
  'echo',
  'misalign',
  'glitch',
  'hollow',
  'fxColor',
  'fxColor2',
  'fxDist',
  'fxI',
  'curve',
] as const satisfies readonly (keyof TextEl)[];

export type TextStyle = Partial<Pick<TextEl, (typeof STYLE_KEYS)[number]>>;

/** El formato de un texto, listo para pegarlo: solo las claves presentes (las ausentes quedan «sin formato» al pegar). */
export function pickStyle(el: TextEl): TextStyle {
  const out: Record<string, unknown> = {};
  for (const k of STYLE_KEYS) if (el[k] !== undefined) out[k] = el[k];
  return out as TextStyle;
}

/**
 * Parche que deja a `target` con el formato de `style`. Una propiedad opcional que `style` no trae se borra del
 * destino (`undefined`), para que el resultado sea idéntico al original, no una mezcla.
 */
export function styleToPatch(style: TextStyle): Partial<TextEl> {
  const patch: Record<string, unknown> = {};
  for (const k of STYLE_KEYS) patch[k] = style[k];
  return patch as Partial<TextEl>;
}
