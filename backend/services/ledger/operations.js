// services/ledger/operations.js
//
// Operaciones de dominio del ledger (spec §5): arman las líneas del asiento
// rico por operación y llaman a la primitiva postTransaction. Los money-paths
// llaman a ESTAS, no a BalanceUsuario.* (que es la fachada Funding+suspense).
//
// require LAZY de postingService/ledgerAccounts dentro de las funciones: este
// módulo puede ser cargado por código que a su vez carga models/index.js, y
// postingService hace require('../../models') al tope → romper el ciclo.

const money = require('../../utils/money');

// Liquida un swap contra la casa. Un solo asiento, net-zero por cripto:
//  - el usuario paga en una cripto y recibe en la otra (compartimento a elección
//    del usuario: funding por default, o spot),
//  - la casa `treasury` es la contraparte de inventario (entrega/recibe el activo),
//  - la comisión (en quote, igual que el modelo actual) acredita `fee_revenue`.
// Mantiene idénticos los saldos del usuario respecto del modelo previo; sólo el
// lado de la casa pasa de `suspense`/WalletMaestra a treasury+fee_revenue.
//
// Montos (strings canónicos desde calculateSettlement):
//   cantidadQuote  = base * precio            (valor de la operación en quote)
//   comisionMonto  = cantidadQuote * comision (siempre en quote)
//   requiredQuote  = cantidadQuote + comision (quote que paga el comprador)
//   netQuote       = cantidadQuote - comision (quote que recibe el vendedor)
async function liquidarSwap({
  usuarioId, criptoBaseId, criptoQuoteId, cantidadBase,
  cantidadQuote, comisionMonto, requiredQuote, netQuote, tipo, referencia,
  compartimento = 'funding',
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS, COMPARTIMENTOS } = require('./ledgerAccounts');
  const propUsuario = COMPARTIMENTOS[compartimento]?.disponible;
  if (!propUsuario) {
    throw new Error(`Compartimento inválido para swap: ${compartimento}`);
  }
  const base = String(cantidadBase);

  let lineas;
  if (tipo === 'compra') {
    // Paga requiredQuote (valor+comisión) en quote, recibe cantidadBase en base.
    lineas = [
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoQuoteId, monto: money.negate(String(requiredQuote)) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoQuoteId, monto: String(cantidadQuote) },
      { ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: criptoQuoteId, monto: String(comisionMonto) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoBaseId, monto: money.negate(base) },
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoBaseId, monto: base },
    ];
  } else {
    // Paga cantidadBase en base, recibe netQuote (valor−comisión) en quote.
    lineas = [
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoBaseId, monto: money.negate(base) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoBaseId, monto: base },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoQuoteId, monto: money.negate(String(cantidadQuote)) },
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoQuoteId, monto: String(netQuote) },
      { ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: criptoQuoteId, monto: String(comisionMonto) },
    ];
  }

  return postTransaction({ tipo: 'swap', referencia, descripcion: `Swap ${tipo}`, lineas }, transaction);
}

// Liquida un trade spot user↔user (order book). Un solo asiento, net-zero por
// cripto. A diferencia del swap (contra treasury), acá las contrapartes son los
// dos usuarios; la casa sólo cobra su comisión. Spot: bloqueado→disponible en
// ambos lados (base para vendedor, quote para comprador).
async function liquidarTrade({
  compradorId, vendedorId, baseAssetId, quoteAssetId,
  cantidad, montoQuote, feeComprador, feeVendedor, referencia,
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const baseNeto = money.subtract(String(cantidad), String(feeComprador));
  const quoteNeto = money.subtract(String(montoQuote), String(feeVendedor));

  const lineas = [
    // BASE: vendedor (bloqueado) → comprador (disponible) + fee_revenue.
    { ownerId: vendedorId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: baseAssetId, monto: money.negate(String(cantidad)) },
    { ownerId: compradorId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: baseAssetId, monto: baseNeto },
    // QUOTE: comprador (bloqueado) → vendedor (disponible) + fee_revenue.
    { ownerId: compradorId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: quoteAssetId, monto: money.negate(String(montoQuote)) },
    { ownerId: vendedorId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: quoteAssetId, monto: quoteNeto },
  ];
  // Las líneas de comisión sólo si el fee > 0 (evita cuentas/movimientos en cero).
  if (money.compare(String(feeComprador), '0') > 0) {
    lineas.push({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: baseAssetId, monto: String(feeComprador) });
  }
  if (money.compare(String(feeVendedor), '0') > 0) {
    lineas.push({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: quoteAssetId, monto: String(feeVendedor) });
  }

  return postTransaction({ tipo: 'liquidacion_trade', referencia, descripcion: 'Trade spot', lineas }, transaction);
}

// Retiro transmitido/confirmado on-chain: los fondos bloqueados salen del
// custodio al mundo on-chain. funding:bloqueado −A → external_onchain +(A−wf),
// con fee_revenue +wf si el exchange cobra un fee de retiro (hoy wf=0). Se postea
// cuando el retiro se confirma en cadena (no en el broadcast: el reaper puede
// revertir un 'procesando' que nunca llegó, y ahí los fondos siguen bloqueados).
async function marcarRetiroTransmitido({
  userId, criptomonedaId, cantidad, feeRetiro = '0', referencia,
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const neto = money.subtract(String(cantidad), String(feeRetiro));

  const lineas = [
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto: money.negate(String(cantidad)) },
    { ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId, monto: neto },
  ];
  if (money.compare(String(feeRetiro), '0') > 0) {
    lineas.push({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId, monto: String(feeRetiro) });
  }

  return postTransaction({ tipo: 'retiro', referencia, descripcion: 'Retiro transmitido on-chain', lineas }, transaction);
}

// Depósito detectado on-chain (sin confirmar): el mundo on-chain acredita al
// usuario en estado PENDIENTE. external_onchain −A → funding:pendiente +A. El
// usuario ve el depósito como "pendiente" hasta que confirme.
async function registrarDepositoPendiente({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const lineas = [
    { ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId, monto: money.negate(String(cantidad)) },
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_PENDIENTE, criptomonedaId, monto: String(cantidad) },
  ];
  return postTransaction({ tipo: 'deposito', referencia, descripcion: 'Depósito detectado (pendiente)', lineas }, transaction);
}

// Depósito confirmado: el saldo pendiente pasa a disponible.
// funding:pendiente −A → funding:disponible +A.
async function confirmarDeposito({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const lineas = [
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_PENDIENTE, criptomonedaId, monto: money.negate(String(cantidad)) },
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: String(cantidad) },
  ];
  return postTransaction({ tipo: 'deposito', referencia, descripcion: 'Depósito confirmado', lineas }, transaction);
}

// Transferencia interna user↔user (mismo compartimento Funding, misma cripto).
// funding:disponible del remitente −A → funding:disponible del destinatario +A.
// Sin contraparte de casa (suma cero entre dos usuarios) → NO usa suspense. El
// anti-sobregiro del remitente lo da postTransaction (FOR UPDATE sobre la fila).
async function transferirInterno({ remitenteId, destinatarioId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const lineas = [
    { ownerId: remitenteId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: money.negate(String(cantidad)) },
    { ownerId: destinatarioId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: String(cantidad) },
  ];
  return postTransaction({ tipo: 'transferencia', referencia, descripcion: 'Transferencia interna', lineas }, transaction);
}

// Liquida una transacción P2P: el cripto BLOQUEADO del vendedor pasa a
// DISPONIBLE del comprador (el pago fiat es off-platform). funding:bloqueado del
// vendedor −A → funding:disponible del comprador +A. Sin fee ni contraparte de
// casa (suma cero user↔user) → sin suspense. El bloqueo previo (blockBalance) y
// la cancelación (unblockBalance) ya son de dos patas de usuario sin suspense.
async function liquidarP2P({ vendedorId, compradorId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const lineas = [
    { ownerId: vendedorId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto: money.negate(String(cantidad)) },
    { ownerId: compradorId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: String(cantidad) },
  ];
  return postTransaction({ tipo: 'liquidacion_p2p', referencia, descripcion: 'Liquidación P2P', lineas }, transaction);
}

// Faucet de testnet (regalo único, deshabilitado en producción): el cripto entra
// desde el mundo on-chain (testnet) a disponible del usuario, como un depósito ya
// confirmado. external_onchain −A → funding:disponible +A. Sin suspense.
async function acreditarFaucet({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const lineas = [
    { ownerId: null, proposito: PROPOSITOS.EXTERNAL_ONCHAIN, criptomonedaId, monto: money.negate(String(cantidad)) },
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: String(cantidad) },
  ];
  return postTransaction({ tipo: 'deposito', referencia, descripcion: 'Faucet testnet', lineas }, transaction);
}

// Transferencia interna del MISMO usuario entre compartimentos (Funding↔Spot),
// misma cripto. Un asiento net-zero: {origen}:disponible −A → {destino}:disponible
// +A. Sin contraparte de casa (no cambia el patrimonio, sólo su ubicación). El
// anti-sobregiro del origen lo da postTransaction (FOR UPDATE sobre la fila).
// El propósito 'disponible' de cada compartimento sale del registro único
// COMPARTIMENTOS (ledgerAccounts), no de un mapa local.
async function transferirEntreCompartimentos({ userId, criptomonedaId, cantidad, origen, destino, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { COMPARTIMENTOS } = require('./ledgerAccounts');
  const propOrigen = COMPARTIMENTOS[origen]?.disponible;
  const propDestino = COMPARTIMENTOS[destino]?.disponible;
  if (!propOrigen || !propDestino || origen === destino) {
    throw new Error(`Compartimentos inválidos para transferencia: ${origen} → ${destino}`);
  }
  const monto = String(cantidad);
  const lineas = [
    { ownerId: userId, proposito: propOrigen, criptomonedaId, monto: money.negate(monto) },
    { ownerId: userId, proposito: propDestino, criptomonedaId, monto },
  ];
  return postTransaction({ tipo: 'transferencia_compartimento', referencia, descripcion: `Transferencia ${origen}→${destino}`, lineas }, transaction);
}

// Reserva de saldo para una orden del order book, dentro de Spot.
// spot:disponible −A → spot:bloqueado +A. El anti-sobregiro lo da postTransaction.
async function reservarParaOrden({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const monto = String(cantidad);
  const lineas = [
    { ownerId: userId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId, monto: money.negate(monto) },
    { ownerId: userId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId, monto },
  ];
  return postTransaction({ tipo: 'reserva_orden', referencia, descripcion: 'Reserva de orden spot', lineas }, transaction);
}

// Libera una reserva de orden (cancelación / remanente). spot:bloqueado −A →
// spot:disponible +A.
async function liberarReserva({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const monto = String(cantidad);
  const lineas = [
    { ownerId: userId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId, monto: money.negate(monto) },
    { ownerId: userId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId, monto },
  ];
  return postTransaction({ tipo: 'liberacion_reserva', referencia, descripcion: 'Liberación de reserva spot', lineas }, transaction);
}

module.exports = {
  liquidarSwap, liquidarTrade, marcarRetiroTransmitido,
  registrarDepositoPendiente, confirmarDeposito, transferirInterno, liquidarP2P,
  acreditarFaucet, transferirEntreCompartimentos, reservarParaOrden, liberarReserva,
};
