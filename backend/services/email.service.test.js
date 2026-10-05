// Unit test for the dev-code logging gate. Regression guard against leaking
// verification / 2FA / recovery codes in plaintext to the process logs (pm2) in
// production — an account-takeover vector. See email.service.js#logDevCode.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn(), verify: jest.fn() })),
}));

const emailService = require('./email.service');

describe('EmailService.logDevCode — code-leak gate', () => {
  const ORIGINAL_ENV = process.env.NODE_ENV;
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it('does NOT log the code in production (no leak to pm2 logs)', () => {
    process.env.NODE_ENV = 'production';
    emailService.logDevCode('Código 2FA', 'user@example.com', '123456');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('never prints the secret code in production, by any formatting', () => {
    process.env.NODE_ENV = 'production';
    emailService.logDevCode('Código verificación email', 'user@example.com', '999888');
    const printed = logSpy.mock.calls.map((args) => args.join(' ')).join('\n');
    expect(printed).not.toContain('999888');
  });

  it('logs the code in non-production for developer convenience (SMTP off)', () => {
    process.env.NODE_ENV = 'development';
    emailService.logDevCode('Código 2FA', 'user@example.com', '123456');
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain('123456');
  });
});
