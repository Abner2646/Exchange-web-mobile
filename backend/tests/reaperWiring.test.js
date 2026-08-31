const { makeGetClientForNetwork } = require('../services/blockchain/withdrawalReaper');

// makeGetClientForNetwork(manager) adapts the BlockchainServiceManager to what the
// reaper needs: an object with getConfirmations(txHash) for a given network. EVM
// services expose it on their `.chain` client; the Bitcoin service implements it
// directly. Unknown networks / missing capability resolve to null (reaper leaves
// the row instead of guessing).
function fakeManager(map) {
  return { getService: (red) => map[red] || null };
}

describe('makeGetClientForNetwork', () => {
  test('returns the chain client for an EVM service (getConfirmations on .chain)', () => {
    const chain = { getConfirmations: async () => 1 };
    const get = makeGetClientForNetwork(fakeManager({ ethereum: { chain } }));
    expect(get('ethereum')).toBe(chain);
  });

  test('returns the service itself when getConfirmations lives on the service (Bitcoin)', () => {
    const btc = { getConfirmations: async () => 3 };
    const get = makeGetClientForNetwork(fakeManager({ bitcoin: btc }));
    expect(get('bitcoin')).toBe(btc);
  });

  test('returns null when the network has no registered service', () => {
    const get = makeGetClientForNetwork(fakeManager({}));
    expect(get('dogecoin')).toBeNull();
  });

  test('returns null when neither service nor chain can report confirmations', () => {
    const get = makeGetClientForNetwork(fakeManager({ weird: { chain: {} } }));
    expect(get('weird')).toBeNull();
  });
});
