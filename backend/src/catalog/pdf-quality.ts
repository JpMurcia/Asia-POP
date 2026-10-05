/**
 * Calidad del PDF de una generación (feature 005). Módulo PURO (sin Node): lo importan el backend y la pantalla
 * Generar, y se prueba sin DOM ni disco.
 */

export const PDF_QUALITIES = ['optimized', 'original'] as const;
export type PdfQuality = (typeof PDF_QUALITIES)[number];

/** Calidad preseleccionada en cada generación (FR-002). */
export const DEFAULT_PDF_QUALITY: PdfQuality = 'optimized';

/**
 * Tamaño objetivo del PDF optimizado: el límite habitual de los adjuntos de correo (FR-003). «MB» son 1.048.576
 * bytes, como los muestra Windows.
 */
export const PDF_TARGET_BYTES = 25 * 1024 * 1024;

export interface PdfQualityOption {
  label: string;
  /** Explicación corta, en lenguaje claro y sin términos técnicos (FR-001). */
  hint: string;
  recommended?: boolean;
}

export const PDF_QUALITY_OPTIONS: Record<PdfQuality, PdfQualityOption> = {
  optimized: {
    label: 'Optimizada',
    recommended: true,
    hint: 'Archivo mucho más liviano, ideal para enviar por correo o mensajería. Las fotos se ven igual a tamaño normal.',
  },
  original: {
    label: 'Original',
    hint: 'Conserva las fotos tal como están en Alegra. El archivo puede ser varias veces más grande.',
  },
};

/** `18,4 MB`: un decimal y coma decimal, sin depender de `Intl`. */
export function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1).replace('.', ',')} MB`;
}

/** `true` si el PDF pesa más que el tamaño objetivo (exactamente 25 MB no lo supera). */
export function exceedsTarget(bytes: number): boolean {
  return bytes > PDF_TARGET_BYTES;
}
