// backend/tests/asyncHandler.test.js
const asyncHandler = require('../utils/asyncHandler');

describe('asyncHandler', () => {
  test('forwards a thrown error to next', async () => {
    const err = new Error('boom');
    const handler = asyncHandler(async () => { throw err; });
    const next = jest.fn();
    await handler({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('does not call next when the handler resolves', async () => {
    const handler = asyncHandler(async (req, res) => { res.ok = true; });
    const next = jest.fn();
    const res = {};
    await handler({}, res, next);
    expect(res.ok).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});
