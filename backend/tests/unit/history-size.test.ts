import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/database';
import { HistoryRepo } from '../../src/pdf/history.repo';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-hist-'));
  dirs.push(dir);
  const db = openDatabase(':memory:');
  return { db, repo: new HistoryRepo(db, dir) };
}

const pdf = (bytes: number) => Buffer.from('%PDF-1.4 ' + 'x'.repeat(bytes - 9));

describe('tamaño de cada catálogo del historial (FR-011)', () => {
  it('al guardar un catálogo devuelve el tamaño del PDF', () => {
    const { repo } = setup();
    const entry = repo.add(pdf(2048), 3, 1, { pages: 5, quality: 'optimized' });
    expect(entry.sizeBytes).toBe(2048);
  });

  it('al listar lee el tamaño del archivo guardado', () => {
    const { repo } = setup();
    repo.add(pdf(1000), 3, 1, { pages: 5 });
    repo.add(pdf(5000), 4, 0, { pages: 7 });
    const sizes = repo.list().map((e) => e.sizeBytes);
    expect(sizes.sort()).toEqual([1000, 5000]);
  });

  it('si el archivo ya no existe no lanza y esa entrada no trae sizeBytes (la pantalla muestra «—»)', () => {
    const { repo } = setup();
    const kept = repo.add(pdf(1500), 1, 0, {});
    const lost = repo.add(pdf(3000), 2, 0, {});
    fs.rmSync(repo.filePath(lost.id)!);

    const list = repo.list();
    expect(list).toHaveLength(2);
    const lostEntry = list.find((e) => e.id === lost.id)!;
    expect('sizeBytes' in lostEntry).toBe(false);
    expect(list.find((e) => e.id === kept.id)!.sizeBytes).toBe(1500);
  });

  it('un catálogo anterior, guardado sin calidad ni páginas, se lista igual y con su tamaño real', () => {
    const { repo } = setup();
    repo.add(pdf(777), 10, 2, {});
    const [entry] = repo.list();
    expect(entry).toMatchObject({ includedCount: 10, omittedCount: 2, sizeBytes: 777 });
    expect(entry!.pages).toBeUndefined();
  });

  it('la calidad usada se conserva en params_json sin cambiar las demás claves', () => {
    const { db, repo } = setup();
    const entry = repo.add(pdf(900), 3, 1, { options: { hideSoldOut: false }, decisions: {}, pages: 9, quality: 'original' });
    const row = db.prepare('SELECT params_json FROM generated_catalog WHERE id = ?').get(entry.id) as { params_json: string };
    expect(JSON.parse(row.params_json)).toEqual({ options: { hideSoldOut: false }, decisions: {}, pages: 9, quality: 'original' });
    expect(entry.pages).toBe(9);
  });
});
