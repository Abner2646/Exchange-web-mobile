// The /auth/logout endpoint (the one the web frontend calls) must invalidate the JWT SERVER-SIDE,
// not just drop it client-side. It does so by stamping User.lastLogoutAt; the auth middleware already
// rejects any token whose `iat` predates lastLogoutAt. Before this fix, /auth/logout only did
// req.logout()/session destroy and left the 7-day JWT fully valid after logout (security gap).
jest.mock('jsonwebtoken');
jest.mock('../models', () => ({ User: { logout: jest.fn() } }));

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const authController = require('../modules/users/auth.controller');

const mockRes = () => ({ clearCookie: jest.fn(), json: jest.fn(), status: jest.fn().mockReturnThis() });
const mockReq = (authHeader) => ({
  header: (h) => (h === 'Authorization' ? authHeader : undefined),
  logout: (cb) => cb(),
  session: { destroy: (cb) => cb() },
});

describe('authController.logout — server-side JWT invalidation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('stamps lastLogoutAt for the token user (invalidates tokens issued before logout)', async () => {
    jwt.verify.mockReturnValue({ id: 'user-1' });
    User.logout.mockResolvedValue({});
    const res = mockRes();
    await authController.logout(mockReq('Bearer abc.def.ghi'), res);
    expect(User.logout).toHaveBeenCalledWith('user-1');
    expect(res.clearCookie).toHaveBeenCalledWith('connect.sid', expect.any(Object));
    expect(res.json).toHaveBeenCalled();
  });

  test('is idempotent: succeeds without invalidating when no/invalid token is present', async () => {
    const res = mockRes();
    await authController.logout(mockReq(undefined), res);
    expect(User.logout).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });

  test('does not blow up if the token is invalid (still logs out)', async () => {
    jwt.verify.mockImplementation(() => { throw new Error('bad token'); });
    User.logout.mockResolvedValue({});
    const res = mockRes();
    await authController.logout(mockReq('Bearer garbage'), res);
    expect(User.logout).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalled();
  });
});
