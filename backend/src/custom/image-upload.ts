import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { HttpError } from '../api/errors';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Middleware multer en memoria para un único campo `image`. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
}).single('image');

/** Detecta el tipo real por los primeros bytes (no confía en el nombre ni en el tipo declarado). */
export function detectImageExt(buf: Buffer): '.png' | '.jpg' | '.webp' | null {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return '.png';
  }
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') {
    return '.webp';
  }
  return null;
}

/** Guarda la imagen subida y devuelve el nombre de archivo. Lanza 422 si no es png/jpg/webp válido. */
export function saveUploadedImage(uploadsDir: string, file: Express.Multer.File | undefined): string {
  if (!file) throw new HttpError(422, 'image_required', 'Adjunta una imagen en el campo "image".');
  const ext = detectImageExt(file.buffer);
  if (!ext) throw new HttpError(422, 'invalid_image', 'La imagen debe ser PNG, JPG o WEBP.');
  fs.mkdirSync(uploadsDir, { recursive: true });
  const name = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(uploadsDir, name), file.buffer);
  return name;
}

/** Traduce los errores de multer (tamaño, campos) a errores HTTP propios. */
export function wrapUpload(handler: typeof imageUpload): typeof imageUpload {
  return ((req, res, next) =>
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      const code = (err as { code?: string }).code;
      if (code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, 'image_too_large', 'La imagen supera el máximo de 5 MB.'));
      }
      return next(new HttpError(422, 'invalid_upload', 'No se pudo leer la imagen enviada.'));
    })) as typeof imageUpload;
}
