const axios = require('axios');
const businessConfig = require('../config/businessConfig');
const { sendAlert, sanitize } = require('./telegramAlert.service');
const crypto = require('crypto');

jest.mock('axios');
jest.mock('../config/businessConfig');

describe('Telegram Alert Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Configuration & Initialization', () => {
    it('should no-op and return { sent: false, reason: "disabled" } if disabled in businessConfig', async () => {
      businessConfig.getBoolean.mockResolvedValue(false);
      process.env.TELEGRAM_BOT_TOKEN = 'token123';
      process.env.TELEGRAM_ALERT_CHAT_ID = 'chat123';

      const result = await sendAlert({ severity: 'info', code: 'TEST', message: 'test' });
      
      expect(result).toEqual({ sent: false, reason: 'disabled' });
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should no-op if token or chat id is missing', async () => {
      businessConfig.getBoolean.mockResolvedValue(true);
      process.env.TELEGRAM_BOT_TOKEN = '';
      process.env.TELEGRAM_ALERT_CHAT_ID = 'chat123';

      const result = await sendAlert({ severity: 'info', code: 'TEST', message: 'test' });
      
      expect(result).toEqual({ sent: false, reason: 'disabled' });
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('HTTP Call & Error Handling', () => {
    it('should send alert successfully if enabled and configured', async () => {
      businessConfig.getBoolean.mockResolvedValue(true);
      process.env.TELEGRAM_BOT_TOKEN = 'token123';
      process.env.TELEGRAM_ALERT_CHAT_ID = 'chat123';
      
      axios.post.mockResolvedValue({ data: { ok: true } });

      const result = await sendAlert({ severity: 'critical', code: 'SYS_FAIL', message: 'System failure', context: { region: 'us-east' } });
      
      expect(result).toEqual({ sent: true });
      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.telegram.org/bottoken123/sendMessage',
        expect.objectContaining({
          chat_id: 'chat123',
          text: expect.stringContaining('[CRITICAL] SYS_FAIL\nMessage: System failure')
        }),
        { timeout: 5000 }
      );
    });

    it('should swallow transport errors and return { sent: false, reason: "transport_error" }', async () => {
      businessConfig.getBoolean.mockResolvedValue(true);
      process.env.TELEGRAM_BOT_TOKEN = 'token123';
      process.env.TELEGRAM_ALERT_CHAT_ID = 'chat123';
      
      axios.post.mockRejectedValue(new Error('Network Error'));

      const result = await sendAlert({ severity: 'info', code: 'TEST', message: 'test' });
      
      expect(result).toEqual({ sent: false, reason: 'transport_error' });
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('PII Sanitization', () => {
    it('should mask emails', () => {
      const result = sanitize({ email: 'user@example.com', other_email: 'jo@test.com', nested: { email: 'contact@domain.com' } });
      expect(result.email).toBe('us***@example.com');
      expect(result.other_email).toBe('***@test.com');
      expect(result.nested.email).toBe('co***@domain.com');
    });

    it('should mask emails embedded in strings', () => {
      const result = sanitize('Contact user@example.com for help');
      expect(result).toBe('Contact us***@example.com for help');
    });

    it('should mask full wallet addresses', () => {
      const address1 = '0x1234567890abcdef1234567890abcdef12345678';
      const address2 = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
      const result = sanitize({ walletAddress: address1, btc: address2 });
      expect(result.walletAddress).toBe('0x1234...5678');
      expect(result.btc).toBe('bc1qxy...0wlh');
    });

    it('should redact raw amounts', () => {
      const result = sanitize({ amount: 5000, balance: 12.5, quantity: 10, normalField: 'hello' });
      expect(result.amount).toBe('[REDACTED_AMOUNT]');
      expect(result.balance).toBe('[REDACTED_AMOUNT]');
      expect(result.quantity).toBe('[REDACTED_AMOUNT]');
      expect(result.normalField).toBe('hello');
    });

    it('should hash user ids', () => {
      const userId = 'user-12345';
      const hashed = crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 8);
      
      const result = sanitize({ userId, uid: 999, user_id: userId });
      expect(result.userId).toBe(hashed);
      expect(result.uid).toBe(crypto.createHash('sha256').update('999').digest('hex').substring(0, 8));
      expect(result.user_id).toBe(hashed);
    });

    it('should redact keys on denylist', () => {
      const result = sanitize({ password: 'secretpassword123', token: 'jwt-token-here', secret: 'oauth-secret', cvv: '123' });
      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.secret).toBe('[REDACTED]');
      expect(result.cvv).toBe('[REDACTED]');
    });
  });
});
