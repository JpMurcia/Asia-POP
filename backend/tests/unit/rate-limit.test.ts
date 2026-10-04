import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../src/api/errors';
import { rateLimit } from '../../src/auth/middleware';

const req = (ip: string) => ({ ip }) as Request;

/** Pasa una petición por el limitador y devuelve el error que pasó a `next` (si lo hubo). */
function hit(limiter: ReturnType<typeof rateLimit>, ip = '1.1.1.1'): unknown {
  const next = vi.fn();
  limiter(req(ip), {} as never, next);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0]![0];
}

describe('rateLimit', () => {
  it('deja pasar hasta el máximo y luego responde 429 (comportamiento sin cambios)', () => {
    const limiter = rateLimit(3, 60_000, () => 0);
    for (let i = 0; i < 3; i++) expect(hit(limiter)).toBeUndefined();
    const error = hit(limiter) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(429);
    expect(error.code).toBe('too_many_requests');
  });

  it('es una ventana deslizante: los intentos viejos dejan de contar', () => {
    let now = 0;
    const limiter = rateLimit(2, 1000, () => now);
    hit(limiter);
    now = 600;
    hit(limiter);
    expect((hit(limiter) as HttpError).status).toBe(429);
    now = 1001; // salió el primero
    expect(hit(limiter)).toBeUndefined();
  });

  it('cuenta por IP', () => {
    const limiter = rateLimit(1, 60_000, () => 0);
    expect(hit(limiter, '1.1.1.1')).toBeUndefined();
    expect((hit(limiter, '1.1.1.1') as HttpError).status).toBe(429);
    expect(hit(limiter, '2.2.2.2')).toBeUndefined();
  });

  describe('remaining(req) (FR-035)', () => {
    it('expone el límite y arranca con todos los intentos', () => {
      const limiter = rateLimit(10, 60_000, () => 0);
      expect(limiter.limit).toBe(10);
      expect(limiter.remaining(req('1.1.1.1'))).toBe(10);
    });

    it('baja con cada intento y llega a 0 sin pasar a negativo', () => {
      const limiter = rateLimit(3, 60_000, () => 0);
      const seen: number[] = [];
      for (let i = 0; i < 5; i++) {
        hit(limiter);
        seen.push(limiter.remaining(req('1.1.1.1')));
      }
      expect(seen).toEqual([2, 1, 0, 0, 0]);
    });

    it('consultarlo no consume un intento', () => {
      const limiter = rateLimit(2, 60_000, () => 0);
      for (let i = 0; i < 10; i++) limiter.remaining(req('1.1.1.1'));
      expect(hit(limiter)).toBeUndefined();
      expect(hit(limiter)).toBeUndefined();
      expect((hit(limiter) as HttpError).status).toBe(429);
    });

    it('un intento rechazado (429) tampoco consume uno', () => {
      const limiter = rateLimit(1, 1000, () => 0);
      hit(limiter);
      for (let i = 0; i < 5; i++) hit(limiter);
      expect(limiter.remaining(req('1.1.1.1'))).toBe(0);
    });

    it('se recupera al salir los intentos de la ventana', () => {
      let now = 0;
      const limiter = rateLimit(2, 1000, () => now);
      hit(limiter);
      hit(limiter);
      expect(limiter.remaining(req('1.1.1.1'))).toBe(0);
      now = 1000;
      expect(limiter.remaining(req('1.1.1.1'))).toBe(2);
    });

    it('cuenta por IP', () => {
      const limiter = rateLimit(5, 60_000, () => 0);
      hit(limiter, '1.1.1.1');
      hit(limiter, '1.1.1.1');
      expect(limiter.remaining(req('1.1.1.1'))).toBe(3);
      expect(limiter.remaining(req('2.2.2.2'))).toBe(5);
    });

    it('sin IP usa la misma clave local que el limitador', () => {
      const limiter = rateLimit(4, 60_000, () => 0);
      const noIp = {} as Request;
      limiter(noIp, {} as never, vi.fn());
      expect(limiter.remaining(noIp)).toBe(3);
      expect(limiter.remaining(req('1.1.1.1'))).toBe(4);
    });
  });
});
