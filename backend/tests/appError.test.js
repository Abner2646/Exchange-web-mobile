// backend/tests/appError.test.js
const AppError = require('../utils/AppError');

describe('AppError', () => {
  test('sets statusCode, code, message and isOperational', () => {
    const e = new AppError(400, 'INVALID_ORDER', 'Cantidad inválida');
    expect(e).toBeInstanceOf(Error);
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('INVALID_ORDER');
    expect(e.message).toBe('Cantidad inválida');
    expect(e.isOperational).toBe(true);
  });
});
