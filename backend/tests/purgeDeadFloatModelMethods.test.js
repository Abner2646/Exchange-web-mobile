// tests/purgeDeadFloatModelMethods.test.js
//
// Fase 1 — purga de código muerto con float. Order.updateOrderFilled
// (order.model.js) y Trade.createTrade (trade.model.js) calculaban
// filled/averagePrice/totalValue con parseFloat + Number (float binario) pero
// NUNCA se llamaban: el flujo real de ejecución pasa por tradeExecutor (ya
// migrado a money.js). Eran trampas latentes — si alguien los cableaba,
// reintroducía el error de coma en el path de trading. Se borraron.
//
// Barrera de regresión: si cualquiera reaparece en su modelo, algo se
// reintrodujo. Se chequea el source (no el modelo inicializado) para no
// depender de una conexión/instancia de Sequelize.

const fs = require('fs');

describe('Order.updateOrderFilled borrado (código muerto con float)', () => {
  const source = fs.readFileSync(require.resolve('../models/order.model.js'), 'utf8');

  test('order.model.js ya no define Order.updateOrderFilled', () => {
    expect(source).not.toMatch(/Order\.updateOrderFilled\s*=/);
  });
});

describe('Trade.createTrade borrado (código muerto con float)', () => {
  const source = fs.readFileSync(require.resolve('../models/trade.model.js'), 'utf8');

  test('trade.model.js ya no define Trade.createTrade', () => {
    expect(source).not.toMatch(/Trade\.createTrade\s*=/);
  });
});
