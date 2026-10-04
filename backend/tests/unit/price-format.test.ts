import { describe, expect, it } from 'vitest';
import { formatCop } from '../../src/catalog/price-format';

describe('formatCop', () => {
  it.each([
    [800, '$800'],
    [9000, '$9.000'],
    [15000, '$15.000'],
    [1250000, '$1.250.000'],
    [0, '$0'],
    [8999.6, '$9.000'],
  ])('%s -> %s', (n, expected) => {
    expect(formatCop(n)).toBe(expected);
  });
});
