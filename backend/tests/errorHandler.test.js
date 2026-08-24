const AppError = require('../utils/AppError');
const errorHandler = require('../middleware/errorHandler');

function mockRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('errorHandler', () => {
  test('AppError -> its status + { error: { code, message } }', () => {
    const res = mockRes();
    errorHandler(new AppError(400, 'INVALID_ORDER', 'Cantidad inválida'), {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_ORDER', message: 'Cantidad inválida' } });
  });

  test('unexpected error -> sanitized 500, logs server-side, no leak of the message', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error('DB password is hunter2'), {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Internal server error');
    expect(res.body.error.requestId).toMatch(/^[a-f0-9]{12}$/);
    expect(JSON.stringify(res.body)).not.toContain('hunter2'); // no leak
    expect(spy).toHaveBeenCalled(); // logged server-side
    spy.mockRestore();
  });
});
