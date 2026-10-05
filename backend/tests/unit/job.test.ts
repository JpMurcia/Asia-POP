import { describe, expect, it } from 'vitest';
import { JobManager } from '../../src/pdf/job';

describe('JobManager: resultado de un trabajo terminado', () => {
  it('complete guarda el tamaño del PDF y la calidad con la que se generó', () => {
    const jobs = new JobManager();
    const id = jobs.acquire('rendering', 'Generando PDF');
    jobs.complete(id, 'cat-1', { sizeBytes: 19_320_118, quality: 'optimized' });
    expect(jobs.current()).toEqual({
      id,
      status: 'done',
      step: 'Catálogo listo',
      progress: 100,
      catalogId: 'cat-1',
      sizeBytes: 19_320_118,
      quality: 'optimized',
    });
  });

  it('también guarda la calidad Original', () => {
    const jobs = new JobManager();
    const id = jobs.acquire('rendering', 'Generando PDF');
    jobs.complete(id, 'cat-2', { sizeBytes: 163_999_000, quality: 'original' });
    expect(jobs.current()).toMatchObject({ status: 'done', sizeBytes: 163_999_000, quality: 'original' });
  });

  it('sin datos adicionales sigue funcionando y no inventa tamaño ni calidad', () => {
    const jobs = new JobManager();
    const id = jobs.acquire('rendering', 'Generando PDF');
    jobs.complete(id, 'cat-3');
    const state = jobs.current();
    expect(state).toMatchObject({ status: 'done', catalogId: 'cat-3' });
    expect(state).not.toHaveProperty('sizeBytes');
    expect(state).not.toHaveProperty('quality');
  });

  it('en reposo, preparando, renderizando y fallido no hay tamaño ni calidad', () => {
    const jobs = new JobManager();
    expect(jobs.current()).not.toHaveProperty('sizeBytes');

    const prep = jobs.acquire('preparing', 'Consultando Alegra');
    expect(jobs.current()).not.toHaveProperty('sizeBytes');
    jobs.release(prep);

    const render = jobs.acquire('rendering', 'Generando PDF');
    expect(jobs.current()).not.toHaveProperty('sizeBytes');
    expect(jobs.current()).not.toHaveProperty('quality');

    jobs.fail(render, 'se cayó el render');
    const failed = jobs.current();
    expect(failed.status).toBe('failed');
    expect(failed).not.toHaveProperty('sizeBytes');
    expect(failed).not.toHaveProperty('quality');
  });

  it('un trabajo anterior no cambia el estado del actual', () => {
    const jobs = new JobManager();
    const old = jobs.acquire('rendering', 'Generando PDF');
    jobs.fail(old, 'error');
    const current = jobs.acquire('rendering', 'Generando PDF');
    jobs.complete(old, 'cat-viejo', { sizeBytes: 1, quality: 'optimized' });
    expect(jobs.current()).toMatchObject({ id: current, status: 'rendering' });
    expect(jobs.current()).not.toHaveProperty('sizeBytes');
  });

  it('current devuelve una copia: modificarla no altera el estado', () => {
    const jobs = new JobManager();
    const id = jobs.acquire('rendering', 'Generando PDF');
    jobs.complete(id, 'cat-4', { sizeBytes: 10, quality: 'optimized' });
    const copy = jobs.current();
    copy.sizeBytes = 999;
    expect(jobs.current().sizeBytes).toBe(10);
  });
});
