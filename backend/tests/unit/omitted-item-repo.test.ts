import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OmittedItemRepo, omittedSignature } from '../../src/custom/omitted-item.repo';
import { openDatabase } from '../../src/db/database';

describe('OmittedItemRepo', () => {
  it('empieza vacío', () => {
    const repo = new OmittedItemRepo(openDatabase(':memory:'));
    expect(repo.all()).toEqual(new Set());
  });

  it('agrega y quita artículos', () => {
    const repo = new OmittedItemRepo(openDatabase(':memory:'));
    repo.add('10');
    repo.add('20');
    expect(repo.all()).toEqual(new Set(['10', '20']));
    repo.remove('10');
    expect(repo.all()).toEqual(new Set(['20']));
  });

  it('agregar dos veces el mismo artículo no falla ni lo duplica (idempotente)', () => {
    const repo = new OmittedItemRepo(openDatabase(':memory:'));
    repo.add('10');
    expect(() => repo.add('10')).not.toThrow();
    expect(repo.all().size).toBe(1);
  });

  it('quitar un artículo que no estaba omitido no falla', () => {
    const repo = new OmittedItemRepo(openDatabase(':memory:'));
    expect(() => repo.remove('99')).not.toThrow();
    expect(repo.all().size).toBe(0);
  });

  it('los identificadores son siempre texto', () => {
    const repo = new OmittedItemRepo(openDatabase(':memory:'));
    repo.add('10');
    const [id] = [...repo.all()];
    expect(typeof id).toBe('string');
    expect(repo.all().has('10')).toBe(true);
  });

  it('la lista persiste al cerrar y volver a abrir la base (FR-004, SC-003)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asiapop-omitted-'));
    const file = path.join(dir, 'app.db');
    try {
      const first = openDatabase(file);
      new OmittedItemRepo(first).add('10');
      new OmittedItemRepo(first).add('20');
      first.close();

      // La migración ya está aplicada: reabrir no la repite ni borra nada
      const second = openDatabase(file);
      expect(new OmittedItemRepo(second).all()).toEqual(new Set(['10', '20']));
      second.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('omittedSignature', () => {
  it('no depende del orden ni de los duplicados', () => {
    expect(omittedSignature(['2', '1', '1'])).toBe(omittedSignature(['1', '2']));
    expect(omittedSignature(new Set(['b', 'a']))).toBe(omittedSignature(['a', 'b']));
  });

  it('listas distintas dan firmas distintas', () => {
    expect(omittedSignature(['1'])).not.toBe(omittedSignature(['1', '2']));
    expect(omittedSignature(['1'])).not.toBe(omittedSignature(['2']));
    expect(omittedSignature(['1', '2'])).not.toBe(omittedSignature([]));
  });

  it('la lista vacía tiene una firma estable', () => {
    expect(omittedSignature([])).toBe(omittedSignature(new Set()));
    expect(typeof omittedSignature([])).toBe('string');
  });

  it('dos identificadores distintos no se confunden con uno solo que los junta', () => {
    expect(omittedSignature(['1', '2'])).not.toBe(omittedSignature(['1,2']));
  });
});
