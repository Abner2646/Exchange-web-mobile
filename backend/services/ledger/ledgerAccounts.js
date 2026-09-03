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

// Registro ÚNICO compartimento→propósito por estado. Fuente de verdad para leer
// saldos por compartimento (la fachada BalanceUsuario) y para las operaciones que
// mueven 'disponible' entre compartimentos (services/ledger/operations). Spot no
// tiene 'pendiente'. Antes vivía duplicado en 3 lugares (PROPOSITOS_POR_COMPARTIMENTO
// en balanceUsuario.model + DISPONIBLE_POR_COMPARTIMENTO en operations + estos
// PROPOSITOS): agregar un compartimento requería tocar los tres y podían divergir.
const COMPARTIMENTOS = {
  funding: { disponible: PROPOSITOS.FUNDING_DISPONIBLE, bloqueado: PROPOSITOS.FUNDING_BLOQUEADO, pendiente: PROPOSITOS.FUNDING_PENDIENTE },
  spot: { disponible: PROPOSITOS.SPOT_DISPONIBLE, bloqueado: PROPOSITOS.SPOT_BLOQUEADO, pendiente: null },
};

async function resolveAccount({ ownerId, proposito, criptomonedaId }, transaction = null) {
  // Require lazy de models: mantiene este módulo libre de dependencias de carga,
  // así COMPARTIMENTOS/PROPOSITOS se pueden importar desde cualquier lado (incluido
  // el grafo de models) sin disparar el ciclo models↔ledger.
  const { CuentaLedger } = require('../../models');
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

module.exports = { HOUSE_OWNER_ID, PROPOSITOS, COMPARTIMENTOS, resolveAccount, isCuentaUsuario };
