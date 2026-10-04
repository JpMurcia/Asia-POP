import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export interface AppConfig {
  port: number;
  seedUsername: string;
  seedPassword: string;
  encryptionKey: Buffer;
  dataDir: string;
  alegraBaseUrl: string;
  chromePath?: string;
  frontendDir: string;
}

export class ConfigError extends Error {}

/** Acceso semilla por defecto (fijo). Se puede sobrescribir con SEED_USERNAME / SEED_PASSWORD en `.env`. */
export const DEFAULT_SEED = { username: 'admin', password: 'AsiaPop2026' };

/**
 * Clave de cifrado del token de Alegra. Si no viene en `ENCRYPTION_KEY`, se genera una vez y se guarda
 * en `data/encryption.key` (solo lectura para el usuario); así la app arranca sin configurar nada.
 */
function resolveEncryptionKey(envKey: string | undefined, dataDir: string): Buffer {
  if (envKey?.trim()) {
    const key = Buffer.from(envKey.trim(), 'base64');
    if (key.length !== 32) {
      throw new ConfigError(
        'ENCRYPTION_KEY de tu archivo .env no es válida (debe ser de 32 bytes en base64). ' +
          'Borra esa línea del .env y la app generará una sola.',
      );
    }
    return key;
  }
  const file = path.join(dataDir, 'encryption.key');
  if (fs.existsSync(file)) {
    const key = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
    if (key.length !== 32) throw new ConfigError(`El archivo ${file} está dañado. Bórralo y vuelve a guardar el token de Alegra.`);
    return key;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const key = crypto.randomBytes(32);
  fs.writeFileSync(file, key.toString('base64'), { mode: 0o600 });
  return key;
}

/** Carga la configuración. Todas las variables son opcionales: la app arranca sin `.env`. */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigError('PORT inválido.');
  }
  const dataDir = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ROOT_DIR, 'data');
  return {
    port,
    seedUsername: env.SEED_USERNAME?.trim() || DEFAULT_SEED.username,
    seedPassword: env.SEED_PASSWORD?.trim() || DEFAULT_SEED.password,
    encryptionKey: resolveEncryptionKey(env.ENCRYPTION_KEY, dataDir),
    dataDir,
    alegraBaseUrl: (env.ALEGRA_BASE_URL ?? 'https://api.alegra.com/api/v1').replace(/\/+$/, ''),
    chromePath: env.PUPPETEER_EXECUTABLE_PATH || undefined,
    frontendDir: path.join(ROOT_DIR, 'frontend', 'dist'),
  };
}

/** Carga `.env` de la raíz del repositorio si existe (no sobreescribe variables ya definidas). */
export function loadDotEnv(): void {
  const file = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
