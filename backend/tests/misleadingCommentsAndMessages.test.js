// tests/misleadingCommentsAndMessages.test.js
//
// Cubre AUDITORIA_BACKEND.md "Nombres y comentarios engañosos" #1, #2, #3,
// #6, #7: comentarios/mensajes que prometían algo distinto de lo que el
// código realmente hace. Son fixes de texto, no de comportamiento, así que
// el regression guard es simplemente confirmar que el texto falso ya no
// está en el archivo fuente.

const fs = require('fs');

function source(relPath) {
  return fs.readFileSync(require.resolve(relPath), 'utf8');
}

test('#1: ofertaMetodoPago.routes.js ya no dice que no necesita rutas propias (tiene 21 activas)', () => {
  const src = source('../modules/p2p/offerPaymentMethod.routes.js');
  expect(src).not.toMatch(/NO necesita rutas propias/);
  const routeCount = (src.match(/^router\.(get|post|put|patch|delete)/gm) || []).length;
  expect(routeCount).toBeGreaterThan(15);
});

test('#2: transaccionesP2P.routes.js ya no tiene el TODO de cosas que ya están implementadas', () => {
  const src = source('../modules/p2p/p2pTransaction.routes.js');
  expect(src).not.toMatch(/Aquí debes implementar/);
});

test('#3: setupWallets.controller.js ya no promete que los datos privados se loggearon', () => {
  const src = source('../modules/wallets/setupWallets.controller.js');
  expect(src).not.toMatch(/Datos privados loggeados en servidor/);
});

test('#6: walletMaestra.routes.js ya no tiene el comentario que insinuaba un bug de backend inexistente', () => {
  const src = source('../modules/wallets/masterWallet.routes.js');
  expect(src).not.toMatch(/El campo active debe ser un valor booleano/);
});

test('#7: trades.controller.js ya no llama "Calcular PnL" a una copia de fees', () => {
  const src = source('../modules/trading/trades.controller.js');
  expect(src).not.toMatch(/Calcular PnL/);
});
