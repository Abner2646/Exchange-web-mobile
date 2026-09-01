const crypto = require('crypto');
const money = require('../../utils/money');
// ledgerAccounts y postingService se requieren LAZY dentro de espejar: ambos
// hacen `require('../../models')` al tope, y este modulo se registra desde
// models/index.js durante su propia carga — requerirlos aca arriba crearia una
// dependencia circular (models a medio exportar → sequelize undefined).

// Shim transicional (change-data-capture): espeja TODA escritura de
// BalanceUsuario al ledger, en la MISMA transaccion del write, para que el
// ledger corra como sombra reconciliada mientras las lecturas siguen saliendo
// de balances_users. Captura tanto los metodos (updateBalance/block/unblock)
// como las escrituras crudas (.update/.create de deposito/retiro/provisioning)
// sin tocar ningun call site. Se elimina cuando la migracion por-camino termina.
// El compartimento es Funding (preserva el comportamiento de un solo
// compartimento de hoy); la contrapartida es la cuenta de casa 'suspense', que
// se vacia al completar la migracion.
async function espejar(instance, options, isCreate) {
  const { PROPOSITOS } = require('./ledgerAccounts');
  const { postTransaction } = require('./postingService');
  const dispNew = String(instance.balanceDisponible ?? '0');
  const bloqNew = String(instance.balanceBloqueado ?? '0');
  const dispOld = isCreate ? '0' : String(instance.previous('balanceDisponible') ?? '0');
  const bloqOld = isCreate ? '0' : String(instance.previous('balanceBloqueado') ?? '0');
  const dDisp = money.subtract(dispNew, dispOld);
  const dBloq = money.subtract(bloqNew, bloqOld);
  if (money.compare(dDisp, '0') === 0 && money.compare(dBloq, '0') === 0) return;

  const lineas = [];
  if (money.compare(dDisp, '0') !== 0) {
    lineas.push({ ownerId: instance.userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: instance.criptomonedaId, monto: dDisp });
  }
  if (money.compare(dBloq, '0') !== 0) {
    lineas.push({ ownerId: instance.userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: instance.criptomonedaId, monto: dBloq });
  }
  // Contrapartida en suspense para cerrar el asiento en cero.
  const totalUser = money.add(dDisp, dBloq);
  lineas.push({ ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId: instance.criptomonedaId, monto: money.subtract('0', totalUser) });

  await postTransaction({
    tipo: 'ajuste_legacy',
    referencia: `mirror:${crypto.randomUUID()}`,
    descripcion: `Espejo transicional de balance (BalanceUsuario ${instance.id})`,
    lineas,
  }, options.transaction);
}

function registrarMirrorDeBalance(BalanceUsuario) {
  BalanceUsuario.addHook('afterCreate', 'ledgerMirror', (instance, options) => espejar(instance, options, true));
  BalanceUsuario.addHook('afterUpdate', 'ledgerMirror', (instance, options) => espejar(instance, options, false));
  // Los .update({}, {where}) crudos disparan bulk update: forzar individualHooks
  // para que afterUpdate corra por fila (con previous() disponible).
  BalanceUsuario.addHook('beforeBulkUpdate', 'ledgerMirrorBulk', (options) => {
    options.individualHooks = true;
  });
}

module.exports = { registrarMirrorDeBalance };
