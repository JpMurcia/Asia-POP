import type { PhotoFailureReason } from './types';

/**
 * Texto, para el responsable de la tienda, de por qué no se pudo obtener la foto de un producto.
 * Puro (sin Node): lo importa también el frontend. Sin códigos HTTP ni jerga técnica.
 */
export const PHOTO_REASON_LABEL: Record<PhotoFailureReason, string> = {
  unauthorized: 'Alegra rechazó el acceso a la foto o su enlace venció',
  not_found: 'La foto ya no existe en Alegra',
  timeout: 'La foto tardó demasiado en descargarse',
  not_image: 'El archivo de la foto no es una imagen',
  unsupported_format: 'Formato de foto no admitido (usa JPG, PNG, WebP o GIF)',
  too_large: 'La foto pesa más de 10 MB',
  unavailable: 'El servidor de la foto no respondió',
};
