/**
 * shared/money/money.js
 *
 * Módulo centralizado de cálculo y formateo de dinero exacto para el frontend.
 *
 * REGLA DE ORO: Ningún monto pasa jamás por un Number de JS ni parseFloat.
 * Todo cálculo utiliza decimal.js (base 10) con redondeo half-even (Banker's rounding),
 * garantizando paridad matemática exacta con backend/utils/money.js.
 */

const Decimal = require('decimal.js');

// Configuración de precisión intermedia y redondeo bancario (half-even)
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/**
 * Guarda anti-float en la entrada.
 * Rechaza números no-enteros para evitar que lleguen flotantes binarios IEEE 754
 * que ya perdieron precisión (ej. de un parseFloat previo).
 */
function toDecimal(value) {
  if (value === null || value === undefined || value === '') {
    throw new TypeError('money: se recibió un valor vacío o nulo.');
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        `money: se recibió un Number de punto flotante (${value}). Los montos deben pasarse como ` +
          `string canónico para evitar imprecisiones de coma flotante — ej. money.add('0.1', '0.2').`
      );
    }
    return new Decimal(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || isNaN(Number(trimmed))) {
      throw new TypeError(`money: "${value}" no es una representación numérica válida.`);
    }
    return new Decimal(trimmed);
  }

  if (value instanceof Decimal) {
    return value;
  }

  throw new TypeError(`money: tipo no soportado (${typeof value}).`);
}

/** Suma exacta: a + b */
function add(a, b) {
  return toDecimal(a).plus(toDecimal(b)).toFixed();
}

/** Resta exacta: a - b */
function subtract(a, b) {
  return toDecimal(a).minus(toDecimal(b)).toFixed();
}

/** Multiplicación exacta: a * b */
function multiply(a, b) {
  return toDecimal(a).times(toDecimal(b)).toFixed();
}

/** División exacta: a / b */
function divide(a, b) {
  const decB = toDecimal(b);
  if (decB.isZero()) {
    throw new RangeError('money: división por cero no permitida.');
  }
  return toDecimal(a).dividedBy(decB).toFixed();
}

/**
 * Redondea a `decimalPlaces` con half-even (banker's rounding).
 */
function round(value, decimalPlaces = 8) {
  return toDecimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN).toFixed();
}

/** Inversión de signo: -value */
function negate(value) {
  return subtract('0', value);
}

/**
 * Formatea a string canónico con exactamente N decimales (relleno con ceros a la derecha).
 */
function formatCanonical(value, decimalPlaces = 8) {
  return toDecimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN).toFixed(decimalPlaces);
}

/** Formato canónico uniforme de 8 decimales (estándar de saldos) */
function format8(value) {
  return formatCanonical(value, 8);
}

/**
 * Comparación exacta:
 * -1 si a < b
 *  0 si a === b
 *  1 si a > b
 */
function compare(a, b) {
  return toDecimal(a).comparedTo(toDecimal(b));
}

function eq(a, b) {
  return compare(a, b) === 0;
}

function gt(a, b) {
  return compare(a, b) > 0;
}

function gte(a, b) {
  return compare(a, b) >= 0;
}

function lt(a, b) {
  return compare(a, b) < 0;
}

function lte(a, b) {
  return compare(a, b) <= 0;
}

function isZero(value) {
  return eq(value, '0');
}

function isPositive(value) {
  return gt(value, '0');
}

function isNegative(value) {
  return lt(value, '0');
}

/**
 * Parsea el texto ingresado por el usuario en un input y lo normaliza
 * a un string decimal canónico (usando '.' como separador decimal).
 *
 * @param {string} rawInput Texto ingresado por el usuario (ej. "1.250,50" o "1250.50")
 * @param {Object} options Opciones de validación
 * @param {number} [options.maxDecimals=8] Cantidad máxima de decimales permitidos
 * @param {boolean} [options.allowNegative=false] Si permite valores negativos
 * @returns {{ ok: boolean, value?: string, error?: string }}
 */
function parseInputToCanonical(rawInput, options = {}) {
  const { maxDecimals = 8, allowNegative = false } = options;

  if (rawInput === null || rawInput === undefined || String(rawInput).trim() === '') {
    return { ok: false, error: 'EMPTY' };
  }

  let str = String(rawInput).trim();

  // Detección de signo negativo
  let isNeg = false;
  if (str.startsWith('-')) {
    if (!allowNegative) {
      return { ok: false, error: 'NEGATIVE_NOT_ALLOWED' };
    }
    isNeg = true;
    str = str.substring(1).trim();
  }

  // Normalización de separadores:
  // Si contiene comas y puntos: ej "1,234.56" o "1.234,56"
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastCommaIndex = str.lastIndexOf(',');
    const lastDotIndex = str.lastIndexOf('.');
    if (lastCommaIndex > lastDotIndex) {
      // Formato europeo/hispano: 1.234,56 -> 1234.56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,234.56 -> 1234.56
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Solo tiene comas: si hay una sola coma, actúa como decimal (ej "12,5" -> "12.5")
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount === 1) {
      str = str.replace(',', '.');
    } else {
      // Múltiples comas sin punto: inválido o miles ambiguos
      return { ok: false, error: 'INVALID_FORMAT' };
    }
  }

  // Validar formato decimal numérico estricto: opcionalmente dígitos, punto, dígitos
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return { ok: false, error: 'INVALID_CHARACTERS' };
  }

  // Comprobar cantidad de decimales
  const parts = str.split('.');
  if (parts[1] && parts[1].length > maxDecimals) {
    return { ok: false, error: 'EXCEEDS_MAX_DECIMALS', maxDecimals };
  }

  const canonical = (isNeg ? '-' : '') + str;
  return { ok: true, value: canonical };
}

/**
 * Formatea un monto decimal canónico para visualización en la interfaz.
 * Formatea la parte entera con separadores de miles según el locale sin perder
 * precisión decimal en flotantes.
 *
 * @param {string|number|Decimal} value Valor a formatear
 * @param {Object} options Opciones de visualización
 * @param {number} [options.minDecimals=2]
 * @param {number} [options.maxDecimals=8]
 * @param {string} [options.locale='es-AR']
 * @param {boolean} [options.stripTrailingZeros=false]
 * @returns {string}
 */
function formatDisplay(value, options = {}) {
  const { minDecimals = 2, maxDecimals = 8, locale = 'es-AR', stripTrailingZeros = false } = options;

  // Redondear primero a maxDecimals usando half-even exacto
  const rounded = round(value, maxDecimals);
  const isNeg = rounded.startsWith('-');
  const absValue = isNeg ? rounded.substring(1) : rounded;

  const [intPart, decPart = ''] = absValue.split('.');

  // Formatear la parte entera con Intl.NumberFormat
  let formattedInt = intPart;
  try {
    // Si la parte entera entra en un BigInt, la formateamos exactamente
    formattedInt = new Intl.NumberFormat(locale, { useGrouping: true }).format(BigInt(intPart));
  } catch {
    // Fallback básico si BigInt no está disponible
    formattedInt = intPart;
  }

  // Determinar el separador decimal del locale
  const sampleFormatted = new Intl.NumberFormat(locale).format(1.1);
  const decimalSeparator = sampleFormatted.includes(',') ? ',' : '.';

  let finalDec = decPart;

  // Ajustar cantidad de decimales
  if (finalDec.length < minDecimals) {
    finalDec = finalDec.padEnd(minDecimals, '0');
  }

  if (stripTrailingZeros && finalDec.length > minDecimals) {
    finalDec = finalDec.replace(/0+$/, '');
    if (finalDec.length < minDecimals) {
      finalDec = finalDec.padEnd(minDecimals, '0');
    }
  }

  const sign = isNeg && (intPart !== '0' || finalDec !== ''.padEnd(finalDec.length, '0')) ? '-' : '';

  if (finalDec.length === 0) {
    return `${sign}${formattedInt}`;
  }

  return `${sign}${formattedInt}${decimalSeparator}${finalDec}`;
}

module.exports = {
  toDecimal,
  add,
  subtract,
  multiply,
  divide,
  round,
  negate,
  formatCanonical,
  format8,
  compare,
  eq,
  gt,
  gte,
  lt,
  lte,
  isZero,
  isPositive,
  isNegative,
  parseInputToCanonical,
  formatDisplay,
};
