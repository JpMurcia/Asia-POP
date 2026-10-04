import crypto from 'node:crypto';
import type { AppConfig } from '../config/env';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'sid';

/** Sesiones en memoria: reiniciar el servidor cierra la sesión (aceptable para un solo usuario local). */
export class SessionStore {
  private sessions = new Map<string, number>();

  create(): string {
    const id = crypto.randomBytes(32).toString('hex');
    this.sessions.set(id, Date.now() + SESSION_TTL_MS);
    return id;
  }

  isValid(id: string | undefined): boolean {
    if (!id) return false;
    const exp = this.sessions.get(id);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.sessions.delete(id);
      return false;
    }
    return true;
  }

  destroy(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }
}

const sha = (s: string): Buffer => crypto.createHash('sha256').update(s).digest();

/** Compara las credenciales semilla en tiempo constante. */
export function credentialsMatch(
  cfg: Pick<AppConfig, 'seedUsername' | 'seedPassword'>,
  username: unknown,
  password: unknown,
): boolean {
  const u = typeof username === 'string' ? username : '';
  const p = typeof password === 'string' ? password : '';
  const userOk = crypto.timingSafeEqual(sha(u), sha(cfg.seedUsername));
  const passOk = crypto.timingSafeEqual(sha(p), sha(cfg.seedPassword));
  return userOk && passOk;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function sessionCookie(id: string, maxAgeSec = SESSION_TTL_MS / 1000): string {
  return `${SESSION_COOKIE}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}`;
}

export const clearedSessionCookie = (): string => sessionCookie('', 0);
