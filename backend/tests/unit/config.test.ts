import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_SEED, loadConfig } from '../../src/config/env';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-cfg-'));

describe('loadConfig sin .env', () => {
  it('arranca sin ninguna variable: usa el acceso semilla y genera la clave de cifrado', () => {
    const dataDir = tmp();
    const cfg = loadConfig({ DATA_DIR: dataDir });
    expect(cfg.seedUsername).toBe(DEFAULT_SEED.username);
    expect(cfg.seedPassword).toBe(DEFAULT_SEED.password);
    expect(cfg.port).toBe(3000);
    expect(cfg.encryptionKey).toHaveLength(32);
    expect(fs.existsSync(path.join(dataDir, 'encryption.key'))).toBe(true);
  });

  it('reutiliza la misma clave en los siguientes arranques (el token guardado sigue descifrable)', () => {
    const dataDir = tmp();
    const a = loadConfig({ DATA_DIR: dataDir });
    const b = loadConfig({ DATA_DIR: dataDir });
    expect(a.encryptionKey.equals(b.encryptionKey)).toBe(true);
  });

  it('las variables, si existen, tienen prioridad', () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const cfg = loadConfig({
      DATA_DIR: tmp(),
      SEED_USERNAME: 'tienda',
      SEED_PASSWORD: 'otra',
      ENCRYPTION_KEY: key,
      PORT: '4000',
    });
    expect(cfg).toMatchObject({ seedUsername: 'tienda', seedPassword: 'otra', port: 4000 });
    expect(cfg.encryptionKey.toString('base64')).toBe(key);
  });

  it('rechaza una ENCRYPTION_KEY inválida, un puerto inválido y un archivo de clave dañado', () => {
    expect(() => loadConfig({ DATA_DIR: tmp(), ENCRYPTION_KEY: 'corta' })).toThrow(ConfigError);
    expect(() => loadConfig({ DATA_DIR: tmp(), PORT: 'abc' })).toThrow(ConfigError);
    const dataDir = tmp();
    fs.writeFileSync(path.join(dataDir, 'encryption.key'), 'dañado');
    expect(() => loadConfig({ DATA_DIR: dataDir })).toThrow(ConfigError);
  });
});
