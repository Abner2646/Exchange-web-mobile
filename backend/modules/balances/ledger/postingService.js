const money = require('../../../utils/money');
const { sequelize, LedgerAccount, LedgerEntry, LedgerMovement, LedgerBalance } = require('../../../models');
const { resolveAccount, isUserAccount, HOUSE_OWNER_ID } = require('./ledgerAccounts');

// Error tipado de sobregiro. Los callers lo distinguen por `code === 'OVERDRAFT'`
// (no por regex sobre el mensaje, que se rompe en silencio si el texto cambia)
// para traducirlo al mensaje de dominio /insuficiente/ del contrato.
class OverdraftError extends Error {
  constructor(purpose, balance, amount) {
    super(`Overdraft on account ${purpose}: balance ${balance}, movement ${amount}`);
    this.name = 'OverdraftError';
    this.code = 'OVERDRAFT';
  }
}

// Invariante de partida doble: dentro de un asiento, la suma con signo de los
// montos debe dar 0 POR CADA cripto (un swap cruza dos criptos y cada una
// cuadra sola).
function validateZeroSum(lines) {
  const byCrypto = {};
  for (const l of lines) {
    byCrypto[l.cryptoId] = money.add(byCrypto[l.cryptoId] || '0', String(l.amount));
  }
  for (const [cryptoId, sum] of Object.entries(byCrypto)) {
    if (money.compare(sum, '0') !== 0) {
      throw new Error(`Unbalanced entry for crypto ${cryptoId}: sum ${sum}`);
    }
  }
}

// El UNICO escritor de dinero. Inserta el asiento + sus movimientos y actualiza
// la proyeccion de saldo de cada cuenta, todo en una transaccion. Idempotente
// por `reference`. Rechaza asientos desbalanceados y sobregiros de cuentas de
// usuario.
async function postTransaction({ type, reference, description = null, reversedEntryId = null, lines }, transaction = null) {
  validateZeroSum(lines);

  const own = !transaction;
  const t = transaction || await sequelize.transaction();
  try {
    // Idempotencia: si ya existe un asiento con esta reference, no se postea nada.
    const existing = await LedgerEntry.findOne({ where: { reference }, transaction: t });
    if (existing) {
      if (own) await t.commit();
      return existing;
    }

    const entry = await LedgerEntry.create(
      { type, reference, description, reversedEntryId }, { transaction: t }
    );

    for (const line of lines) {
      const account = await resolveAccount(line, t);
      await LedgerMovement.create({
        entryId: entry.id,
        accountId: account.id,
        cryptoId: line.cryptoId,
        amount: String(line.amount),
      }, { transaction: t });

      // Proyeccion bajo lock de fila: serializa por cuenta (anti-sobregiro).
      let balance = await LedgerBalance.findOne({
        where: { accountId: account.id }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!balance) {
        balance = await LedgerBalance.create({ accountId: account.id, balance: '0' }, { transaction: t });
      }
      const next = money.add(String(balance.balance), String(line.amount));
      if (isUserAccount(account) && money.compare(next, '0') < 0) {
        throw new OverdraftError(account.purpose, balance.balance, line.amount);
      }
      balance.balance = next;
      await balance.save({ transaction: t });
    }

    if (own) await t.commit();
    return entry;
  } catch (error) {
    if (own) await t.rollback();
    throw error;
  }
}

async function getAccountBalance({ ownerId, purpose, cryptoId }, transaction = null) {
  const owner = ownerId || HOUSE_OWNER_ID;
  const account = await LedgerAccount.findOne({ where: { ownerId: owner, purpose, cryptoId }, transaction });
  if (!account) return '0';
  const balance = await LedgerBalance.findOne({ where: { accountId: account.id }, transaction });
  return balance ? String(balance.balance) : '0';
}

module.exports = { validateZeroSum, postTransaction, getAccountBalance, OverdraftError };
