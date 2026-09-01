const { CuentaLedger } = require('../../models');

// Las cuentas de casa/sistema usan un ownerId centinela en vez de NULL: Postgres
// trata cada NULL como distinto en un indice unico, lo que romperia la dedup de
// cuentas de casa (dos 'fee_revenue' BTC coexistirian). Con un UUID fijo el
// indice unico (owner_id, proposito, criptomoneda_id) funciona normal.
const HOUSE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

const PROPOSITOS = {
  FUNDING_DISPONIBLE: 'funding:disponible',
  FUNDING_PENDIENTE: 'funding:pendiente',
  FUNDING_BLOQUEADO: 'funding:bloqueado',
  SPOT_DISPONIBLE: 'spot:disponible',
  SPOT_BLOQUEADO: 'spot:bloqueado',
  EXTERNAL_ONCHAIN: 'external_onchain',
  FEE_REVENUE: 'fee_revenue',
  TREASURY: 'treasury',
  SUSPENSE: 'suspense',
  APERTURA: 'apertura',
};

async function resolveAccount({ ownerId, proposito, criptomonedaId }, transaction = null) {
  const owner = ownerId || HOUSE_OWNER_ID;
  const [cuenta] = await CuentaLedger.findOrCreate({
    where: { ownerId: owner, proposito, criptomonedaId },
    defaults: { ownerId: owner, proposito, criptomonedaId },
    transaction,
  });
  return cuenta;
}

function isCuentaUsuario(cuenta) {
  return cuenta.ownerId !== HOUSE_OWNER_ID;
}

module.exports = { HOUSE_OWNER_ID, PROPOSITOS, resolveAccount, isCuentaUsuario };
