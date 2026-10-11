import { describe, expect, it } from 'vitest';
import { AlegraDataRepo } from '../../src/alegra/alegra-data.repo';
import { AlegraDataService, type AlegraSource } from '../../src/alegra/alegra-data.service';
import { AlegraError, type AlegraCategoryRaw, type AlegraItemRaw } from '../../src/alegra/alegra.types';
import { HttpError } from '../../src/api/errors';
import { openDatabase } from '../../src/db/database';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

const categories: AlegraCategoryRaw[] = [
  { id: 'c1', name: 'RAMEN' },
  { id: 2, name: 'SNACKS' },
];
const rawItem = (id: string | number, over: Partial<AlegraItemRaw> = {}): AlegraItemRaw => ({
  id,
  name: `Producto ${id}`,
  description: 'Fideos',
  status: 'active',
  price: 9000,
  category: { id: 'c1', name: 'RAMEN' },
  images: [{ id: 1, name: 'foto.jpg', url: 'https://cdn.example.com/foto.jpg?Signature=abc', favorite: true }],
  ...over,
});

/** Cliente falso: cuenta las llamadas y permite frenar y soltar cada respuesta o hacerla fallar. */
function fakeAlegra() {
  const s = {
    categoryCalls: 0,
    itemCalls: 0,
    fail: null as Error | null,
    categories,
    items: [rawItem('1'), rawItem('2', { category: null })] as AlegraItemRaw[],
    /** Si existe, `listActiveItems` informa esta cantidad y espera antes de terminar. */
    midway: null as null | { received: number; gate: ReturnType<typeof deferred> },
    gate: null as null | ReturnType<typeof deferred>,
  };
  const client: AlegraSource = {
    async listCategories(opts) {
      s.categoryCalls++;
      if (s.gate) await s.gate.promise;
      if (s.fail) throw s.fail;
      opts?.onProgress?.(s.categories.length);
      return s.categories;
    },
    async listActiveItems(opts) {
      s.itemCalls++;
      if (s.midway) {
        opts?.onProgress?.(s.midway.received);
        await s.midway.gate.promise;
      }
      if (s.fail) throw s.fail;
      opts?.onProgress?.(s.items.length);
      return s.items;
    },
  };
  return { s, client };
}

function setup(over: { email?: string | null; hasClient?: boolean } = {}) {
  const db = openDatabase(':memory:');
  const repo = new AlegraDataRepo(db);
  const alegra = fakeAlegra();
  let email: string | null = over.email === undefined ? 'tienda@example.com' : over.email;
  let clock = new Date('2026-10-10T14:00:00.000Z');
  const service = new AlegraDataService({
    repo,
    client: () => (over.hasClient === false ? null : alegra.client),
    email: () => email,
    now: () => clock,
  });
  return {
    db,
    repo,
    service,
    alegra: alegra.s,
    setEmail: (e: string | null) => (email = e),
    tick: (ms: number) => (clock = new Date(clock.getTime() + ms)),
  };
}

describe('AlegraDataService', () => {
  describe('get()', () => {
    it('sin copia descarga una vez, la guarda, y la segunda llamada no descarga', async () => {
      const { service, alegra, repo } = setup();
      const first = await service.get();
      expect(alegra.categoryCalls).toBe(1);
      expect(alegra.itemCalls).toBe(1);
      expect(first.items.map((i) => i.id)).toEqual(['1', '2']);
      expect(first.categories).toEqual([
        { id: 'c1', name: 'RAMEN' },
        { id: '2', name: 'SNACKS' },
      ]);
      expect(first.syncedAt).toBe('2026-10-10T14:00:00.000Z');
      expect(repo.read()).not.toBeNull();

      const second = await service.get();
      expect(alegra.categoryCalls).toBe(1);
      expect(alegra.itemCalls).toBe(1);
      expect(second).toEqual(first);
    });

    it('dos llamadas simultáneas sin copia comparten la misma descarga', async () => {
      const { service, alegra } = setup();
      alegra.gate = deferred();
      const a = service.get();
      const b = service.get();
      alegra.gate.resolve();
      const [ra, rb] = await Promise.all([a, b]);
      expect(alegra.categoryCalls).toBe(1);
      expect(alegra.itemCalls).toBe(1);
      expect(ra).toEqual(rb);
    });

    it('con copia nunca consulta a Alegra, aunque el cliente falle', async () => {
      const { service, alegra } = setup();
      await service.get();
      alegra.fail = new AlegraError('unreachable', 'No se pudo conectar con Alegra.');
      await expect(service.get()).resolves.toBeDefined();
      expect(alegra.categoryCalls).toBe(1);
    });

    it('si falla sin copia, propaga el error de Alegra y el estado vuelve a «none»', async () => {
      const { service, alegra } = setup();
      alegra.fail = new AlegraError('rejected', 'Alegra rechazó las credenciales.', 401);
      await expect(service.get()).rejects.toMatchObject({ kind: 'rejected' });
      expect(service.status().state).toBe('none');
      expect(service.status().lastError?.message).toBe('Alegra rechazó las credenciales.');
    });

    it('después de un fallo sin copia, la siguiente lectura vuelve a intentar', async () => {
      const { service, alegra } = setup();
      alegra.fail = new AlegraError('unreachable', 'No se pudo conectar con Alegra.');
      await expect(service.get()).rejects.toBeDefined();
      alegra.fail = null;
      await expect(service.get()).resolves.toBeDefined();
      expect(alegra.categoryCalls).toBe(2); // el primer intento cayó en las categorías, el segundo descargó todo
      expect(alegra.itemCalls).toBe(1);
      expect(service.status().lastError).toBeNull();
    });

    it('sin conexión configurada lanza alegra_not_configured', async () => {
      const { service } = setup({ hasClient: false, email: null });
      await expect(service.get()).rejects.toMatchObject({ status: 422, code: 'alegra_not_configured' });
      await expect(service.get()).rejects.toBeInstanceOf(HttpError);
    });

    it('si el correo de la conexión no es el de la copia, la trata como ausente y descarga', async () => {
      const { service, alegra, setEmail, repo } = setup();
      await service.get();
      setEmail('otra@example.com');
      expect(service.status().state).toBe('none');
      await service.get();
      expect(alegra.itemCalls).toBe(2);
      expect(repo.read()?.accountEmail).toBe('otra@example.com');
    });

    it('el correo se compara sin distinguir mayúsculas y se guarda en minúsculas', async () => {
      const { service, alegra, setEmail, repo } = setup({ email: 'Tienda@Example.com' });
      await service.get();
      expect(repo.read()?.accountEmail).toBe('tienda@example.com');
      setEmail('TIENDA@example.COM');
      await service.get();
      expect(alegra.itemCalls).toBe(1);
    });
  });

  describe('refresh() y start()', () => {
    it('refresh() reemplaza la copia y limpia lastError', async () => {
      const { service, alegra, tick } = setup();
      await service.get();
      alegra.fail = new AlegraError('unreachable', 'No se pudo conectar con Alegra.');
      await expect(service.refresh()).rejects.toBeDefined();
      expect(service.status().lastError).not.toBeNull();

      alegra.fail = null;
      alegra.items = [rawItem('1', { price: 12000 })];
      tick(60_000);
      const fresh = await service.refresh();
      expect(fresh.items).toHaveLength(1);
      expect(fresh.items[0]!.price).toBe(12000);
      expect(fresh.syncedAt).toBe('2026-10-10T14:01:00.000Z');
      expect(service.status()).toMatchObject({ state: 'ready', lastError: null, syncedAt: '2026-10-10T14:01:00.000Z', articles: 1 });
    });

    it('si falla, la copia anterior queda intacta, lastError trae el mensaje y la hora, y la excepción se propaga', async () => {
      const { service, alegra, repo, tick } = setup();
      await service.get();
      const before = repo.read();
      alegra.fail = new AlegraError('unreachable', 'No se pudo conectar con Alegra.');
      alegra.items = [rawItem('99')];
      tick(5000);
      await expect(service.refresh()).rejects.toMatchObject({ kind: 'unreachable' });
      expect(repo.read()).toEqual(before);
      const st = service.status();
      expect(st.state).toBe('ready');
      expect(st.syncedAt).toBe(before!.syncedAt);
      expect(st.lastError).toEqual({ message: 'No se pudo conectar con Alegra.', at: '2026-10-10T14:00:05.000Z' });
      expect((await service.get()).items.map((i) => i.id)).toEqual(['1', '2']);
    });

    it('start() no propaga el fallo: lo registra', async () => {
      const { service, alegra } = setup();
      alegra.fail = new AlegraError('rate_limit', 'Alegra limitó las peticiones. Intenta de nuevo en un momento.', 429);
      service.start();
      await new Promise((r) => setTimeout(r, 10));
      expect(service.status().lastError?.message).toMatch(/limitó las peticiones/);
      expect(service.status().state).toBe('none');
    });

    it('start() sin conexión configurada no hace nada ni lanza', async () => {
      const { service } = setup({ hasClient: false, email: null });
      expect(() => service.start()).not.toThrow();
      await new Promise((r) => setTimeout(r, 5));
      expect(service.status().state).toBe('none');
    });

    it('una segunda refresh() mientras hay una en curso devuelve la misma promesa y descarga una sola vez', async () => {
      const { service, alegra } = setup();
      alegra.gate = deferred();
      const a = service.refresh();
      const b = service.refresh();
      expect(b).toBe(a);
      alegra.gate.resolve();
      await a;
      expect(alegra.itemCalls).toBe(1);
    });

    it('get() durante una actualización con copia sirve la copia vigente sin esperar', async () => {
      const { service, alegra } = setup();
      await service.get();
      alegra.gate = deferred();
      const refreshing = service.refresh();
      const during = await service.get();
      expect(during.items).toHaveLength(2);
      alegra.gate.resolve();
      await refreshing;
    });
  });

  describe('status()', () => {
    it('sin copia ni descarga es «none» con todo vacío', () => {
      expect(setup().service.status()).toEqual({ state: 'none', syncedAt: null, articles: null, categories: null, progress: null, lastError: null });
    });

    it('con copia es «ready» con cuántos artículos activos (sin padres de variantes) y categorías', async () => {
      const { service, alegra } = setup();
      alegra.items = [rawItem('1'), rawItem('2', { type: 'variantParent' }), rawItem('3', { type: 'variant' })];
      await service.get();
      expect(service.status()).toMatchObject({ state: 'ready', articles: 2, categories: 2, progress: null, lastError: null });
    });

    it('durante la descarga es «syncing» con la fase y lo recibido, y conserva el instante de la copia anterior', async () => {
      const { service, alegra, tick } = setup();
      await service.get();
      const syncedBefore = service.status().syncedAt;
      tick(10_000);
      alegra.midway = { received: 90, gate: deferred() };
      const refreshing = service.refresh();
      await new Promise((r) => setTimeout(r, 5));
      const mid = service.status();
      expect(mid.state).toBe('syncing');
      expect(mid.syncedAt).toBe(syncedBefore);
      expect(mid.progress).toEqual({ phase: 'items', received: 90 });
      alegra.midway.gate.resolve();
      await refreshing;
      const done = service.status();
      expect(done.state).toBe('ready');
      expect(done.progress).toBeNull();
      expect(done.syncedAt).not.toBe(syncedBefore);
    });

    it('la fase de categorías y la de artículos cuentan lo recibido por separado y crecen', async () => {
      const { service, alegra } = setup();
      alegra.gate = deferred();
      const first = service.get();
      await new Promise((r) => setTimeout(r, 5));
      expect(service.status()).toMatchObject({ state: 'syncing', syncedAt: null, progress: { phase: 'categories', received: 0 } });
      alegra.gate.resolve();
      await first;
    });
  });

  describe('store() y discard()', () => {
    it('store() guarda sin llamar al cliente: mapea a artículos con hasPhoto, ids como texto y sin direcciones', () => {
      const { service, alegra, repo } = setup();
      service.store(categories, [
        rawItem(7),
        rawItem(8, { images: [] }),
        rawItem(9, { type: 'variantParent' }),
        rawItem(10, { inventory: { availableQuantity: 0, trackInventory: true } }),
      ]);
      expect(alegra.categoryCalls).toBe(0);
      expect(alegra.itemCalls).toBe(0);
      const saved = repo.read()!;
      expect(saved.items.map((i) => [i.id, i.hasPhoto, i.soldOut, i.type])).toEqual([
        ['7', true, false, 'simple'],
        ['8', false, false, 'simple'],
        ['9', true, false, 'variantParent'],
        ['10', true, true, 'simple'],
      ]);
      expect(saved.categories).toEqual([
        { id: 'c1', name: 'RAMEN' },
        { id: '2', name: 'SNACKS' },
      ]);
      expect(JSON.stringify(saved)).not.toMatch(/https?:|cdn\.example|Signature/);
      expect(service.status()).toMatchObject({ state: 'ready', articles: 3, categories: 2 });
    });

    it('store() limpia lastError y el estado «syncing» no se ve afectado por una lectura posterior', async () => {
      const { service, alegra } = setup();
      alegra.fail = new AlegraError('unreachable', 'No se pudo conectar con Alegra.');
      await expect(service.get()).rejects.toBeDefined();
      service.store(categories, [rawItem('1')]);
      expect(service.status().lastError).toBeNull();
      expect((await service.get()).items).toHaveLength(1);
    });

    it('lo guardado por store() se lee como NormalizedItem: la marca de foto cuenta como foto, sin dirección', async () => {
      const { service } = setup();
      service.store(categories, [rawItem('1'), rawItem('2', { images: [] })]);
      const { items } = await service.get();
      expect(items[0]!.remoteImageUrl).toBeTruthy();
      expect(items[0]!.remoteImageUrl).not.toMatch(/^https?:/);
      expect(items[0]!.imageUrls).toBeUndefined();
      expect(items[1]!.remoteImageUrl).toBeNull();
    });

    it('store() sin conexión configurada no guarda nada (no sabe de qué cuenta son los datos)', () => {
      const { service, repo } = setup({ email: null, hasClient: false });
      service.store(categories, [rawItem('1')]);
      expect(repo.read()).toBeNull();
    });

    it('discard() borra la copia: el estado vuelve a «none» y la siguiente lectura descarga', async () => {
      const { service, alegra } = setup();
      await service.get();
      service.discard();
      expect(service.status()).toMatchObject({ state: 'none', syncedAt: null, articles: null });
      await service.get();
      expect(alegra.itemCalls).toBe(2);
    });

    it('discard() sin copia no falla', () => {
      expect(() => setup().service.discard()).not.toThrow();
    });
  });
});
