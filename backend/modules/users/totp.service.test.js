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

  describe('user orchestration', () => {
    const fakeUser = (overrides = {}) => ({
      id: 'u1', email: 'u@x.com', username: 'u', totpSecret: null, totpEnabled: false,
      update: jest.fn().mockImplementation(function (patch) { Object.assign(this, patch); return this; }),
      ...overrides,
    });

    it('beginEnrollment persists a pending secret and returns a URI + QR, without enabling', async () => {
      const user = fakeUser();
      const { otpauthUri, secret, qr } = await totp.beginEnrollment(user);
      expect(user.update).toHaveBeenCalledWith({ totpSecret: secret });
      expect(user.totpEnabled).toBe(false); // still pending
      expect(otpauthUri).toMatch(/^otpauth:\/\/totp\//);
      expect(qr).toMatch(/^data:image\/png;base64,/);
    });

    it('beginEnrollment refuses to clobber an already-enabled secret', async () => {
      const user = fakeUser({ totpEnabled: true, totpSecret: 'EXISTING' });
      await expect(totp.beginEnrollment(user)).rejects.toMatchObject({ code: 'TOTP_ALREADY_ENABLED' });
      expect(user.update).not.toHaveBeenCalled();
    });

    it('enable verifies the first token then flips totpEnabled and twoFactorEnabled', async () => {
      const secret = authenticator.generateSecret();
      const user = fakeUser({ totpSecret: secret });
      await totp.enable(user, authenticator.generate(secret));
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({ totpEnabled: true, twoFactorEnabled: true, totpLastUsedStep: expect.any(Number) })
      );
    });

    it('enable rejects an invalid first token and does not enable', async () => {
      const secret = authenticator.generateSecret();
      const user = fakeUser({ totpSecret: secret });
      await expect(totp.enable(user, '000000')).rejects.toMatchObject({ code: 'TOTP_INVALID' });
      expect(user.update).not.toHaveBeenCalled();
    });

    it('enable rejects when there is no pending enrollment', async () => {
      const user = fakeUser({ totpSecret: null });
      await expect(totp.enable(user, '123456')).rejects.toMatchObject({ code: 'TOTP_ENROLLMENT_REQUIRED' });
    });

    it('verifyForUser resolves true for an enabled user with a valid token', async () => {
      const secret = authenticator.generateSecret();
      const user = fakeUser({ totpSecret: secret, totpEnabled: true });
      await expect(totp.verifyForUser(user, authenticator.generate(secret))).resolves.toBe(true);
    });

    it('verifyForUser rejects TOTP_INVALID on a bad token and TOTP_NOT_ENABLED when not enabled', async () => {
      const secret = authenticator.generateSecret();
      await expect(totp.verifyForUser(fakeUser({ totpSecret: secret, totpEnabled: true }), '000000'))
        .rejects.toMatchObject({ code: 'TOTP_INVALID' });
      await expect(totp.verifyForUser(fakeUser({ totpEnabled: false }), '123456'))
        .rejects.toMatchObject({ code: 'TOTP_NOT_ENABLED' });
    });

    it('verifyForUser is single-use: it records the step and rejects a replay of the same code', async () => {
      const secret = authenticator.generateSecret();
      const user = fakeUser({ totpSecret: secret, totpEnabled: true });
      const token = authenticator.generate(secret);
      await expect(totp.verifyForUser(user, token)).resolves.toBe(true);
      expect(user.totpLastUsedStep).toEqual(expect.any(Number)); // step persisted
      // Same code again within its window → replay rejected (the old email code was single-use too).
      await expect(totp.verifyForUser(user, token)).rejects.toMatchObject({ code: 'TOTP_INVALID' });
    });

    it('disable clears the secret only with a valid token and resets the single-use marker', async () => {
      const secret = authenticator.generateSecret();
      const user = fakeUser({ totpSecret: secret, totpEnabled: true });
      await expect(totp.disable(user, '000000')).rejects.toMatchObject({ code: 'TOTP_INVALID' });
      await totp.disable(user, authenticator.generate(secret));
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({ totpSecret: null, totpEnabled: false, twoFactorEnabled: false, totpLastUsedStep: null })
      );
    });
  });
});
