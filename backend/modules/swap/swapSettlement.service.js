// modules/swap/swapSettlement.service.js
//
// Único punto de la aritmética de settlement de un swap (parExchange/intercambio,
// el motor de intercambio instantáneo contra la casa). Antes esta lógica vivía
// inline en el controller calculada con parseFloat + Number (float binario) y
// duplicada entre la ejecución (createSwap) y el preview (getSwapPreview) — de
// ahí que el monto mostrado pudiera diferir del ejecutado. Acá se calcula una
// sola vez, exacto con money.js (decimal.js), y se devuelve como string canónico.
// Los inputs externos (baseAmount suele llegar como Number del body JSON; price y
// feePercent son DECIMAL de la DB) se normalizan con String() en el borde — el
// contrato de "montos como string" en la API es trabajo de la Fase 7.3.

const money = require('../../utils/money');

// Redondeo a 8 decimals: es la escala de las columnas DECIMAL(28,8) donde
// terminan estos montos, y preserva el comportamiento del toFixed(8) previo,
// ahora con half-even determinista.
const ASSET_DECIMALS = 8;

/**
 * Calcula el settlement de un swap spot.
 *
 * @param {Object}  params
 * @param {number|string} params.baseAmount   cantidad de la cripto base a operar
 * @param {number|string} params.price        precio actual del par (quote por 1 base)
 * @param {number|string} params.feePercent   comisión del par, en porcentaje (ej. '0.1' = 0.1%)
 * @param {'buy'|'sell'}  params.type          dirección de la operación
 * @returns {{quoteAmount: string, feeAmount: string, requiredQuote: string, netQuote: string, finalAmount: string}}
 *   Todos los montos como string canónico:
 *   - quoteAmount:   valor de la operación en moneda quote (base * price)
 *   - feeAmount:     comisión cobrada, siempre en moneda quote
 *   - requiredQuote: quote a debitar al comprador (quoteAmount + fee)
 *   - netQuote:      quote a acreditar al vendedor (quoteAmount - fee)
 *   - finalAmount:   monto "final" para mostrar (requiredQuote en buy, netQuote en sell)
 */
function calculateSettlement({ baseAmount, price, feePercent, type }) {
  const quoteAmount = money.round(
    money.multiply(String(baseAmount), String(price)),
    ASSET_DECIMALS
  );

  const feeRate = money.divide(String(feePercent), '100');
  const feeAmount = money.round(
    money.multiply(quoteAmount, feeRate),
    ASSET_DECIMALS
  );

  const requiredQuote = money.add(quoteAmount, feeAmount);
  const netQuote = money.subtract(quoteAmount, feeAmount);
  const finalAmount = type === 'buy' ? requiredQuote : netQuote;

  return { quoteAmount, feeAmount, requiredQuote, netQuote, finalAmount };
}

module.exports = { calculateSettlement };
