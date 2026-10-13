// Unit tests for the read-only audit viewer controller: limit clamping, keyset cursor,
// filters, and verify passthrough. The model + chain verifier are mocked (no DB).
jest.mock('../../models', () => ({ AuditLog: { findAll: jest.fn() } }));
jest.mock('./verifyAuditChain', () => ({ verifyAuditChain: jest.fn() }));

const { AuditLog } = require('../../models');
const { verifyAuditChain } = require('./verifyAuditChain');
const controller = require('./audit.controller');

function res() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

beforeEach(() => jest.clearAllMocks());

describe('audit.controller.list', () => {
  test('clamps limit to MAX, orders id DESC, returns nextBeforeId on a full page', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => {
      const id = 1000 - i;
      return { id, toJSON() { return { id }; } };
    });
    AuditLog.findAll.mockResolvedValue(rows);
    const req = { query: { limit: '999', eventType: 'withdrawal.completed' } };
    const r = res();
    await controller.list(req, r);

    const args = AuditLog.findAll.mock.calls[0][0];
    expect(args.limit).toBe(100);
    expect(args.order).toEqual([['id', 'DESC']]);
    expect(args.where.eventType).toBe('withdrawal.completed');
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ nextBeforeId: 901 }));
  });

  test('applies beforeId as an Op.lt cursor and defaults limit to 50', async () => {
    AuditLog.findAll.mockResolvedValue([]);
    const req = { query: { beforeId: '500' } };
    await controller.list(req, res());
    const args = AuditLog.findAll.mock.calls[0][0];
    expect(args.limit).toBe(50);
    // Op.lt key is a Symbol; assert the cursor value is present under it.
    const idClause = args.where.id;
    const sym = Object.getOwnPropertySymbols(idClause)[0];
    expect(idClause[sym]).toBe(500);
  });

  test('nextBeforeId is null on a partial (last) page', async () => {
    AuditLog.findAll.mockResolvedValue([{ id: 3, toJSON() { return { id: 3 }; } }]);
    const req = { query: { limit: '50' } };
    const r = res();
    await controller.list(req, r);
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ nextBeforeId: null }));
  });
});

describe('audit.controller.verify', () => {
  test('passes the chain-verify result through', async () => {
    verifyAuditChain.mockResolvedValue({ ok: false, brokenAtSeq: 42, checked: 100 });
    const r = res();
    await controller.verify({}, r);
    expect(r.json).toHaveBeenCalledWith({ ok: false, brokenAtSeq: 42, checked: 100 });
  });
});
