/**
 * Opción «Fondo de la foto» de la generación (feature 010, FR-008). Módulo PURO (sin Node ni sharp): lo importan el
 * backend y la pantalla Generar.
 */

export const PHOTO_BACKDROPS = ['marco', 'sin-fondo'] as const;
export type PhotoBackdrop = (typeof PHOTO_BACKDROPS)[number];

/** Modo preseleccionado: siempre da un resultado correcto con cualquier foto (supuesto de la spec). */
export const DEFAULT_PHOTO_BACKDROP: PhotoBackdrop = 'marco';

export const PHOTO_BACKDROP_OPTIONS: Record<PhotoBackdrop, { label: string; hint: string }> = {
  marco: {
    label: 'Dejar como está',
    hint: 'La foto se ve completa, con un marco claro sobre un fondo oscuro. Funciona bien con cualquier foto.',
  },
  'sin-fondo': {
    label: 'Quitar el fondo automáticamente',
    hint: 'El producto flota sobre el fondo oscuro. Si una foto no se puede separar con seguridad, se deja como está.',
  },
};
