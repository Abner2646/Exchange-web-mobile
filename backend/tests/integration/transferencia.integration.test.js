require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { Transferencia } = require('../../models');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const recon = require('../../services/ledger/reconciliation');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');

const h = installAuthHarness();

let idem = 0;
const idemKey = () => `idem-${Date.now()}-${idem++}`;

// Sender with funds + a zero-balance recipient sharing one active crypto.
async function seedScenario({ senderBalance = '100' } = {}) {
  const crypto = await f.seedCripto('USDT');
  const sender = await f.seedUser({ email: 'sender@test.local', username: 'sender' });
  const recipient = await f.seedUser({ email: 'recipient@test.local', username: 'recipient' });
  await f.seedBalance(sender, crypto, senderBalance);
  await f.seedBalance(recipient, crypto, '0');
  return { crypto, sender, recipient };
}

function createTransfer(sender, { recipientId, cryptoId, cantidad }) {
  return request(app)
    .post('/api/transferencia/')
    .set(f.authHeader(sender))
    .set('Idempotency-Key', idemKey())
    .send({ usuarioDestinatarioId: recipientId, criptomonedaId: cryptoId, cantidad });
}

describe('POST /api/transferencia/ (create) → /:id/process', () => {
  test('create emails a code to the sender; processing with it moves funds', async () => {
    const { crypto, sender, recipient } = await seedScenario();

    const create = await createTransfer(sender, { recipientId: recipient.id, cryptoId: crypto.id, cantidad: '50' });
    expect(create.status).toBe(201);
    const transferId = create.body.data.id;

    // Code emailed to the sender (captured from the fake, never read from the DB).
    const sent = h.fake.sent.find((s) => s.type === 'transferencia' && s.email === 'sender@test.local');
    expect(sent).toBeDefined();
    const code = sent.codigo;
    expect(code).toBeTruthy();
    expect(JSON.stringify(create.body)).not.toContain(code); // not leaked in the response

    const process = await request(app)
      .post(`/api/transferencia/${transferId}/process`)
      .set(f.authHeader(sender))
      .send({ codigoVerificacion: code });
    expect(process.status).toBe(200);

    // Funds moved atomically: sender 100 -> 50, recipient 0 -> 50.
    expect((await f.getBalance(sender, crypto)).balanceDisponible).toBe('50.00000000');
    expect((await f.getBalance(recipient, crypto)).balanceDisponible).toBe('50.00000000');
    expect((await Transferencia.findByPk(transferId)).estado).toBe('completada');

    // Paso D: la transferencia es un asiento user↔user sin suspense; el libro cierra.
    expect(await posting.getSaldoCuenta({ ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId: crypto.id })).toBe('0');
    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });

  test('create with insufficient funds → 400 INSUFFICIENT_FUNDS, no transfer created', async () => {
    const { crypto, sender, recipient } = await seedScenario({ senderBalance: '10' });

    const create = await createTransfer(sender, { recipientId: recipient.id, cryptoId: crypto.id, cantidad: '50' });

    expect(create.status).toBe(400);
    expect(create.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(await Transferencia.count()).toBe(0);
  });

  test('process with a wrong code → 400, funds unchanged', async () => {
    const { crypto, sender, recipient } = await seedScenario();
    const create = await createTransfer(sender, { recipientId: recipient.id, cryptoId: crypto.id, cantidad: '50' });
    const transferId = create.body.data.id;

    const process = await request(app)
      .post(`/api/transferencia/${transferId}/process`)
      .set(f.authHeader(sender))
      .send({ codigoVerificacion: '000000' });

    expect(process.status).toBe(400);
    expect((await f.getBalance(sender, crypto)).balanceDisponible).toBe('100.00000000');
    expect((await f.getBalance(recipient, crypto)).balanceDisponible).toBe('0.00000000');
  });

  test('cancel a pending transfer → 200, state cancelled, funds unchanged', async () => {
    const { crypto, sender, recipient } = await seedScenario();
    const create = await createTransfer(sender, { recipientId: recipient.id, cryptoId: crypto.id, cantidad: '50' });
    const transferId = create.body.data.id;

    const cancel = await request(app)
      .put(`/api/transferencia/${transferId}/cancel`)
      .set(f.authHeader(sender));

    expect(cancel.status).toBe(200);
    expect((await Transferencia.findByPk(transferId)).estado).toBe('cancelada');
    expect((await f.getBalance(sender, crypto)).balanceDisponible).toBe('100.00000000');
  });
});
