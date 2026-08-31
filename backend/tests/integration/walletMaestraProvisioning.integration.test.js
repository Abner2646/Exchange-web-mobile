require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { WalletMaestra, DireccionDeposito, BalanceUsuario, Usuario } = require('../../models');
const f = require('../helpers/factories');

const h = installAuthHarness(); // resetDb + email-fake seam + sequelize close

describe('WalletMaestra.getByCriptomoneda', () => {
  test('returns the master wallet with its crypto included (no phantom-column SQL error)', async () => {
    const btc = await f.seedCripto('BTC');
    const wallet = await f.seedWalletMaestra(btc);

    // Regression: the include selected criptomoneda.derivationPath / addressFormat,
    // columns that do not exist on Criptomoneda → the query threw
    // "column criptomoneda.derivationPath does not exist" on every call, breaking
    // deposit-address provisioning (inicializarUsuarioCompleto).
    const found = await WalletMaestra.getByCriptomoneda(btc.id);

    expect(found).not.toBeNull();
    expect(found.id).toBe(wallet.id);
    expect(found.criptomoneda.symbol).toBe('BTC');
  });
});

describe('deposit-address provisioning on email verification', () => {
  test('a verified user gets a deposit address + balance row for each active crypto with a master wallet', async () => {
    const btc = await f.seedCripto('BTC'); // red 'test' → generarDireccionDerivada default branch
    await f.seedWalletMaestra(btc);

    // Provisioning (inicializarUsuarioCompleto) runs on verify-email, not register.
    const { token, code } = await h.registerAndGetCode({ email: 'prov@test.local', username: 'provuser' });
    const verify = await request(app)
      .post('/api/usuario/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: code });
    expect(verify.status).toBe(200);

    // The deposit address + balance must exist. Two regressions blocked this:
    // (1) getByCriptomoneda selected phantom columns, and (2) the DireccionDeposito
    // was created with `usuarioId` instead of the entity's `userId` field. Either
    // one made provisioning throw, and verify-email swallows that error → the user
    // ended up verified but with no deposit addresses.
    const user = await Usuario.findOne({ where: { email: 'prov@test.local' } });
    expect(await DireccionDeposito.count({ where: { userId: user.id } })).toBeGreaterThan(0);
    expect(await BalanceUsuario.count({ where: { userId: user.id } })).toBeGreaterThan(0);
  });
});
