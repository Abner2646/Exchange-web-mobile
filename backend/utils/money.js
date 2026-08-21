// utils/money.js
//
// Único punto de aritmética de dinero del backend. Regla: ningún monto pasa
// jamás por un Number de JS (IEEE 754 binary64) — ese formato binario no puede
// representar 0.1 exacto y es la causa de los "errores de coma". Todo se opera
// con decimal.js (base 10 por software) y se mueve como string canónico
// (punto decimal, sin separador de miles).
//
// Redondeo: half-even (banker's rounding), el estándar de BigDecimal (Java),
// decimal (Python/.NET) e IEEE 754 decimal.

const Decimal = require('decimal.js');

// Precisión alta para cálculos intermedios (40 dígitos significativos cubren 18
// decimales — wei — con margen para multiplicaciones). El redondeo a la
// precisión del activo se hace explícito y aparte, en roundForAsset/round.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

// Guarda anti-float en el borde de entrada: un Number no-entero (típicamente el
// resultado de un parseFloat previo) ya perdió precisión antes de llegar acá, así
// que se rechaza para no propagar el error. Los enteros seguros (exactos en
// float) se permiten por comodidad; strings y Decimal son el camino normal.
function toDecimal(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new TypeError(
      `money: se recibió un Number no seguro (${value}). Los montos deben pasarse como ` +
        `string para no perder precisión con el float binario IEEE 754 — ej. money.add('0.1', '0.2').`
    );
  }
  return new Decimal(value);
}

function add(a, b) {
  return toDecimal(a).plus(toDecimal(b)).toFixed();
}

function subtract(a, b) {
  return toDecimal(a).minus(toDecimal(b)).toFixed();
}

function multiply(a, b) {
  return toDecimal(a).times(toDecimal(b)).toFixed();
}

// La división puede dar decimales infinitos (1/3): decimal.js la resuelve a la
// precisión configurada (40 dígitos). El redondeo a la precisión del activo es
// responsabilidad explícita de roundForAsset, no de acá.
function divide(a, b) {
  return toDecimal(a).dividedBy(toDecimal(b)).toFixed();
}

// Redondea a `decimalPlaces` con half-even (banker's rounding). El modo se pasa
// explícito para no depender del default global de decimal.js.
function round(value, decimalPlaces) {
  return toDecimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN).toFixed();
}

module.exports = { add, subtract, multiply, divide, round };
