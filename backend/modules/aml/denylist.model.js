// modules/aml/denylist.model.js
// Flagged/sanctioned withdrawal-destination addresses (AML signal S5). Manual
// list for now (seeded via the admin route); real OFAC ingestion is a follow-up.

function normalizeAddress(address, network) {
  const a = String(address || '').trim();
  if (network === 'ethereum' || network === 'bsc') return a.toLowerCase();
  return a;
}

async function addAddress({ address, network, reason, source, addedBy }, transaction = null) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.create(
    { address: normalizeAddress(address, network), network, reason, source, addedBy },
    { transaction }
  );
}

async function isDenylisted(address, network, transaction = null) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.findOne({
    where: { address: normalizeAddress(address, network), network },
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

module.exports = { normalizeAddress, addAddress, isDenylisted, listAddresses, removeAddress };
