// Unit tests for governance controller input hardening: a malformed :id must produce a clean
// 404 (MAKER_CHECKER_NOT_FOUND) instead of a 500 from a Sequelize UUID cast error, and the
// engine must not be touched for an obviously invalid id.
jest.mock('./makerChecker.service', () => ({ approve: jest.fn(), reject: jest.fn() }));
jest.mock('./governance.model', () => ({ PendingAdminAction: { findAll: jest.fn() } }));
jest.mock('../../models', () => ({ User: { findByPk: jest.fn() } }));
jest.mock('../users/totp.service', () => ({ verifyForUser: jest.fn() }));

const makerChecker = require('./makerChecker.service');
const controller = require('./governance.controller');

function res() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

describe('governance controller — :id UUID validation (500 → clean 404)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('approve with a non-UUID id → 404 MAKER_CHECKER_NOT_FOUND, engine never called', async () => {
    const req = { params: { id: 'not-a-uuid' }, body: { codigo: '123456' }, user: { id: 'checker-1' } };
    await expect(controller.approve(req, res())).rejects.toMatchObject({
      statusCode: 404,
      code: 'MAKER_CHECKER_NOT_FOUND',
    });
    expect(makerChecker.approve).not.toHaveBeenCalled();
  });

  test('reject with a non-UUID id → 404 MAKER_CHECKER_NOT_FOUND, engine never called', async () => {
    const req = { params: { id: '123' }, body: {}, user: { id: 'checker-1' } };
    await expect(controller.reject(req, res())).rejects.toMatchObject({
      statusCode: 404,
      code: 'MAKER_CHECKER_NOT_FOUND',
    });
    expect(makerChecker.reject).not.toHaveBeenCalled();
  });

  test('approve with a well-formed UUID passes through to the engine', async () => {
    makerChecker.approve.mockResolvedValue({ id: 'a-1', status: 'executed' });
    const req = {
      params: { id: '11111111-1111-1111-1111-111111111111' },
      body: { codigo: '123456' },
      user: { id: 'checker-1' },
    };
    await controller.approve(req, res());
    expect(makerChecker.approve).toHaveBeenCalledTimes(1);
  });
});
