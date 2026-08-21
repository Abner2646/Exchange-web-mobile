// tests/purgeUnroutedControllerFunctions.test.js
//
// Cubre AUDITORIA_BACKEND.md Código muerto #7, #8, #9, #14: funciones de
// controller sin ninguna ruta activa que las invoque (confirmado con grep
// en routes/, frontend/ y mobile/ antes de borrar). Este test es una
// barrera de regresión: si alguna de estas funciones "muertas" reaparece
// en el export de su controller sin una ruta real que la use, algo se
// reintrodujo a medias.

describe('parExchange.controller.js ya no exporta las 13 funciones sin ruta (Código muerto #7)', () => {
  const controller = require('../controllers/parExchange.controller.js');
  const dead = [
    'updateParExchange', 'deleteParExchange', 'getParExchangeStats',
    'updateParStatus', 'toggleParStatus', 'updateParPrice',
    'updateParCommission', 'calculateExchange', 'bulkUpdatePrices',
    'getExchangeDashboard', 'getOrderBook', 'exportPares', 'getMarketMetrics',
  ];

  test.each(dead)('%s ya no está exportado', (name) => {
    expect(controller[name]).toBeUndefined();
  });

  test('las funciones con ruta activa siguen exportadas', () => {
    for (const name of ['generateAllPairs', 'getParesExchange', 'getParExchangeById',
      'createParExchange', 'searchParesExchange', 'getParBySymbols', 'getCurrentPrice',
      'getParesByBaseCrypto', 'getParesByQuoteCrypto', 'getActiveExchangePairs',
      'getTopPairsByVolume', 'getHighCommissionPairs', 'getOutdatedPricePairs']) {
      expect(typeof controller[name]).toBe('function');
    }
  });
});

describe('walletMaestra.controller.js ya no exporta las 19 funciones sin ruta (Código muerto #8)', () => {
  const controller = require('../controllers/walletMaestra.controller.js');
  const dead = [
    'updateWalletMaestra', 'deleteWalletMaestra', 'searchWalletsMaestras',
    'getWalletByAddress', 'getWalletByXpub', 'getLowBalanceWallets',
    'getHighBalanceWallets', 'getBalanceSummary', 'updateWalletStatus',
    'toggleWalletStatus', 'updateWalletBalance', 'addToBalance',
    'subtractFromBalance', 'syncBalance', 'syncAllBalances',
    'consolidateFunds', 'createBulkWallets', 'validateXpub',
    'getNextDerivationIndex',
  ];

  test.each(dead)('%s ya no está exportado', (name) => {
    expect(controller[name]).toBeUndefined();
  });

  test('las funciones con ruta activa siguen exportadas', () => {
    for (const name of ['getWalletsMaestras', 'getWalletMaestraById', 'createWalletMaestra',
      'getWalletByCriptomoneda', 'getActiveWallets', 'getFundsDistribution',
      'getTreasuryMetrics', 'getWalletsDashboard', 'getWalletMaestraStats',
      'exportWallets', 'healthCheck']) {
      expect(typeof controller[name]).toBe('function');
    }
  });
});

describe('WalletMaestra.consolidateFunds (model) ya no existe (huérfano tras borrar su único caller)', () => {
  test('el modelo ya no expone consolidateFunds', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('../models/walletMaestra.model.js'), 'utf8');
    expect(source).not.toMatch(/WalletMaestra\.consolidateFunds\s*=/);
  });
});

describe('direccionDeposito.controller.js ya no exporta cleanupTestAddresses (Código muerto #9)', () => {
  const controller = require('../controllers/direccionDeposito.controller.js');

  test('cleanupTestAddresses (dirección hardcodeada, sin ruta) ya no está exportada', () => {
    expect(controller.cleanupTestAddresses).toBeUndefined();
  });
});

describe('Los routers siguen registrando sus rutas activas sin errores', () => {
  test('parExchange.routes.js monta sin lanzar', () => {
    jest.isolateModules(() => {
      expect(() => require('../routes/parExchange.routes.js')).not.toThrow();
    });
  });

  test('walletMaestra.routes.js monta sin lanzar', () => {
    jest.isolateModules(() => {
      expect(() => require('../routes/walletMaestra.routes.js')).not.toThrow();
    });
  });

  test('setupWallets.routes.js monta sin lanzar (Código muerto #14: rutas comentadas apuntaban a funciones inexistentes)', () => {
    jest.isolateModules(() => {
      expect(() => require('../routes/setupWallets.routes.js')).not.toThrow();
    });
  });
});
