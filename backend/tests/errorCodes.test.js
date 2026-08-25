const errorCodes = require('../utils/errorCodes');

describe('errorCodes', () => {
  test('is frozen and every value equals its key', () => {
    expect(Object.isFrozen(errorCodes)).toBe(true);
    for (const [key, value] of Object.entries(errorCodes)) {
      expect(value).toBe(key);
    }
  });

  test('includes the money-path and idempotency codes this pass uses', () => {
    expect(errorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(errorCodes.INSUFFICIENT_BALANCE).toBe('INSUFFICIENT_BALANCE');
    expect(errorCodes.IDEMPOTENCY_KEY_REQUIRED).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });
});
