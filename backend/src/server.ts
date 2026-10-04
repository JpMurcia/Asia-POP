import path from 'node:path';
import { createApp } from './app';
import { ConfigError, loadConfig, loadDotEnv } from './config/env';
import { createContext } from './context';
import { openDatabase } from './db/database';
import { listenLocal } from './listen';

async function main(): Promise<void> {
  loadDotEnv();
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(`Configuración inválida: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }

  const db = openDatabase(path.join(config.dataDir, 'app.db'));
  const ctx = createContext(config, db);
  const server = await listenLocal(createApp(ctx), ctx);
  console.log(`Servidor listo en http://localhost:${config.port}`);

  const shutdown = async () => {
    server.close();
    await ctx.renderer.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
