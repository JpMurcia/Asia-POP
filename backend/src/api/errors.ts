import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Ruta de un campo para los errores de validación: `templates[0].pages.productos.els[2].ringW`. */
export function fieldPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, seg) => {
    if (typeof seg === 'number') return `${acc}[${seg}]`;
    return acc ? `${acc}.${String(seg)}` : String(seg);
  }, '');
}

/**
 * Valida con zod y, si falla, lanza `HttpError(422, code, …)` con `details: [{ field, message }]`
 * en lugar del `validation_error` genérico.
 */
export function parseOr422<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  data: unknown,
  code: string,
  message: string,
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw new HttpError(
    422,
    code,
    message,
    result.error.issues.map((i) => ({ field: i.path.map(String).join('.'), message: i.message })),
  );
}

const SECRET_KEYS = /^(apitoken|token|authorization|password|token_encrypted)$/i;

/** Devuelve una copia con los campos sensibles enmascarados (para logs). */
export function maskSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map(maskSecrets) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? '***' : maskSecrets(v);
    }
    return out as T;
  }
  return value;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  const e = err as { type?: string; name?: string };
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'invalid_json', message: 'El cuerpo no es JSON válido.' });
    return;
  }
  if (e?.type === 'entity.too.large') {
    res.status(413).json({ error: 'payload_too_large', message: 'La solicitud es demasiado grande.' });
    return;
  }
  if (e?.name === 'ZodError') {
    res.status(422).json({
      error: 'validation_error',
      message: 'Los datos enviados no son válidos.',
      details: (err as { issues: unknown }).issues,
    });
    return;
  }
  console.error('[error]', (err as Error)?.message);
  res.status(500).json({ error: 'internal_error', message: 'Ocurrió un error inesperado.' });
}

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'not_found', message: 'Ruta no encontrada.' });
};
