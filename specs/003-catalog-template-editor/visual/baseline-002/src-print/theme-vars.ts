import type { CSSProperties } from 'react';
import type { Theme } from '../../../backend/src/catalog/theme';

/**
 * Variables CSS del tema del catálogo. `print.css` las usa con el valor por defecto como reserva, así que
 * los componentes de impresión (y la muestra del editor) solo reciben el tema por props.
 */
export function themeCssVars(theme: Theme): CSSProperties {
  return {
    '--pdf-bg': theme.background,
    '--pdf-accent-1': theme.accent1,
    '--pdf-accent-2': theme.accent2,
    '--pdf-accent-3': theme.accent3,
  } as CSSProperties;
}
