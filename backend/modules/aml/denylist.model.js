// modules/aml/denylist.model.js
// Flagged/sanctioned withdrawal-destination addresses (AML signal S5). Manual
// list for now (seeded via the admin route); real OFAC ingestion is a follow-up.

// Canonicalize the network so an operator typo (e.g. 'Ethereum'/'ETH ') on the
// denylist can't silently defeat the S5 screening: the withdrawal side derives
// `network` from crypto.network (canonical lowercase), so both write and read
// MUST canonicalize identically or a sanctioned address would miss.
function normalizeNetwork(network) {
  return String(network || '').trim().toLowerCase();
}

function normalizeAddress(address, network) {
  const a = String(address || '').trim();
  const n = normalizeNetwork(network);
  if (n === 'ethereum' || n === 'bsc') return a.toLowerCase();
  return a;
}

async function addAddress({ address, network, reason, source, addedBy }, transaction = null) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.create(
    { address: normalizeAddress(address, network), network: normalizeNetwork(network), reason, source, addedBy },
    { transaction }
  );
}

async function isDenylisted(address, network, transaction = null) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.findOne({
    where: { address: normalizeAddress(address, network), network: normalizeNetwork(network) },
    transaction,
  });
}

async function listAddresses() {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.findAll({ order: [['created_at', 'DESC']] });
}

async function removeAddress(id) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.destroy({ where: { id } });
}

module.exports = { normalizeNetwork, normalizeAddress, addAddress, isDenylisted, listAddresses, removeAddress };
