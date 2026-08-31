const { Op } = require('sequelize');
const { TransaccionBlockchain, Criptomoneda } = require('../../models');

// Recovers stuck 'procesando' withdrawals left by a crash between the atomic
// claim and recording the send. Reverts ONLY when the tx is provably absent
// on-chain — never a withdrawal that may have gone out (that would double-spend
// from the user's side). See spec 2026-08-24-fase2-withdrawal-reaper-onchain.
//
// getClientForNetwork(red) → an EvmChainClient (getConfirmations). Injected so
// tests pass a fake; the job scheduler wires the real BlockchainServiceManager.
async function reapStaleWithdrawals({ getClientForNetwork, staleMinutes = 15, now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - staleMinutes * 60000);

  const stuck = await TransaccionBlockchain.findAll({
    where: {
      tipo: 'retiro',
      estado: 'procesando',
      // Column name (snake_case) on purpose — this codebase queries the timestamp
      // columns by their DB name (see IntercambioExchange.getDailyVolume with
      // created_at); the camelCase attribute is not mapped in where clauses here.
      updated_at: { [Op.lt]: cutoff },
    },
    include: [{ model: Criptomoneda, as: 'criptomoneda' }],
  });

  let reverted = 0;
  let left = 0;

  for (const row of stuck) {
    // No txHash recorded → the process died before it ever signed/broadcast.
    // Nothing went out; safe to revert.
    if (!row.txHash) {
      await TransaccionBlockchain.failWithdrawal(row.id, 'reaped: no broadcast (no txHash recorded)');
      reverted++;
      continue;
    }

    const client = getClientForNetwork ? getClientForNetwork(row.criptomoneda.red) : null;
    // Without a client we cannot verify — be conservative and leave it.
    if (!client) { left++; continue; }

    // A lookup FAILURE (transient RPC/API error) must never cause a revert —
    // only a definitive "absent" (null) may. getConfirmations returns null only
    // when the node/API definitively does not know the tx; it throws on transient
    // errors, which we swallow and leave the row for the next sweep.
    let confirmations;
    try {
      confirmations = await client.getConfirmations(row.txHash);
    } catch (err) {
      console.warn(`[reaper] getConfirmations failed for ${row.txHash}, leaving row: ${err.message}`);
      left++;
      continue;
    }
    if (confirmations === null) {
      // Provably unknown to the node → never made it on-chain → safe to revert.
      await TransaccionBlockchain.failWithdrawal(row.id, 'reaped: tx absent on-chain');
      reverted++;
    } else {
      // Present (mempool: 0, or mined: >0) → leave it; the confirmation job finalizes it.
      left++;
    }
  }

  return { reverted, left };
}

// Adapts a BlockchainServiceManager to the reaper's getClientForNetwork(red)
// contract: an object with getConfirmations(txHash). EVM services expose it on
// their `.chain` client; the Bitcoin service implements it directly. A network
// with no service, or one that cannot report confirmations, resolves to null so
// the reaper leaves the row rather than guessing.
function makeGetClientForNetwork(manager) {
  const canConfirm = (o) => o && typeof o.getConfirmations === 'function';
  return (red) => {
    const service = manager.getService(red);
    if (!service) return null;
    if (canConfirm(service.chain)) return service.chain;
    if (canConfirm(service)) return service;
    return null;
  };
}

module.exports = { reapStaleWithdrawals, makeGetClientForNetwork };
