import { describe, it, expect } from 'vitest';
import { en } from './en';
import { es } from './es';

const REQUIRED_UI = [
  'auth.register.title', 'auth.register.submit', 'auth.register.haveAccount',
  'auth.login.title', 'auth.login.submit', 'auth.login.forgot', 'auth.login.needAccount',
  'auth.verifyEmail.title', 'auth.verifyEmail.submit', 'auth.verifyEmail.resend', 'auth.verifyEmail.sent',
  'auth.twofa.title.totp', 'auth.twofa.title.email', 'auth.twofa.submit', 'auth.twofa.resend',
  'auth.forgot.title', 'auth.forgot.submit', 'auth.forgot.sent',
  'auth.reset.codeTitle', 'auth.reset.codeSubmit', 'auth.reset.title', 'auth.reset.submit', 'auth.reset.mismatch',
  'auth.field.email', 'auth.field.username', 'auth.field.password', 'auth.field.code', 'auth.field.newPassword', 'auth.field.confirmPassword',
  'auth.google.button',
];
const REQUIRED_ERRORS = ['INVALID_CREDENTIALS', 'EMAIL_NOT_VERIFIED', 'TOO_MANY_REQUESTS', 'NETWORK_ERROR'];

describe('auth catalogs', () => {
  it('en has all required auth ui + error keys', () => {
    REQUIRED_UI.forEach((k) => expect(en.ui[k], `en.ui ${k}`).toBeTypeOf('string'));
    REQUIRED_ERRORS.forEach((k) => expect(en.errors[k], `en.errors ${k}`).toBeTypeOf('string'));
  });
  it('es mirrors every en auth key', () => {
    REQUIRED_UI.forEach((k) => expect(es.ui[k], `es.ui ${k}`).toBeTypeOf('string'));
    REQUIRED_ERRORS.forEach((k) => expect(es.errors[k], `es.errors ${k}`).toBeTypeOf('string'));
  });
});
