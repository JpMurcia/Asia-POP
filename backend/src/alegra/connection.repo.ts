import { decrypt, encrypt } from '../config/crypto';
import type { AppConfig } from '../config/env';
import type { Db } from '../db/database';
import { AlegraClient } from './alegra.client';

export interface ConnectionStatus {
  email: string | null;
  isConfigured: boolean;
  lastTestedAt: string | null;
}

export class ConnectionRepo {
  constructor(
    private db: Db,
    private config: AppConfig,
  ) {}

  save(email: string, token: string, testedAt: string): void {
    this.db
      .prepare(
        `INSERT INTO alegra_connection (id, email, token_encrypted, last_tested_at) VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET email = excluded.email, token_encrypted = excluded.token_encrypted,
         last_tested_at = excluded.last_tested_at`,
      )
      .run(email, encrypt(this.config.encryptionKey, token), testedAt);
  }

  /** Estado público: nunca incluye el token. */
  status(): ConnectionStatus {
    const row = this.db.prepare('SELECT email, last_tested_at FROM alegra_connection WHERE id = 1').get() as
      | { email: string; last_tested_at: string | null }
      | undefined;
    return row
      ? { email: row.email, isConfigured: true, lastTestedAt: row.last_tested_at }
      : { email: null, isConfigured: false, lastTestedAt: null };
  }

  /** Cliente de Alegra con las credenciales vigentes, o null si no hay conexión configurada. */
  client(opts: { timeoutMs?: number } = {}): AlegraClient | null {
    const row = this.db.prepare('SELECT email, token_encrypted FROM alegra_connection WHERE id = 1').get() as
      | { email: string; token_encrypted: Buffer }
      | undefined;
    if (!row) return null;
    return new AlegraClient({
      baseUrl: this.config.alegraBaseUrl,
      email: row.email,
      token: decrypt(this.config.encryptionKey, row.token_encrypted),
      timeoutMs: opts.timeoutMs,
    });
  }
}
