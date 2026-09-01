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
//  - el usuario paga en una cripto y recibe en la otra (compartimento Funding —
//    el compartimento Spot es una feature de producto separada),
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
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const base = String(cantidadBase);
  const neg = (x) => money.subtract('0', String(x));

  let lineas;
  if (tipo === 'compra') {
    // Paga requiredQuote (valor+comisión) en quote, recibe cantidadBase en base.
    lineas = [
      { ownerId: usuarioId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: criptoQuoteId, monto: neg(requiredQuote) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoQuoteId, monto: String(cantidadQuote) },
      { ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: criptoQuoteId, monto: String(comisionMonto) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoBaseId, monto: neg(base) },
      { ownerId: usuarioId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: criptoBaseId, monto: base },
    ];
  } else {
    // Paga cantidadBase en base, recibe netQuote (valor−comisión) en quote.
    lineas = [
      { ownerId: usuarioId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: criptoBaseId, monto: neg(base) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoBaseId, monto: base },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoQuoteId, monto: neg(cantidadQuote) },
      { ownerId: usuarioId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: criptoQuoteId, monto: String(netQuote) },
      { ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: criptoQuoteId, monto: String(comisionMonto) },
    ];
  }

  return postTransaction({ tipo: 'swap', referencia, descripcion: `Swap ${tipo}`, lineas }, transaction);
}

// Liquida un trade spot user↔user (order book). Un solo asiento, net-zero por
// cripto. A diferencia del swap (contra treasury), acá las contrapartes son los
// dos usuarios; la casa sólo cobra su comisión:
//  - BASE: el vendedor libera lo bloqueado; el comprador recibe (cantidad − feeComprador);
//    fee_revenue cobra feeComprador (taker/maker según lado, en base).
//  - QUOTE: el comprador libera lo bloqueado (cantidad·precio); el vendedor recibe
//    (montoQuote − feeVendedor); fee_revenue cobra feeVendedor (en quote).
// Reemplaza los 4 updateBalance (funding+suspense) del settlement previo, en el
// que ambas comisiones desaparecían implícitamente (las absorbía suspense).
async function liquidarTrade({
  compradorId, vendedorId, baseAssetId, quoteAssetId,
  cantidad, montoQuote, feeComprador, feeVendedor, referencia,
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const neg = (x) => money.subtract('0', String(x));
  const baseNeto = money.subtract(String(cantidad), String(feeComprador));
  const quoteNeto = money.subtract(String(montoQuote), String(feeVendedor));

  const lineas = [
    // BASE: vendedor (bloqueado) → comprador (disponible) + fee_revenue.
    { ownerId: vendedorId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: baseAssetId, monto: neg(cantidad) },
    { ownerId: compradorId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: baseAssetId, monto: baseNeto },
    // QUOTE: comprador (bloqueado) → vendedor (disponible) + fee_revenue.
    { ownerId: compradorId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: quoteAssetId, monto: neg(montoQuote) },
    { ownerId: vendedorId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: quoteAssetId, monto: quoteNeto },
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

module.exports = { liquidarSwap, liquidarTrade };
