// Radar #12(d): el chequeo del límite diario (AML) del swap leía getDailyVolume
// sin lock, así que dos swaps concurrentes del mismo usuario leían el mismo
// volumen, ambos pasaban y ambos liquidaban → el volumen combinado excedía
// limiteDiarioUsd. El anti-sobregiro del ledger (FOR UPDATE sobre saldos) NO
// cubre este agregado. El fix serializa la sección crítica por usuario con un
// SELECT ... FOR UPDATE sobre la fila de Usuario.
//
// Integración real (Postgres, conexiones concurrentes) a propósito: un mock no
// puede probar que el FOR UPDATE serializa dos transacciones.

require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { IntercambioExchange } = require('../../models');

let idem = 0;
const idemKey = () => `idem-${Date.now()}-${idem++}`;

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// BTC/USDT precio 100, comisión 1%. Compra 1 BTC → cantidadQuote 100 (lo que
// cuenta para el límite diario), requiredQuote 101. limiteDiarioUsd = 100: un
// swap pasa (100 <= 100), dos lo exceden (200 > 100). Saldo holgado (250) para
// que lo único que frene al segundo sea el límite diario, no el balance.
async function seedScenario() {
  const user = await f.seedUser({ limiteDiarioUsd: 100 });
  const btc = await f.seedCripto('BTC');
  const usdt = await f.seedCripto('USDT');
  const par = await f.seedPar({ base: btc, quote: usdt, precio: '100', comision: '1' });
  await f.seedWalletMaestra(btc);
  await f.seedWalletMaestra(usdt);
  await f.seedBalance(user, usdt, '250');
  return { user, btc, usdt, par };
}

describe('swap daily limit under concurrency (real Postgres)', () => {
  test('two concurrent swaps that jointly exceed limiteDiarioUsd: only one passes', async () => {
    const { user, usdt, par } = await seedScenario();

    const fire = () => request(app)
      .post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 1 });

    const results = await Promise.all([fire(), fire()]);
    const statuses = results.map((r) => r.status).sort((a, b) => a - b);

    // Antes del fix (sin FOR UPDATE en la fila de Usuario): ambos leen
    // dailyVolume=0, ambos pasan, ambos liquidan → [201, 201] y volumen 200 > 100.
    expect(statuses).toEqual([201, 400]);
    const rejected = results.find((r) => r.status === 400);
    expect(rejected.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');

    // Exactamente un swap liquidó; el volumen diario queda dentro del límite.
    const volume = await IntercambioExchange.getDailyVolume(user.id, new Date());
    expect(volume).toBe(100);
    // 250 - 101 (una sola compra: cantidadQuote 100 + comisión 1).
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('149.00000000');
  }, 20000);
});
