// modules/balances/ledger/operations.js
//
// Operaciones de dominio del ledger (spec §5): arman las líneas del asiento
// rico por operación y llaman a la primitiva postTransaction. Los money-paths
// llaman a ESTAS, no a UserBalance.* (que es la fachada Funding+suspense).
//
// require LAZY de postingService/ledgerAccounts dentro de las funciones: este
// módulo puede ser cargado por código que a su vez carga models/index.js, y
// postingService hace require('../../../models') al tope → romper el ciclo.
//
// NOTA (Fase 6.2 chunk 3): los NOMBRES de parámetro de estas funciones-borde
// (usuarioId, criptomonedaId, cantidad, referencia, remitenteId, …) se DIFIEREN
// a inglés al chunk de cada dominio consumidor (trading/p2p/blockchain/swap),
// igual que las FK cruzadas — así este chunk no toca los ~20 call-sites de esos
// dominios aún en español. Las PRIMITIVAS internas del ledger (líneas, cuentas,
// postTransaction) ya son inglés puro; acá se mapea param→primitiva.

const money = require('../../../utils/money');

// Liquida un swap contra la casa. Un solo asiento, net-zero por cripto:
//  - el usuario paga en una cripto y recibe en la otra (compartimento a elección
//    del usuario: funding por default, o spot),
//  - la casa `treasury` es la contraparte de inventario (entrega/recibe el active),
//  - la comisión (en quote, igual que el modelo actual) acredita `fee_revenue`.
// Mantiene idénticos los saldos del usuario respecto del modelo previo; sólo el
// lado de la casa pasa de `suspense`/WalletMaestra a treasury+fee_revenue.
//
// Montos (strings canónicos desde calculateSettlement):
//   cantidadQuote  = base * precio            (valor de la operación en quote)
//   comisionMonto  = cantidadQuote * comision (siempre en quote)
//   requiredQuote  = cantidadQuote + comision (quote que paga el comprador)
//   netQuote       = cantidadQuote - comision (quote que recibe el vendedor)
async function settleSwap({
  usuarioId, criptoBaseId, criptoQuoteId, cantidadBase,
  cantidadQuote, comisionMonto, requiredQuote, netQuote, tipo, referencia,
  compartimento = 'funding',
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES, COMPARTMENTS } = require('./ledgerAccounts');
  const userPurpose = COMPARTMENTS[compartimento]?.available;
  if (!userPurpose) {
    throw new Error(`Compartimento inválido para swap: ${compartimento}`);
  }
  const base = String(cantidadBase);

  let lines;
  if (tipo === 'compra') {
    // Paga requiredQuote (valor+comisión) en quote, recibe cantidadBase en base.
    lines = [
      { ownerId: usuarioId, purpose: userPurpose, cryptoId: criptoQuoteId, amount: money.negate(String(requiredQuote)) },
      { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: criptoQuoteId, amount: String(cantidadQuote) },
      { ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: criptoQuoteId, amount: String(comisionMonto) },
      { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: criptoBaseId, amount: money.negate(base) },
      { ownerId: usuarioId, purpose: userPurpose, cryptoId: criptoBaseId, amount: base },
    ];
  } else {
    // Paga cantidadBase en base, recibe netQuote (valor−comisión) en quote.
    lines = [
      { ownerId: usuarioId, purpose: userPurpose, cryptoId: criptoBaseId, amount: money.negate(base) },
      { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: criptoBaseId, amount: base },
      { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: criptoQuoteId, amount: money.negate(String(cantidadQuote)) },
      { ownerId: usuarioId, purpose: userPurpose, cryptoId: criptoQuoteId, amount: String(netQuote) },
      { ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: criptoQuoteId, amount: String(comisionMonto) },
    ];
  }

  return postTransaction({ type: 'swap', reference: referencia, description: `Swap ${tipo}`, lines }, transaction);
}

// Liquida un trade spot user↔user (order book). Un solo asiento, net-zero por
// cripto. A diferencia del swap (contra treasury), acá las contrapartes son los
// dos usuarios; la casa sólo cobra su comisión. Spot: bloqueado→disponible en
// ambos lados (base para vendedor, quote para comprador).
async function settleTrade({
  compradorId, vendedorId, baseAssetId, quoteAssetId,
  cantidad, montoQuote, feeComprador, feeVendedor, referencia,
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const baseNet = money.subtract(String(cantidad), String(feeComprador));
  const quoteNet = money.subtract(String(montoQuote), String(feeVendedor));

  const lines = [
    // BASE: vendedor (bloqueado) → comprador (disponible) + fee_revenue.
    { ownerId: vendedorId, purpose: PURPOSES.SPOT_BLOCKED, cryptoId: baseAssetId, amount: money.negate(String(cantidad)) },
    { ownerId: compradorId, purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: baseAssetId, amount: baseNet },
    // QUOTE: comprador (bloqueado) → vendedor (disponible) + fee_revenue.
    { ownerId: compradorId, purpose: PURPOSES.SPOT_BLOCKED, cryptoId: quoteAssetId, amount: money.negate(String(montoQuote)) },
    { ownerId: vendedorId, purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: quoteAssetId, amount: quoteNet },
  ];
  // Las líneas de comisión sólo si el fee > 0 (evita cuentas/movimientos en cero).
  if (money.compare(String(feeComprador), '0') > 0) {
    lines.push({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: baseAssetId, amount: String(feeComprador) });
  }
  if (money.compare(String(feeVendedor), '0') > 0) {
    lines.push({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: quoteAssetId, amount: String(feeVendedor) });
  }

  return postTransaction({ type: 'liquidacion_trade', reference: referencia, description: 'Trade spot', lines }, transaction);
}

// Retiro transmitido/confirmado on-chain: los fondos bloqueados salen del
// custodio al mundo on-chain. funding:bloqueado −A → external_onchain +(A−wf),
// con fee_revenue +wf si el exchange cobra un fee de retiro (hoy wf=0). Se postea
// cuando el retiro se confirma en cadena (no en el broadcast: el reaper puede
// revertir un 'procesando' que nunca llegó, y ahí los fondos siguen bloqueados).
async function markWithdrawalTransmitted({
  userId, criptomonedaId, cantidad, feeRetiro = '0', referencia,
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const net = money.subtract(String(cantidad), String(feeRetiro));

  const lines = [
    { ownerId: userId, purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: criptomonedaId, amount: money.negate(String(cantidad)) },
    { ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: criptomonedaId, amount: net },
  ];
  if (money.compare(String(feeRetiro), '0') > 0) {
    lines.push({ ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: criptomonedaId, amount: String(feeRetiro) });
  }

  return postTransaction({ type: 'retiro', reference: referencia, description: 'Retiro transmitido on-chain', lines }, transaction);
}

// Depósito detectado on-chain (sin confirmar): el mundo on-chain acredita al
// usuario en estado PENDIENTE. external_onchain −A → funding:pendiente +A. El
// usuario ve el depósito como "pendiente" hasta que confirme.
async function registerPendingDeposit({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const lines = [
    { ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: criptomonedaId, amount: money.negate(String(cantidad)) },
    { ownerId: userId, purpose: PURPOSES.FUNDING_PENDING, cryptoId: criptomonedaId, amount: String(cantidad) },
  ];
  return postTransaction({ type: 'deposito', reference: referencia, description: 'Depósito detectado (pendiente)', lines }, transaction);
}

// Depósito confirmado: el saldo pendiente pasa a disponible.
// funding:pendiente −A → funding:disponible +A.
async function confirmDeposit({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const lines = [
    { ownerId: userId, purpose: PURPOSES.FUNDING_PENDING, cryptoId: criptomonedaId, amount: money.negate(String(cantidad)) },
    { ownerId: userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: String(cantidad) },
  ];
  return postTransaction({ type: 'deposito', reference: referencia, description: 'Depósito confirmado', lines }, transaction);
}

// Transferencia interna user↔user (mismo compartimento Funding, misma cripto).
// funding:disponible del remitente −A → funding:disponible del destinatario +A.
// Sin contraparte de casa (suma cero entre dos usuarios) → NO usa suspense. El
// anti-sobregiro del remitente lo da postTransaction (FOR UPDATE sobre la fila).
async function transferInternal({ remitenteId, destinatarioId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const lines = [
    { ownerId: remitenteId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: money.negate(String(cantidad)) },
    { ownerId: destinatarioId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: String(cantidad) },
  ];
  return postTransaction({ type: 'transferencia', reference: referencia, description: 'Transferencia interna', lines }, transaction);
}

// Liquida una transacción P2P: el cripto BLOQUEADO del vendedor pasa a
// DISPONIBLE del comprador (el pago fiat es off-platform). funding:bloqueado del
// vendedor −A → funding:disponible del comprador +A. Sin fee ni contraparte de
// casa (suma cero user↔user) → sin suspense. El bloqueo previo (blockBalance) y
// la cancelación (unblockBalance) ya son de dos patas de usuario sin suspense.
async function settleP2P({ vendedorId, compradorId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const lines = [
    { ownerId: vendedorId, purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: criptomonedaId, amount: money.negate(String(cantidad)) },
    { ownerId: compradorId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: String(cantidad) },
  ];
  return postTransaction({ type: 'liquidacion_p2p', reference: referencia, description: 'Liquidación P2P', lines }, transaction);
}

// Faucet de testnet (regalo único, deshabilitado en producción): el cripto entra
// desde el mundo on-chain (testnet) a disponible del usuario, como un depósito ya
// confirmado. external_onchain −A → funding:disponible +A. Sin suspense.
async function creditFaucet({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const lines = [
    { ownerId: null, purpose: PURPOSES.EXTERNAL_ONCHAIN, cryptoId: criptomonedaId, amount: money.negate(String(cantidad)) },
    { ownerId: userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: String(cantidad) },
  ];
  return postTransaction({ type: 'deposito', reference: referencia, description: 'Faucet testnet', lines }, transaction);
}

// Transferencia interna del MISMO usuario entre compartimentos (Funding↔Spot),
// misma cripto. Un asiento net-zero: {origen}:disponible −A → {destino}:disponible
// +A. Sin contraparte de casa (no cambia el patrimonio, sólo su ubicación). El
// anti-sobregiro del origen lo da postTransaction (FOR UPDATE sobre la fila).
// El propósito 'disponible' de cada compartimento sale del registro único
// COMPARTMENTS (ledgerAccounts), no de un mapa local.
async function transferBetweenCompartments({ userId, criptomonedaId, cantidad, origen, destino, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { COMPARTMENTS } = require('./ledgerAccounts');
  const fromPurpose = COMPARTMENTS[origen]?.available;
  const toPurpose = COMPARTMENTS[destino]?.available;
  if (!fromPurpose || !toPurpose || origen === destino) {
    throw new Error(`Compartimentos inválidos para transferencia: ${origen} → ${destino}`);
  }
  const amount = String(cantidad);
  const lines = [
    { ownerId: userId, purpose: fromPurpose, cryptoId: criptomonedaId, amount: money.negate(amount) },
    { ownerId: userId, purpose: toPurpose, cryptoId: criptomonedaId, amount },
  ];
  return postTransaction({ type: 'transferencia_compartimento', reference: referencia, description: `Transfer ${origen}→${destino}`, lines }, transaction);
}

// Reserva de saldo para una orden del order book, dentro de Spot.
// spot:disponible −A → spot:bloqueado +A. El anti-sobregiro lo da postTransaction.
async function reserveForOrder({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const amount = String(cantidad);
  const lines = [
    { ownerId: userId, purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: criptomonedaId, amount: money.negate(amount) },
    { ownerId: userId, purpose: PURPOSES.SPOT_BLOCKED, cryptoId: criptomonedaId, amount },
  ];
  return postTransaction({ type: 'reserva_orden', reference: referencia, description: 'Reserva de orden spot', lines }, transaction);
}

// Libera una reserva de orden (cancelación / remanente). spot:bloqueado −A →
// spot:disponible +A.
async function releaseReservation({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PURPOSES } = require('./ledgerAccounts');
  const amount = String(cantidad);
  const lines = [
    { ownerId: userId, purpose: PURPOSES.SPOT_BLOCKED, cryptoId: criptomonedaId, amount: money.negate(amount) },
    { ownerId: userId, purpose: PURPOSES.SPOT_AVAILABLE, cryptoId: criptomonedaId, amount },
  ];
  return postTransaction({ type: 'liberacion_reserva', reference: referencia, description: 'Liberación de reserva spot', lines }, transaction);
}

module.exports = {
  settleSwap, settleTrade, markWithdrawalTransmitted,
  registerPendingDeposit, confirmDeposit, transferInternal, settleP2P,
  creditFaucet, transferBetweenCompartments, reserveForOrder, releaseReservation,
};
