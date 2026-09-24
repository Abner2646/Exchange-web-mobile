const { authenticator } = require('otplib');
const totp = require('./totp.service');

describe('TOTP service', () => {
  it('generateEnrollmentSecret returns a secret and an otpauth URI with issuer + account', () => {
    const { secret, otpauthUri, issuer } = totp.generateEnrollmentSecret('alice@example.com');
    expect(typeof secret).toBe('string');
    expect(secret.length).toBeGreaterThan(0);
    expect(otpauthUri).toMatch(/^otpauth:\/\/totp\//);
    expect(otpauthUri).toContain('alice%40example.com'); // account, url-encoded @
    expect(otpauthUri).toContain(issuer);
  });

  it('verifyToken accepts a token generated from the secret and rejects a wrong one', () => {
    const { secret } = totp.generateEnrollmentSecret('bob@example.com');
    const validToken = authenticator.generate(secret);
    expect(totp.verifyToken(validToken, secret)).toBe(true);

    // A different token must not verify.
    const wrong = validToken === '000000' ? '111111' : '000000';
    expect(totp.verifyToken(wrong, secret)).toBe(false);
  });

  it('verifyToken fails closed (returns false, never throws) on missing or malformed input', () => {
    expect(totp.verifyToken(null, 'SECRET')).toBe(false);
    expect(totp.verifyToken('123456', null)).toBe(false);
    expect(totp.verifyToken(undefined, undefined)).toBe(false);
    expect(totp.verifyToken('123456', 'not-a-valid-base32-secret!!')).toBe(false);
  });

  it('generateQrDataUrl produces a PNG data URL from the otpauth URI', async () => {
    const { otpauthUri } = totp.generateEnrollmentSecret('carol@example.com');
    const dataUrl = await totp.generateQrDataUrl(otpauthUri);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
