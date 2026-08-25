// services/intercambioSettlement.service.js
//
// Único punto de la aritmética de settlement de intercambioExchange (el "otro"
// motor de trading: parExchange/intercambio). Antes esta lógica vivía inline en
// intercambioExchange.controller.js calculada con parseFloat + Number (float
// binario) y duplicada entre la ejecución (createExchange) y el preview
// (getExchangePreview) — de ahí que el monto mostrado pudiera diferir del
// ejecutado. Acá se calcula una sola vez, exacto con money.js (decimal.js), y se
// devuelve como string canónico. Los inputs externos (cantidadBase suele llegar
// como Number del body JSON; precio/comisión son DECIMAL de la DB) se normalizan
// con String() en el borde — el contrato de "montos como string" en la API es
// trabajo de la Fase 7.3.

const money = require('../utils/money');

// Redondeo a 8 decimales: es la escala de las columnas DECIMAL(28,8) donde
// terminan estos montos, y preserva el comportamiento del toFixed(8) previo,
// ahora con half-even determinista.
const ASSET_DECIMALS = 8;

/**
 * Calcula el settlement de un intercambio spot.
 *
 * @param {Object}  params
 * @param {number|string} params.cantidadBase        cantidad de la cripto base a operar
 * @param {number|string} params.precio              precio actual del par (quote por 1 base)
 * @param {number|string} params.comisionPorcentaje  comisión del par, en porcentaje (ej. '0.1' = 0.1%)
 * @param {'compra'|'venta'} params.tipo             dirección de la operación
 * @returns {{cantidadQuote: string, comisionMonto: string, requiredQuote: string, netQuote: string, cantidadFinal: string}}
 *   Todos los montos como string canónico:
 *   - cantidadQuote:  valor de la operación en moneda quote (base * precio)
 *   - comisionMonto:  comisión cobrada, siempre en moneda quote
 *   - requiredQuote:  quote a debitar al comprador (cantidadQuote + comisión)
 *   - netQuote:       quote a acreditar al vendedor (cantidadQuote - comisión)
 *   - cantidadFinal:  monto "final" para mostrar (requiredQuote en compra, netQuote en venta)
 */
function calculateSettlement({ cantidadBase, precio, comisionPorcentaje, tipo }) {
  const cantidadQuote = money.round(
    money.multiply(String(cantidadBase), String(precio)),
    ASSET_DECIMALS
  );

  const comisionRate = money.divide(String(comisionPorcentaje), '100');
  const comisionMonto = money.round(
    money.multiply(cantidadQuote, comisionRate),
    ASSET_DECIMALS
  );

  const requiredQuote = money.add(cantidadQuote, comisionMonto);
  const netQuote = money.subtract(cantidadQuote, comisionMonto);
  const cantidadFinal = tipo === 'compra' ? requiredQuote : netQuote;

  return { cantidadQuote, comisionMonto, requiredQuote, netQuote, cantidadFinal };
}

module.exports = { calculateSettlement };
