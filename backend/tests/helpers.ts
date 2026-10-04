import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import type { AppConfig } from '../src/config/env';
import { createContext, type AppContext } from '../src/context';
import { openDatabase } from '../src/db/database';
import type { PdfRenderer } from '../src/pdf/pdf.service';

export const SEED = { username: 'tienda', password: 'clave-semilla-test' };

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    seedUsername: SEED.username,
    seedPassword: SEED.password,
    encryptionKey: crypto.randomBytes(32),
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-')),
    alegraBaseUrl: 'http://127.0.0.1:1',
    frontendDir: '',
    ...overrides,
  };
}

/** Renderizador falso: devuelve un PDF mínimo sin abrir navegador. */
export class FakeRenderer implements PdfRenderer {
  calls: { url: string; sessionId: string }[] = [];
  fail = false;
  delayMs = 0;
  async render(url: string, sessionId: string): Promise<Buffer> {
    this.calls.push({ url, sessionId });
    if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
    if (this.fail) throw new Error('fallo de renderizado simulado');
    return Buffer.from('%PDF-1.4 fake');
  }
  async close(): Promise<void> {}
}

export function testContext(overrides: Partial<AppContext> = {}): AppContext {
  const config = overrides.config ?? testConfig();
  return createContext(config, overrides.db ?? openDatabase(':memory:'), {
    renderer: new FakeRenderer(),
    ...overrides,
  });
}

/** Crea la app, inicia sesión y devuelve un agente con la cookie de sesión. */
export async function loggedInAgent(ctx: AppContext = testContext()) {
  const app = createApp(ctx);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send(SEED).expect(204);
  return { app, agent, ctx };
}
