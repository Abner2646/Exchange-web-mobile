/**
 * shared/money/money.ts
 *
 * Canonical money core for the web frontend. Security-critical: this is the ONLY
 * place the app is allowed to interpret, compute, or format monetary amounts.
 *
 * GOLDEN RULES
 * 1. Money never touches a JS `number` / `parseFloat` / unary `+` / native math.
 *    IEEE-754 binary64 cannot represent 0.1 exactly (`0.1 + 0.2 !== 0.3`), which
 *    is precisely the class of bug this module exists to prevent.
 * 2. The wire/canonical form is a decimal STRING with a `.` decimal separator and
 *    NO thousands separator (e.g. "0.69700000", "-12.5", "0"). This matches
 *    backend/utils/money.js exactly (decimal.js, base-10, banker's rounding).
 * 3. Locale is a RENDER-EDGE concern only. User input in any locale ("0,300" in
 *    es-AR, "0.300" in en-US) is parsed into a validated canonical string BEFORE
 *    it leaves the input layer; canonical strings are formatted to the user's
 *    locale only for display. Interpretation is DETERMINISTIC given the locale,
 *    never a heuristic guess.
 *
 * The `CanonicalAmount` branded type makes the compiler enforce rule 2: a raw
 * `string` or `number` cannot be passed where a validated amount is required
 * without going through `toCanonical` / `parseInput`.
 */

import Decimal from 'decimal.js';

// High intermediate precision (40 significant digits covers 18-decimal wei with
// headroom for multiplication). Rounding to an asset's scale is always explicit
// and separate, in `round`/`formatCanonical`.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });

/**
 * A string proven to be in canonical decimal form: optional leading `-`, digits,
 * optional single `.` followed by digits. No grouping, no sign but `-`, no
 * scientific notation, no `Infinity`/`NaN`. Produced only by this module.
 */
export type CanonicalAmount = string & { readonly __canonical: unique symbol };

/** Anything this module will accept as a money value at an API boundary. */
export type Numeric = CanonicalAmount | string;

/** Structured result of parsing untrusted user input. */
export type ParseError =
  | 'EMPTY'
  | 'NEGATIVE_NOT_ALLOWED'
  | 'INVALID_CHARACTERS'
  | 'INVALID_FORMAT'
  | 'EXCEEDS_MAX_DECIMALS';

export type ParseResult =
  | { ok: true; value: CanonicalAmount }
  | { ok: false; error: ParseError; maxDecimals?: number };

// Shape of a canonical decimal string. Deliberately strict: rejects "", "1.",
// ".5", "+1", "1e3", "0x1f", "Infinity", "NaN", "1,5".
const CANONICAL_RE = /^-?\d+(\.\d+)?$/;

/**
 * Runtime type guard. Note it validates SHAPE only; `toCanonical` additionally
 * normalizes (e.g. strips a redundant sign on zero, collapses leading zeros).
 */
export function isCanonical(value: unknown): value is CanonicalAmount {
  return typeof value === 'string' && CANONICAL_RE.test(value);
}

/**
 * Normalize any already-canonical-ish string into a guaranteed `CanonicalAmount`.
 * Throws on anything that is not a strict canonical decimal string. This is the
 * single branding entry point (e.g. an API response decoder calls it).
 *
 * Numbers are rejected on purpose: a `number` may already have lost precision
 * before reaching us, so the caller must supply a string.
 */
export function toCanonical(value: Numeric): CanonicalAmount {
  if (typeof value !== 'string') {
    throw new TypeError(
      `money: expected a canonical string, received ${typeof value}. Pass amounts as strings ` +
        `(e.g. money.add("0.1", "0.2")) — numbers can already have lost precision.`,
    );
  }
  const trimmed = value.trim();
  if (!CANONICAL_RE.test(trimmed)) {
    throw new TypeError(`money: "${value}" is not a canonical decimal string.`);
  }
  // Normalize through Decimal so "-0" -> "0", "007" -> "7", "01.50" -> "1.5".
  return new Decimal(trimmed).toFixed() as CanonicalAmount;
}

/** Internal: validate + build a Decimal. Never accepts a JS number. */
function dec(value: Numeric): Decimal {
  return new Decimal(toCanonical(value));
}

/** a + b */
export function add(a: Numeric, b: Numeric): CanonicalAmount {
  return dec(a).plus(dec(b)).toFixed() as CanonicalAmount;
}

/** a - b */
export function subtract(a: Numeric, b: Numeric): CanonicalAmount {
  return dec(a).minus(dec(b)).toFixed() as CanonicalAmount;
}

/** a * b */
export function multiply(a: Numeric, b: Numeric): CanonicalAmount {
  return dec(a).times(dec(b)).toFixed() as CanonicalAmount;
}

/** a / b (throws on division by zero). Result carries intermediate precision. */
export function divide(a: Numeric, b: Numeric): CanonicalAmount {
  const denom = dec(b);
  if (denom.isZero()) {
    throw new RangeError('money: division by zero is not allowed.');
  }
  return dec(a).dividedBy(denom).toFixed() as CanonicalAmount;
}

/** Round to `decimalPlaces` using banker's rounding (half-even). */
export function round(value: Numeric, decimalPlaces = 8): CanonicalAmount {
  return dec(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN).toFixed() as CanonicalAmount;
}

/** -value (normalizes -0 to 0). */
export function negate(value: Numeric): CanonicalAmount {
  return subtract('0', value);
}

/** Canonical string padded/rounded to exactly `decimalPlaces` decimals. */
export function formatCanonical(value: Numeric, decimalPlaces = 8): CanonicalAmount {
  return dec(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN).toFixed(decimalPlaces) as CanonicalAmount;
}

/** Uniform 8-decimal canonical string (the balance display standard). */
export function format8(value: Numeric): CanonicalAmount {
  return formatCanonical(value, 8);
}

/** Exact comparison: -1 (a<b), 0 (a===b), 1 (a>b). */
export function compare(a: Numeric, b: Numeric): -1 | 0 | 1 {
  return dec(a).comparedTo(dec(b)) as -1 | 0 | 1;
}

export const eq = (a: Numeric, b: Numeric): boolean => compare(a, b) === 0;
export const gt = (a: Numeric, b: Numeric): boolean => compare(a, b) > 0;
export const gte = (a: Numeric, b: Numeric): boolean => compare(a, b) >= 0;
export const lt = (a: Numeric, b: Numeric): boolean => compare(a, b) < 0;
export const lte = (a: Numeric, b: Numeric): boolean => compare(a, b) <= 0;
export const isZero = (value: Numeric): boolean => eq(value, '0');
export const isPositive = (value: Numeric): boolean => gt(value, '0');
export const isNegative = (value: Numeric): boolean => lt(value, '0');

/** Resolve a locale's grouping/decimal/minus symbols via Intl (no floats used
 * for the value itself — the sample is only to read the separators). */
function localeSeparators(locale: string): { group: string; decimal: string; minus: string } {
  const parts = new Intl.NumberFormat(locale).formatToParts(-11111.1);
  return {
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    minus: parts.find((p) => p.type === 'minusSign')?.value ?? '-',
  };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ParseOptions {
  /** BCP-47 locale that determines how separators are interpreted. Required so
   * that "1,234" is never resolved by guesswork. */
  locale: string;
  maxDecimals?: number;
  allowNegative?: boolean;
}

/**
 * Parse untrusted user input into a validated `CanonicalAmount`, interpreting
 * separators according to the given locale. DETERMINISTIC: the same input under
 * the same locale always yields the same result; ambiguity is resolved by the
 * locale, not by a heuristic. Rejects any character that is not a digit, the
 * locale's group/decimal separators, an ASCII/locale minus, or whitespace — so
 * "1e3", "0x1f", "Infinity", and stray letters are refused, not coerced.
 */
export function parseInput(rawInput: unknown, options: ParseOptions): ParseResult {
  const { locale, maxDecimals = 8, allowNegative = false } = options;

  if (rawInput === null || rawInput === undefined) {
    return { ok: false, error: 'EMPTY' };
  }
  let str = String(rawInput).trim();
  if (str === '') {
    return { ok: false, error: 'EMPTY' };
  }

  const { group, decimal, minus } = localeSeparators(locale);

  // Sign: accept the locale minus sign or an ASCII hyphen.
  let isNeg = false;
  if (str.startsWith(minus) || str.startsWith('-')) {
    isNeg = true;
    str = str.slice(str.startsWith(minus) ? minus.length : 1).trim();
  }
  if (isNeg && !allowNegative) {
    return { ok: false, error: 'NEGATIVE_NOT_ALLOWED' };
  }

  // A grouping separator must never appear to the right of the decimal separator.
  const decIdx = str.indexOf(decimal);
  if (decIdx !== -1 && str.indexOf(group, decIdx) !== -1) {
    return { ok: false, error: 'INVALID_FORMAT' };
  }

  // Reject anything that is not a digit, the group separator, or the decimal
  // separator. This is the guard that refuses "1e3", "0x1f", "Infinity", "abc".
  const allowed = new RegExp(`^(?:\\d|${escapeRe(group)}|${escapeRe(decimal)})+$`);
  if (!allowed.test(str)) {
    return { ok: false, error: 'INVALID_CHARACTERS' };
  }

  // Strip grouping, normalize the decimal separator to '.'.
  const normalized = str.split(group).join('').split(decimal).join('.');

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return { ok: false, error: 'INVALID_FORMAT' };
  }

  const [, fraction = ''] = normalized.split('.');
  if (fraction.length > maxDecimals) {
    return { ok: false, error: 'EXCEEDS_MAX_DECIMALS', maxDecimals };
  }

  try {
    const canonical = toCanonical((isNeg ? '-' : '') + normalized);
    return { ok: true, value: canonical };
  } catch {
    return { ok: false, error: 'INVALID_FORMAT' };
  }
}

/**
 * Back-compat alias for the legacy name. Prefer `parseInput`. Unlike the old
 * heuristic implementation this REQUIRES a locale in options.
 */
export function parseInputToCanonical(rawInput: unknown, options: ParseOptions): ParseResult {
  return parseInput(rawInput, options);
}

export interface DisplayOptions {
  locale: string;
  minDecimals?: number;
  maxDecimals?: number;
  stripTrailingZeros?: boolean;
}

/**
 * Format a canonical amount for display in the user's locale. The integer part
 * is grouped via Intl over a BigInt (never a float), and the locale's decimal
 * separator is applied to an exactly-rounded fraction.
 */
export function formatDisplay(value: Numeric, options: DisplayOptions): string {
  const { locale, minDecimals = 2, maxDecimals = 8, stripTrailingZeros = false } = options;

  const rounded = round(value, maxDecimals);
  const isNeg = rounded.startsWith('-');
  const abs = isNeg ? rounded.slice(1) : rounded;
  const [intPart, decPartRaw = ''] = abs.split('.');

  const { decimal: decimalSep } = localeSeparators(locale);

  let formattedInt: string;
  try {
    formattedInt = new Intl.NumberFormat(locale, { useGrouping: true }).format(BigInt(intPart));
  } catch {
    formattedInt = intPart;
  }

  let fraction = decPartRaw;
  if (fraction.length < minDecimals) {
    fraction = fraction.padEnd(minDecimals, '0');
  }
  if (stripTrailingZeros && fraction.length > minDecimals) {
    fraction = fraction.replace(/0+$/, '');
    if (fraction.length < minDecimals) {
      fraction = fraction.padEnd(minDecimals, '0');
    }
  }

  // Only show a sign for a value that is actually non-zero after rounding.
  const nonZero = intPart !== '0' || /[1-9]/.test(fraction);
  const sign = isNeg && nonZero ? '-' : '';

  return fraction.length === 0
    ? `${sign}${formattedInt}`
    : `${sign}${formattedInt}${decimalSep}${fraction}`;
}
