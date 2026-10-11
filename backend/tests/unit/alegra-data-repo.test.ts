import { describe, expect, it } from 'vitest';
import { AlegraDataRepo, SNAPSHOT_FORMAT, type AlegraSnapshot } from '../../src/alegra/alegra-data.repo';
import type { SnapshotItem } from '../../src/alegra/alegra.mapper';
import { openDatabase } from '../../src/db/database';

const item = (id: string, over: Partial<SnapshotItem> = {}): SnapshotItem => ({
  id,
  name: `Producto ${id}`,
  description: 'Fideos instantáneos',
  price: 9000,
  soldOut: false,
  categoryId: 'c1',
  categoryName: 'RAMEN',
  type: 'simple',
  hasPhoto: true,
  ...over,
});

const snapshot = (over: Partial<AlegraSnapshot> = {}): AlegraSnapshot => ({
  accountEmail: 'tienda@example.com',
  syncedAt: '2026-10-10T14:02:11.000Z',
  items: [item('1'), item('2', { soldOut: true, hasPhoto: false, categoryId: null, categoryName: null })],
  categories: [
    { id: 'c1', name: 'RAMEN' },
    { id: 'c2', name: 'SNACKS' },
  ],
  ...over,
});

const rows = (db: ReturnType<typeof openDatabase>) =>
  (db.prepare('SELECT COUNT(*) AS n FROM alegra_snapshot').get() as { n: number }).n;

describe('AlegraDataRepo (copia local de Alegra)', () => {
  it('sin copia, read() devuelve null', () => {
    expect(new AlegraDataRepo(openDatabase(':memory:')).read()).toBeNull();
  });

  it('replace() guarda la cuenta, el instante, los artículos y las categorías, y read() los devuelve idénticos', () => {
    const repo = new AlegraDataRepo(openDatabase(':memory:'));
    repo.replace(snapshot());
    expect(repo.read()).toEqual(snapshot());
  });

  it('un segundo replace() reemplaza la copia: queda una sola fila', () => {
    const db = openDatabase(':memory:');
    const repo = new AlegraDataRepo(db);
    repo.replace(snapshot());
    repo.replace(snapshot({ accountEmail: 'otra@example.com', syncedAt: '2026-10-11T08:00:00.000Z', items: [item('9')], categories: [] }));
    expect(rows(db)).toBe(1);
    expect(repo.read()).toEqual({
      accountEmail: 'otra@example.com',
      syncedAt: '2026-10-11T08:00:00.000Z',
      items: [item('9')],
      categories: [],
    });
  });

  it('clear() borra la copia y no falla si no había', () => {
    const db = openDatabase(':memory:');
    const repo = new AlegraDataRepo(db);
    expect(() => repo.clear()).not.toThrow();
    repo.replace(snapshot());
    repo.clear();
    expect(repo.read()).toBeNull();
    expect(rows(db)).toBe(0);
  });

  it('una copia con otro formato se trata como ausente (se vuelve a descargar)', () => {
    const db = openDatabase(':memory:');
    const repo = new AlegraDataRepo(db);
    repo.replace(snapshot());
    db.prepare('UPDATE alegra_snapshot SET format = ?').run(SNAPSHOT_FORMAT + 1);
    expect(repo.read()).toBeNull();
  });

  it('el formato guardado es el del código', () => {
    const db = openDatabase(':memory:');
    new AlegraDataRepo(db).replace(snapshot());
    expect((db.prepare('SELECT format FROM alegra_snapshot').get() as { format: number }).format).toBe(SNAPSHOT_FORMAT);
  });

  it('lo guardado no contiene direcciones de fotos, ni imágenes, ni credenciales (principios I y III)', () => {
    const db = openDatabase(':memory:');
    new AlegraDataRepo(db).replace(snapshot());
    const raw = db.prepare('SELECT * FROM alegra_snapshot').get() as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(['account_email', 'categories_json', 'format', 'id', 'items_json', 'synced_at']);
    const json = `${String(raw.items_json)}${String(raw.categories_json)}`;
    expect(json).not.toMatch(/https?:|images|imageUrl|remoteImageUrl|token|password|Authorization/i);
    expect(JSON.parse(String(raw.items_json))[0]).toHaveProperty('hasPhoto', true);
  });

  it('la tabla solo admite una fila (id = 1)', () => {
    const db = openDatabase(':memory:');
    expect(() =>
      db
        .prepare("INSERT INTO alegra_snapshot (id, account_email, synced_at, format, items_json, categories_json) VALUES (2, 'a', 'b', 1, '[]', '[]')")
        .run(),
    ).toThrow();
  });

  it('un JSON dañado se trata como ausente en lugar de romper las pantallas', () => {
    const db = openDatabase(':memory:');
    const repo = new AlegraDataRepo(db);
    repo.replace(snapshot());
    db.prepare("UPDATE alegra_snapshot SET items_json = '{no es json'").run();
    expect(repo.read()).toBeNull();
  });
});
