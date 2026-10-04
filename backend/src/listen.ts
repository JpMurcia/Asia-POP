import type { Express } from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { AppContext } from './context';

/** Dirección de escucha: solo este equipo (principio III). */
export const LISTEN_HOST = '127.0.0.1';

/** Inicia el servidor en loopback y registra la URL local que usa el navegador headless. */
export function listenLocal(app: Express, ctx: AppContext, port = ctx.config.port): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(port, LISTEN_HOST, () => {
      ctx.runtime.baseUrl = `http://${LISTEN_HOST}:${(server.address() as AddressInfo).port}`;
      resolve(server);
    });
  });
}
