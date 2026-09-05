require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { IdempotencyKey } = require('../../models');
const idempotency = require('../../middleware/idempotency.middleware');

// Transactional idempotency hardening: on the success path, each money-path
// controller writes the `completed` idempotency row INSIDE its own DB
// transaction (via idempotency.finalizeInTransaction), so "money moved" and
// "key completed" commit atomically. This closes the crash-post-commit window
// where the old finish-handler write could leave the row `in_progress` after a
// committed operation, letting the 90s stale-reclaim re-execute it (double-spend).
//
// Each test drives the controller DIRECTLY with a res mock that never emits the
// `finish` event, simulating the process dying right after commit. With the
// hardening the row is durably `completed`; without it, it would stay
// `in_progress` (the finish handler is the only thing that would have completed it).

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// res mock that captures status/body but deliberately never fires `finish`.
function resNoFinish() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    on() { /* no-op: the finish handler must NOT be what completes the key */ },
  };
}

// Seed the in_progress row + the _idempotency context the middleware would have set.
async function claim(userId, key) {
  const where = { userId, idempotencyKey: key };
  await IdempotencyKey.create({ userId, idempotencyKey: key, requestHash: 'h', status: 'in_progress' });
  return { where, _idempotency: { where, finalized: false } };
}

describe('transactional idempotency — swap (POST /intercambioExchange/)', () => {
  const intercambio = require('../../controllers/intercambioExchange.controller');

  async function seedBuyScenario() {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, precio: '0.1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    await f.seedBalance(user, usdt, '1');
    return { user, btc, usdt, par };
  }

  test('completed row is committed inside the swap tx (survives a missing finish handler)', async () => {
    const { user, par } = await seedBuyScenario();
    const { where, _idempotency } = await claim(user.id, 'swap-key-1');

    const req = {
      user: { id: user.id },
      body: { parId: par.id, tipo: 'compra', cantidadBase: 3 },
      app: { locals: {} },
      _idempotency,
    };
    const res = resNoFinish();

    await intercambio.createOrder(req, res);

    expect(res.statusCode).toBe(201);
    const row = await IdempotencyKey.findOne({ where });
    expect(row.status).toBe('completed');
    expect(row.responseStatusCode).toBe(201);
    expect(row.responseBody).not.toBeNull();
  });
});

describe('transactional idempotency — createTransferencia (POST /transferencias/)', () => {
  const transferencia = require('../../controllers/transferencia.controller');
  const fakeEmail = { locals: { emailService: { enviarCodigoTransferencia: async () => {} } } };

  test('completed row is committed inside the transfer tx (survives a missing finish handler)', async () => {
    const sender = await f.seedUser();
    const dest = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    await f.seedBalance(sender, btc, '5');
    const { where, _idempotency } = await claim(sender.id, 'transfer-key-1');

    const req = {
      user: { id: sender.id },
      body: { usuarioDestinatarioId: dest.id, criptomonedaId: btc.id, cantidad: '1' },
      app: fakeEmail,
      _idempotency,
    };
    const res = resNoFinish();

    await transferencia.createTransferencia(req, res);

    expect(res.statusCode).toBe(201);
    const row = await IdempotencyKey.findOne({ where });
    expect(row.status).toBe('completed');
    expect(row.responseStatusCode).toBe(201);
  });
});

describe('transactional idempotency — transferMisCompartimentos (POST /balances/my/transfer)', () => {
  const balanceCtrl = require('../../controllers/balanceUsuario.controller');

  test('completed row is committed inside the compartment-transfer tx (survives a missing finish handler)', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    await f.seedBalance(user, btc, '5'); // funding:disponible
    const { where, _idempotency } = await claim(user.id, 'compartimento-key-1');

    const req = {
      user: { id: user.id },
      body: { criptomonedaId: btc.id, cantidad: '2', origen: 'funding', destino: 'spot' },
      app: { locals: {} },
      _idempotency,
    };
    const res = resNoFinish();

    await balanceCtrl.transferMisCompartimentos(req, res);

    expect(res.statusCode).toBe(200);
    const row = await IdempotencyKey.findOne({ where });
    expect(row.status).toBe('completed');
    expect(row.responseStatusCode).toBe(200);
  });
});

describe('transactional idempotency — createWithdrawal (model static, POST /transactions/withdraw)', () => {
  const { TransaccionBlockchain } = require('../../models');

  // The withdrawal money movement (block funds + create row) is owned by the model
  // static's own tx. It takes an optional `finalize` hook that runs INSIDE that tx,
  // so the idempotency completion commits atomically with the block+row. Without it
  // (old code ignored the 2nd arg), a crash after commit left the key in_progress
  // and the stale-reclaim could re-block funds + create a second withdrawal.
  test('the finalize hook runs inside the createWithdrawal tx (completes atomically with block+row)', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    await f.seedBalance(user, btc, '5');
    const { where, _idempotency } = await claim(user.id, 'withdraw-key-1');
    const req = { _idempotency };

    await TransaccionBlockchain.createWithdrawal(
      { userId: user.id, criptomonedaId: btc.id, cantidad: 1, direccionDestino: 'addr-x' },
      {
        finalize: async (transaction, retiro) => {
          const responseBody = { success: true, message: 'Retiro creado exitosamente', data: retiro };
          await idempotency.finalizeInTransaction(req, transaction, 201, responseBody);
        },
      }
    );

    const row = await IdempotencyKey.findOne({ where });
    expect(row.status).toBe('completed');
    expect(row.responseStatusCode).toBe(201);
    expect(row.responseBody).not.toBeNull();
  });
});

describe('transactional idempotency — trading.createOrder (POST /trading/orders)', () => {
  const tradingController = require('../../controllers/trading.controller');

  // The order-creation money move (lock Spot balance + create the Order row) is
  // made atomic in one controller-owned tx (fixing the Críticos #5 residual:
  // balance locked without order if Order.create fails), and the idempotency key
  // is completed inside that same tx. Matching stays fire-and-forget AFTER commit
  // (Radar #12b, deferred).
  test('completed row is committed inside the order-creation tx (survives a missing finish handler)', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });
    const user = await f.seedUser();
    await f.seedSpotBalance(user, usdt, '200');
    const { where, _idempotency } = await claim(user.id, 'trading-key-1');

    const req = {
      user: { id: user.id },
      body: { tradingPairId: pair.id, orderType: 'limit', side: 'buy', quantity: 1, price: 100 },
      _idempotency,
    };
    const res = resNoFinish();

    await tradingController.createOrder(req, res);

    expect(res.statusCode).toBe(201);
    const row = await IdempotencyKey.findOne({ where });
    expect(row.status).toBe('completed');
    expect(row.responseStatusCode).toBe(201);
  });
});
