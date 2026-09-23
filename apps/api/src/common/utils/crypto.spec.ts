import { decryptField, encryptField, sha256, stableStringify } from './crypto';

describe('crypto utils', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('encrypts and decrypts fields with AES-256-GCM', () => {
    const enc = encryptField('JBSWY3DPEHPK3PXP', key);
    expect(enc).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptField(enc, key)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('detects tampering', () => {
    const enc = Buffer.from(encryptField('secret', key), 'base64');
    enc[enc.length - 1] ^= 0xff;
    expect(() => decryptField(enc.toString('base64'), key)).toThrow();
  });

  it('rejects wrong key sizes', () => {
    expect(() => encryptField('x', Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
  });

  it('produces stable content hashes regardless of key order', () => {
    const a = sha256(stableStringify({ plan: 'rest', subjective: 'x', nested: { b: 1, a: 2 } }));
    const b = sha256(stableStringify({ nested: { a: 2, b: 1 }, subjective: 'x', plan: 'rest' }));
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});
