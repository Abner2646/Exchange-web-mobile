const axios = require('axios');
const crypto = require('crypto');
const businessConfig = require('../config/businessConfig');

// PII Sanitization rules:
// 1. Mask emails to format: fi***@domain.com
// 2. Mask full wallet addresses to show only first 6 and last 4 characters.
// 3. Redact raw amounts (e.g. keys containing 'amount' or 'balance') with '[REDACTED_AMOUNT]'
// 4. Hash user ids (e.g. 'userId', 'uid') to omit PII but retain traceabilty
// 5. Redact keys on a predefined denylist (password, token, secret, cvv, etc)
// Key-name substrings that force redaction. Includes custody-critical secrets: a leaked
// private key / seed / mnemonic to the alert channel would be catastrophic for a custodial
// exchange, so err heavily toward over-redaction here.
const PII_DENYLIST = [
  'password', 'token', 'secret', 'cvv', 'card', 'pin',
  'private', 'privkey', 'seed', 'mnemonic', 'passphrase',
  'apikey', 'api_key', 'auth', 'credential', 'signature',
];

function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  // Mask Emails
  let result = str.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, (match) => {
    const parts = match.split('@');
    if (parts.length !== 2) return match;
    const [name, domain] = parts;
    const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : '***';
    return `${maskedName}@${domain}`;
  });

  // Mask Wallet Addresses (Heuristic: 0x followed by 40 hex chars, or standard base58/bech32 lengths)
  result = result.replace(/\b(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-zA-HJ-NP-Z0-9]{25,39})\b/g, (match) => {
    return `${match.slice(0, 6)}...${match.slice(-4)}`;
  });

  return result;
}

function sanitize(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }

  if (typeof data === 'object') {
    const sanitizedObj = {};
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase();

      // Secret denylist FIRST (fail-closed): a key naming a secret is redacted before any
      // other rule, so e.g. 'walletPrivateKey' cannot slip through the address/wallet branch.
      if (PII_DENYLIST.some(denied => keyLower.includes(denied))) {
        sanitizedObj[key] = '[REDACTED]';
        continue;
      }

      // Hash User IDs
      if (keyLower === 'userid' || keyLower === 'uid' || keyLower === 'user_id') {
        sanitizedObj[key] = value ? crypto.createHash('sha256').update(String(value)).digest('hex').substring(0, 8) : '[OMITTED]';
        continue;
      }

      // Redact Raw Amounts
      if (keyLower.includes('amount') || keyLower.includes('balance') || keyLower === 'qty' || keyLower === 'quantity') {
        sanitizedObj[key] = '[REDACTED_AMOUNT]';
        continue;
      }

      // Explicit Email Key
      if (keyLower.includes('email')) {
         sanitizedObj[key] = typeof value === 'string' ? sanitizeString(value) : '[REDACTED_EMAIL]';
         continue;
      }

      // Explicit Address Key
      if (keyLower.includes('address') || keyLower.includes('wallet')) {
         sanitizedObj[key] = typeof value === 'string' ? sanitizeString(value) : '[REDACTED_ADDRESS]';
         continue;
      }

      // Recurse for nested objects
      sanitizedObj[key] = sanitize(value);
    }
    return sanitizedObj;
  }

  return data;
}

async function sendAlert({ severity = 'info', code, message, context = {} }) {
  try {
    const isEnabledEnv = process.env.TELEGRAM_ALERTS_ENABLED === 'true';
    const isEnabled = await businessConfig.getBoolean('TELEGRAM_ALERTS_ENABLED', isEnabledEnv);

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ALERT_CHAT_ID;

    if (!isEnabled || !token || !chatId) {
      console.debug('Telegram alerts disabled or missing configuration. Skipping alert.');
      return { sent: false, reason: 'disabled' };
    }

    const sanitizedContext = sanitize(context);
    const sanitizedMessage = sanitizeString(message || '');

    const textPayload = `[${severity.toUpperCase()}] ${code || 'ALERT'}\nMessage: ${sanitizedMessage}\nContext: ${JSON.stringify(sanitizedContext, null, 2)}`;

    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: textPayload,
      },
      { timeout: 5000 }
    );

    return { sent: true };
  } catch (error) {
    console.error('Failed to send telegram alert:', error.message);
    return { sent: false, reason: 'transport_error' };
  }
}

module.exports = { sendAlert, sanitize };
