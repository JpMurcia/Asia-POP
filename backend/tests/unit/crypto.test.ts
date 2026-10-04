import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { decrypt, encrypt } from '../../src/config/crypto';

const key = crypto.randomBytes(32);

describe('crypto AES-256-GCM', () => {
  it('descifra lo que cifró (ida y vuelta)', () => {
    const enc = encrypt(key, 'tok_secreto_123');
    expect(enc.toString('utf8')).not.toContain('tok_secreto_123');
    expect(decrypt(key, enc)).toBe('tok_secreto_123');
  });

  it('produce cifrados distintos para el mismo texto (iv aleatorio)', () => {
    expect(encrypt(key, 'a').equals(encrypt(key, 'a'))).toBe(false);
  });

  it('falla si el cifrado fue alterado', () => {
    const enc = encrypt(key, 'tok');
    enc[enc.length - 1] = (enc[enc.length - 1] ?? 0) ^ 0xff;
    expect(() => decrypt(key, enc)).toThrow();
  });

  it('falla con otra clave', () => {
    expect(() => decrypt(crypto.randomBytes(32), encrypt(key, 'tok'))).toThrow();
  });
});
