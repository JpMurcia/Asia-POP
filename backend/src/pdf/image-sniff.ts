/**
 * Reconoce el formato de una imagen por sus primeros bytes. Es puro (sin Node) y no depende del tipo de
 * contenido que declare el servidor: el CDN de Alegra sirve todas sus fotos como `binary/octet-stream`.
 */
export type ImageExt = '.jpg' | '.png' | '.webp' | '.gif';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ascii = (b: Uint8Array, from: number, to: number): string => String.fromCharCode(...b.subarray(from, to));

/** Devuelve la extensión de JPG, PNG, WebP o GIF, o `null` si los bytes no son una de esas imágenes. */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return '.jpg';
  if (bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((v, i) => bytes[i] === v)) return '.png';
  if (bytes.length >= 6 && ascii(bytes, 0, 3) === 'GIF' && ['87a', '89a'].includes(ascii(bytes, 3, 6))) return '.gif';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return '.webp';
  return null;
}
