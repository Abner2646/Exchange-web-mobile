require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { OfertaP2P, MetodoPago, TransaccionP2P } = require('../../models');

// End-to-end P2P transaction flow over HTTP (real Postgres + ledger). The model
// owns the state machine (createTransaction → confirmPayment → completeTransaction,
// or cancelTransaction) and the fund block/unblock/liquidation via the ledger.
// This suite pins the happy path AND the state-machine guards, and drives the
// error-envelope fix: the model's business rejections used to leak as a sanitized
// 500 (they throw plain Error and the controller did not translate them) — they
// must surface as the canonical { error: { code, message } } with a 4xx status.

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function seedMetodoPago() {
  return MetodoPago.create({ nombre: 'Bank transfer' });
}

// A 'venta' offer: the offerer (seller) sells crypto; the acceptor is the buyer.
// The seller must hold funding balance — createTransaction blocks it.
async function seedVentaOffer(seller, cripto, { min = '0.1', max = '10', precio = '100' } = {}) {
  return OfertaP2P.create({
    usuarioId: seller.id,
    tipo: 'venta',
    criptomonedaId: cripto.id,
    cantidadMin: min,
    cantidadMax: max,
    precioUnitario: precio,
    monedaFiat: 'USD',
    activa: true,
  });
}

// Seeds seller + buyer + crypto + seller funding balance + payment method + offer.
async function seedScenario({ sellerFunds = '5' } = {}) {
  const seller = await f.seedUser();
  const buyer = await f.seedUser();
  const btc = await f.seedCripto('BTC');
  await f.seedBalance(seller, btc, sellerFunds);
  const metodo = await seedMetodoPago();
  const oferta = await seedVentaOffer(seller, btc);
  return { seller, buyer, btc, metodo, oferta };
}

const create = (buyer, oferta, metodo, cantidad) =>
  request(app).post('/api/transaccionP2P/').set(f.authHeader(buyer))
    .send({ ofertaId: oferta.id, cantidad, metodoPagoId: metodo.id });

const confirm = (user, id) =>
  request(app).patch(`/api/transaccionP2P/${id}/confirm-payment`).set(f.authHeader(user));
const complete = (user, id) =>
  request(app).patch(`/api/transaccionP2P/${id}/complete`).set(f.authHeader(user));
const cancel = (user, id) =>
  request(app).patch(`/api/transaccionP2P/${id}/cancel`).set(f.authHeader(user));

describe('P2P transaction — happy path (create → confirm → complete)', () => {
  test('blocks seller funds on create, then moves crypto seller→buyer on complete', async () => {
    const { seller, buyer, btc, metodo, oferta } = await seedScenario({ sellerFunds: '5' });

    // Create: buyer accepts the offer for 2 BTC.
    const created = await create(buyer, oferta, metodo, 2);
    expect(created.status).toBe(201);
    const txId = created.body.data.id;

    // Seller funds: 5 → 3 available, 2 blocked.
    let sellerBal = await f.getBalance(seller, btc);
    expect(sellerBal.balanceDisponible).toBe('3.00000000');
    expect(sellerBal.balanceBloqueado).toBe('2.00000000');

    // Buyer confirms fiat payment.
    const confirmed = await confirm(buyer, txId);
    expect(confirmed.status).toBe(200);

    // Seller completes → crypto is released to the buyer.
    const completed = await complete(seller, txId);
    expect(completed.status).toBe(200);

    // Seller: 3 available, 0 blocked. Buyer: 2 available.
    sellerBal = await f.getBalance(seller, btc);
    expect(sellerBal.balanceDisponible).toBe('3.00000000');
    expect(sellerBal.balanceBloqueado).toBe('0.00000000');
    const buyerBal = await f.getBalance(buyer, btc);
    expect(buyerBal.balanceDisponible).toBe('2.00000000');

    const row = await TransaccionP2P.findByPk(txId);
    expect(row.estado).toBe('completada');
  });

  test('cancel from iniciada unblocks the seller funds', async () => {
    const { seller, buyer, btc, metodo, oferta } = await seedScenario({ sellerFunds: '5' });
    const created = await create(buyer, oferta, metodo, 2);
    const txId = created.body.data.id;

    const cancelled = await cancel(buyer, txId);
    expect(cancelled.status).toBe(200);

    const sellerBal = await f.getBalance(seller, btc);
    expect(sellerBal.balanceDisponible).toBe('5.00000000');
    expect(sellerBal.balanceBloqueado).toBe('0.00000000');
  });
});

describe('P2P transaction — state-machine guards return a typed 4xx envelope', () => {
  test('cannot cancel a completed transaction (Fase 0 state-machine bug)', async () => {
    const { seller, buyer, metodo, oferta } = await seedScenario();
    const { body } = await create(buyer, oferta, metodo, 1);
    const txId = body.data.id;
    await confirm(buyer, txId);
    await complete(seller, txId);

    const res = await cancel(buyer, txId);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('P2P_TX_INVALID_STATE');
  });

  test('cannot complete before the buyer confirms payment', async () => {
    const { seller, buyer, metodo, oferta } = await seedScenario();
    const { body } = await create(buyer, oferta, metodo, 1);

    const res = await complete(seller, body.data.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('P2P_TX_INVALID_STATE');
  });

  test('only the buyer can confirm payment', async () => {
    const { seller, buyer, metodo, oferta } = await seedScenario();
    const { body } = await create(buyer, oferta, metodo, 1);

    const res = await confirm(seller, body.data.id); // seller, not buyer
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('P2P_TX_FORBIDDEN');
  });

  test('only the seller can complete', async () => {
    const { buyer, metodo, oferta } = await seedScenario();
    const { body } = await create(buyer, oferta, metodo, 1);
    await confirm(buyer, body.data.id);

    const res = await complete(buyer, body.data.id); // buyer, not seller
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('P2P_TX_FORBIDDEN');
  });
});

describe('P2P transaction — create rejections return a typed 4xx envelope', () => {
  test('inactive offer → 400 P2P_TX_OFFER_INACTIVE', async () => {
    const { buyer, metodo, oferta } = await seedScenario();
    await oferta.update({ activa: false });

    const res = await create(buyer, oferta, metodo, 1);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('P2P_TX_OFFER_INACTIVE');
  });

  test('amount out of range → 400 P2P_TX_AMOUNT_OUT_OF_RANGE', async () => {
    const { buyer, metodo, oferta } = await seedScenario(); // max = 10
    const res = await create(buyer, oferta, metodo, 999);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('P2P_TX_AMOUNT_OUT_OF_RANGE');
  });

  test('seller has insufficient funds → 400 P2P_TX_INSUFFICIENT_FUNDS', async () => {
    const { buyer, metodo, oferta } = await seedScenario({ sellerFunds: '1' }); // < 2
    const res = await create(buyer, oferta, metodo, 2);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('P2P_TX_INSUFFICIENT_FUNDS');
  });
});
