import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PhotoFailureReason } from '../catalog/types';
import { sniffImage } from './image-sniff';

const EXTENSIONS = ['.jpg', '.png', '.webp', '.gif'];
const MAX_BYTES = 10 * 1024 * 1024;
/** Una copia se reutiliza mientras tenga menos de una hora: pasada esa ventana la foto se descarga de nuevo. */
const FRESH_MS = 60 * 60 * 1000;
/**
 * Una copia que lleva más de esto sin renovarse se borra al terminar una preparación. Pasada `FRESH_MS` ya nadie la
 * reutiliza y una preparación abierta (dura 15 min) la usa a lo sumo poco después de descargarla: un día deja holgura.
 */
const STALE_MS = 24 * 60 * 60 * 1000;
/** Parámetros con los que el CDN de Alegra firma cada dirección: cambian en cada listado y no identifican la foto. */
const SIGNATURE_PARAMS = new Set(['expires', 'signature', 'key-pair-id']);
/** Los nombres que escribe este caché (copia o descarga a medias); la poda no toca nada más. */
const CACHE_FILE = /^[0-9a-f]{40}\.(jpg|png|webp|gif)(\.part)?$/;

/** Resultado de descargar una foto: la URL local `/media/cache/<archivo>` o el motivo del fallo. */
export type DownloadResult = { ok: true; url: string } | { ok: false; reason: PhotoFailureReason };

/** Resultado por producto tras probar todas sus fotos candidatas. */
export type PhotoOutcome =
  | { status: 'ok'; url: string }
  /** El producto no trae ninguna dirección de foto. */
  | { status: 'none' }
  /** Trae fotos y ninguna sirvió; el motivo es el de la primera candidata (la favorita). */
  | { status: 'failed'; reason: PhotoFailureReason };

function reasonForStatus(status: number): PhotoFailureReason {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404 || status === 410) return 'not_found';
  return 'unavailable';
}

/**
 * Descarga fotos remotas a disco (tiempo límite y tope de tamaño). La foto se acepta si sus **bytes** son un
 * JPG, PNG, WebP o GIF: el tipo de contenido declarado no cuenta, porque el CDN de Alegra sirve todas sus fotos
 * como `binary/octet-stream`. Un fallo nunca lanza ni deja archivos a medias, y nunca expone la URL de origen
 * (las fotos de Alegra son direcciones firmadas): solo devuelve el motivo.
 *
 * La copia local se nombra por la foto y no por la dirección firmada (que cambia en cada listado de ítems), así que
 * se reutiliza entre preparaciones, y `downloadAll` borra al terminar las copias abandonadas: el caché no crece sin límite.
 */
export class ImageCache {
  constructor(
    private dir: string,
    private fetchImpl: typeof fetch = fetch,
    private timeoutMs = 10_000,
    private maxBytes = MAX_BYTES,
  ) {}

  /**
   * Nombre estable de la foto: la dirección sin los parámetros de firma. La ruta es la misma mientras la foto no
   * cambie; cualquier otro parámetro sigue distinguiendo fotos (no se sirve la de otro producto).
   */
  private hash(url: string): string {
    let key = url;
    try {
      const u = new URL(url);
      for (const name of [...u.searchParams.keys()]) {
        if (SIGNATURE_PARAMS.has(name.toLowerCase())) u.searchParams.delete(name);
      }
      u.hash = '';
      key = u.href;
    } catch {
      // No es una dirección web válida: se usa tal cual
    }
    return crypto.createHash('sha1').update(key).digest('hex');
  }

  /** Descarga una foto. Las fotos se piden sin credenciales: la dirección ya viene firmada. */
  async download(url: string): Promise<DownloadResult> {
    fs.mkdirSync(this.dir, { recursive: true });
    const base = this.hash(url);
    for (const ext of EXTENSIONS) {
      const f = path.join(this.dir, base + ext);
      if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < FRESH_MS) {
        return { ok: true, url: `/media/cache/${base}${ext}` };
      }
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: ctrl.signal });
      if (!res.ok) return { ok: false, reason: reasonForStatus(res.status) };
      // Si el servidor ya anuncia un tamaño excesivo no se lee el cuerpo
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > this.maxBytes) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, reason: 'too_large' };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return { ok: false, reason: 'not_image' };
      if (buf.length > this.maxBytes) return { ok: false, reason: 'too_large' };
      const ext = sniffImage(buf);
      if (!ext) {
        const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
        return { ok: false, reason: type.startsWith('image/') ? 'unsupported_format' : 'not_image' };
      }
      const file = path.join(this.dir, base + ext);
      const tmp = `${file}.part`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, file); // el archivo aparece completo o no aparece
      return { ok: true, url: `/media/cache/${base}${ext}` };
    } catch {
      return { ok: false, reason: ctrl.signal.aborted ? 'timeout' : 'unavailable' };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Prueba las fotos candidatas en orden y devuelve la primera que sirva. */
  async fetchFirst(urls: string[]): Promise<PhotoOutcome> {
    if (urls.length === 0) return { status: 'none' };
    let firstReason: PhotoFailureReason | undefined;
    for (const url of urls) {
      const res = await this.download(url);
      if (res.ok) return { status: 'ok', url: res.url };
      firstReason ??= res.reason;
    }
    return { status: 'failed', reason: firstReason! };
  }

  /**
   * Borra las copias (y descargas a medias) con más de `STALE_MS` sin renovarse; incluye las de antes de que el
   * nombre fuera estable. Nunca lanza: lo que no se pueda borrar (en uso, sin permiso) queda para la próxima poda.
   */
  prune(): void {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return; // la carpeta aún no existe
    }
    const cutoff = Date.now() - STALE_MS;
    for (const name of names) {
      if (!CACHE_FILE.test(name)) continue;
      const file = path.join(this.dir, name);
      try {
        if (fs.statSync(file).mtimeMs < cutoff) fs.rmSync(file, { force: true });
      } catch {
        // se reintenta en la próxima preparación
      }
    }
  }

  /**
   * Descarga en paralelo con concurrencia limitada: un resultado por producto (`id` → candidatas). Al terminar
   * poda el caché; las fotos de esta tanda son recientes, así que nunca se borran.
   */
  async downloadAll(
    candidates: Map<string, string[]>,
    concurrency = 6,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Map<string, PhotoOutcome>> {
    const entries = [...candidates.entries()];
    const out = new Map<string, PhotoOutcome>();
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < entries.length) {
        const [id, urls] = entries[next++]!;
        out.set(id, await this.fetchFirst(urls));
        onProgress?.(++done, entries.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, worker));
    this.prune();
    return out;
  }
}
