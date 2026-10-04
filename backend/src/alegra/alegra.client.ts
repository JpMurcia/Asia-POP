import { AlegraError, type AlegraCategoryRaw, type AlegraItemRaw } from './alegra.types';

export const PAGE_SIZE = 30; // máximo permitido por Alegra
const MAX_RETRIES = 3;

export interface AlegraClientOptions {
  baseUrl: string;
  email: string;
  token: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Tiempo máximo por petición; sin valor no hay límite (comportamiento de 001). */
  timeoutMs?: number;
}

/** Cliente de solo lectura: únicamente realiza peticiones GET (principio I). */
export class AlegraClient {
  private readonly auth: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: AlegraClientOptions) {
    this.auth = 'Basic ' + Buffer.from(`${opts.email}:${opts.token}`).toString('base64');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Petición ligera para validar credenciales. */
  async getCompany(): Promise<unknown> {
    return this.get('/company');
  }

  async listCategories(): Promise<AlegraCategoryRaw[]> {
    return this.paginate<AlegraCategoryRaw>('/item-categories', {});
  }

  /**
   * Todos los ítems activos (pagina hasta agotar resultados). Se pide `mode=advanced` porque con `mode=simple` Alegra
   * omite `images`, y su valor por defecto no está documentado: verificado con la cuenta real que `advanced` devuelve
   * lo mismo que sin el parámetro, así que pedirlo evita que un cambio silencioso deje el catálogo sin fotos.
   */
  async listActiveItems(): Promise<AlegraItemRaw[]> {
    return this.paginate<AlegraItemRaw>('/items', { status: 'active', mode: 'advanced' });
  }

  private async paginate<T>(path: string, params: Record<string, string>): Promise<T[]> {
    const all: T[] = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      const page = await this.get<T[]>(path, { ...params, start: String(start), limit: String(PAGE_SIZE) });
      if (!Array.isArray(page)) throw new AlegraError('http', 'Respuesta inesperada de Alegra.');
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return all;
  }

  private async get<T = unknown>(path: string, params: Record<string, string> = {}): Promise<T> {
    const qs = new URLSearchParams(params).toString();
    const url = `${this.opts.baseUrl}${path}${qs ? `?${qs}` : ''}`;

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          method: 'GET',
          headers: { Authorization: this.auth, Accept: 'application/json' },
          signal: this.opts.timeoutMs ? AbortSignal.timeout(this.opts.timeoutMs) : undefined,
        });
      } catch {
        throw new AlegraError('unreachable', 'No se pudo conectar con Alegra.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new AlegraError('rejected', 'Alegra rechazó las credenciales.', res.status);
      }
      if (res.status === 429) {
        if (attempt >= MAX_RETRIES) {
          throw new AlegraError('rate_limit', 'Alegra limitó las peticiones. Intenta de nuevo en un momento.', 429);
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new AlegraError('http', `Alegra respondió con error ${res.status}.`, res.status);
      return (await res.json()) as T;
    }
  }
}
