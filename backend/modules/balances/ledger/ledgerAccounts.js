// Las cuentas de casa/sistema usan un ownerId centinela en vez de NULL: Postgres
// trata cada NULL como distinto en un indice unico, lo que romperia la dedup de
// cuentas de casa (dos 'fee_revenue' BTC coexistirian). Con un UUID fijo el
// indice unico (owner_id, purpose, crypto_id) funciona normal.
const HOUSE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

const PURPOSES = {
  FUNDING_AVAILABLE: 'funding:disponible',
  FUNDING_PENDING: 'funding:pendiente',
  FUNDING_BLOCKED: 'funding:bloqueado',
  SPOT_AVAILABLE: 'spot:disponible',
  SPOT_BLOCKED: 'spot:bloqueado',
  EXTERNAL_ONCHAIN: 'external_onchain',
  FEE_REVENUE: 'fee_revenue',
  TREASURY: 'treasury',
  SUSPENSE: 'suspense',
  APERTURA: 'apertura',
};

// Registro ÚNICO compartimento→propósito por estado. Fuente de verdad para leer
// saldos por compartimento (la fachada UserBalance) y para las operaciones que
// mueven 'disponible' entre compartimentos (modules/balances/ledger/operations). Spot no
// tiene 'pendiente'. Antes vivía duplicado en 3 lugares (PROPOSITOS_POR_COMPARTIMENTO
// en balanceUsuario.model + DISPONIBLE_POR_COMPARTIMENTO en operations + estos
// PURPOSES): agregar un compartimento requería tocar los tres y podían divergir.
const COMPARTMENTS = {
  funding: { available: PURPOSES.FUNDING_AVAILABLE, blocked: PURPOSES.FUNDING_BLOCKED, pending: PURPOSES.FUNDING_PENDING },
  spot: { available: PURPOSES.SPOT_AVAILABLE, blocked: PURPOSES.SPOT_BLOCKED, pending: null },
};

async function resolveAccount({ ownerId, purpose, cryptoId }, transaction = null) {
  // Require lazy de models: mantiene este módulo libre de dependencias de carga,
  // así COMPARTMENTS/PURPOSES se pueden importar desde cualquier lado (incluido
  // el grafo de models) sin disparar el ciclo models↔ledger.
  const { LedgerAccount } = require('../../../models');
  const owner = ownerId || HOUSE_OWNER_ID;
  const [account] = await LedgerAccount.findOrCreate({
    where: { ownerId: owner, purpose, cryptoId },
    defaults: { ownerId: owner, purpose, cryptoId },
    transaction,
  });
  return account;
}

function isUserAccount(account) {
  return account.ownerId !== HOUSE_OWNER_ID;
}

module.exports = { HOUSE_OWNER_ID, PURPOSES, COMPARTMENTS, resolveAccount, isUserAccount };
