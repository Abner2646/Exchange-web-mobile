// backend/tests/integration/amlDenylist.integration.test.js
const { sequelize, resetDb } = require('../helpers/db');
const denylist = require('../../modules/aml/denylist.model');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('AML denylist model', () => {
  test('EVM address match is case-insensitive; miss returns null', async () => {
    await denylist.addAddress({ address: '0xABCdef0000000000000000000000000000000001', network: 'ethereum', reason: 'test', source: 'OFAC' });
    const hit = await denylist.isDenylisted('0xabcDEF0000000000000000000000000000000001', 'ethereum');
    expect(hit).not.toBeNull();
    const miss = await denylist.isDenylisted('0x0000000000000000000000000000000000000002', 'ethereum');
    expect(miss).toBeNull();
  });

  test('same address on a different network does not match', async () => {
    await denylist.addAddress({ address: 'bc1qexample', network: 'bitcoin' });
    expect(await denylist.isDenylisted('bc1qexample', 'ethereum')).toBeNull();
    expect(await denylist.isDenylisted('bc1qexample', 'bitcoin')).not.toBeNull();
  });

  test('network is canonicalized: an operator typo does not defeat screening', async () => {
    // Operator types a mixed-case / padded network; the withdrawal side screens
    // with the canonical crypto.network ('ethereum'). Must still match (address
    // is also EVM-lowercased because the network canonicalizes to 'ethereum').
    await denylist.addAddress({ address: '0xFEED', network: ' Ethereum ', source: 'OFAC' });
    expect(await denylist.isDenylisted('0xfeed', 'ethereum')).not.toBeNull();
  });

  test('list + remove', async () => {
    const row = await denylist.addAddress({ address: '0xdead', network: 'ethereum' });
    expect(await denylist.listAddresses()).toHaveLength(1);
    expect(await denylist.removeAddress(row.id)).toBe(1);
    expect(await denylist.listAddresses()).toHaveLength(0);
  });
});
