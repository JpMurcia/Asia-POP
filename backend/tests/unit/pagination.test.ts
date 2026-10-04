import { describe, expect, it } from 'vitest';
import { chunk } from '../../src/catalog/catalog-builder';

describe('chunk (máx. 3 por página, FR-009)', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it.each([
    [0, []],
    [1, [[1]]],
    [3, [[1, 2, 3]]],
    [4, [[1, 2, 3], [4]]],
    [7, [[1, 2, 3], [4, 5, 6], [7]]],
  ])('%s elementos', (n, expected) => {
    expect(chunk(list(n))).toEqual(expected);
  });

  it('ninguna página supera 3 elementos', () => {
    expect(chunk(list(100)).every((p) => p.length <= 3)).toBe(true);
  });
});
