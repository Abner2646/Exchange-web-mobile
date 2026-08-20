// tests/removeOrphanDomains.test.js
//
// Cubre AUDITORIA_BACKEND.md Código muerto #4, #5, #6: 5 dominios
// completos (categoriaReclamo, logAdmin, logTransaccion, mensajeReclamo,
// reclamo) 100% inalcanzables (rutas y modelos comentados en routes/index.js
// y models/index.js) con bugs estructurales propios si se reactivaran tal
// cual (modelo `User` inexistente, ReferenceError, imports rotos). Decisión
// del usuario 2026-08-20: borrar los 5, no reescribirlos — no hay evidencia
// de que sean prioridad de producto, y el historial de git los conserva.
// También cubre las 2 entidades sin ningún .model.js que las envuelva
// (configuracionSistema.entity.js, trading.entity.js).

const fs = require('fs');
const path = require('path');

const deletedFiles = [
  'routes/categoriaReclamo.routes.js',
  'routes/logAdmin.routes.js',
  'routes/logTransaccion.routes.js',
  'routes/mensajeReclamo.routes.js',
  'routes/reclamo.routes.js',
  'controllers/categoriaReclamo.controller.js',
  'controllers/logAdmin.controller.js',
  'controllers/logTransaccion.controller.js',
  'controllers/mensajeReclamo.controller.js',
  'controllers/reclamo.controller.js',
  'models/categoriaReclamo.entity.js',
  'models/logAdmin.model.js',
  'models/logTransaccion.model.js',
  'models/mensajeReclamo.model.js',
  'models/reclamo.model.js',
  'models/entities/categoriaReclamo.entity.js',
  'models/entities/logAdmin.entity.js',
  'models/entities/logTransaccion.entity.js',
  'models/entities/mensajeReclamo.entity.js',
  'models/entities/reclamo.entity.js',
  'models/entities/configuracionSistema.entity.js',
  'models/entities/trading.entity.js',
];

describe.each(deletedFiles)('%s', (relPath) => {
  test('ya no existe', () => {
    expect(fs.existsSync(path.join(__dirname, '..', relPath))).toBe(false);
  });
});

describe('models/index.js ya no exporta los modelos de los dominios borrados', () => {
  const models = require('../models/index');
  const removed = ['CategoriaReclamo', 'LogAdmin', 'LogTransaccion', 'MensajeReclamo', 'Reclamo'];

  test.each(removed)('%s ya no está exportado', (name) => {
    expect(models[name]).toBeUndefined();
  });

  test('el resto de los modelos activos sigue exportado (nada colateral se rompió)', () => {
    for (const name of ['Usuario', 'BalanceUsuario', 'Criptomoneda', 'TransaccionP2P',
      'TransaccionBlockchain', 'Valoracion', 'WalletMaestra']) {
      expect(models[name]).toBeDefined();
    }
  });
});

test('routes/index.js monta el árbol completo de rutas sin lanzar', () => {
  jest.isolateModules(() => {
    expect(() => require('../routes/index.js')).not.toThrow();
  });
});
