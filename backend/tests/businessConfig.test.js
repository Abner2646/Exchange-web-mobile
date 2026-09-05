// Radar #13 — servicio de config de negocio (lectura con cache + escritura que
// invalida). Lee de la tabla `configuracion_negocio`; si la clave no está sembrada,
// devuelve el fallback (así migrar un hardcode a config es no-breaking: sin fila,
// se comporta igual que antes). Las claves ausentes NO se cachean, para que
// sembrar/editar después se vea sin reiniciar.
jest.mock('../models', () => ({ ConfiguracionNegocio: { findByPk: jest.fn(), upsert: jest.fn() } }));
const { ConfiguracionNegocio } = require('../models');
const cfg = require('../services/config/businessConfig');

beforeEach(() => { jest.clearAllMocks(); cfg.clearCache(); });

test('get devuelve el valor guardado', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue({ valor: '12' });
  expect(await cfg.get('k')).toBe('12');
});

test('get devuelve el fallback si la clave no existe', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue(null);
  expect(await cfg.get('missing', 'def')).toBe('def');
});

test('getNumber parsea el valor guardado', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue({ valor: '6' });
  expect(await cfg.getNumber('conf', 3)).toBe(6);
});

test('getNumber usa el fallback si no existe', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue(null);
  expect(await cfg.getNumber('conf', 3)).toBe(3);
});

test('los valores presentes se cachean (una sola lectura para gets repetidos)', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue({ valor: 'x' });
  await cfg.get('k'); await cfg.get('k');
  expect(ConfiguracionNegocio.findByPk).toHaveBeenCalledTimes(1);
});

test('los valores ausentes NO se cachean (ver siembra posterior)', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue(null);
  await cfg.get('k'); await cfg.get('k');
  expect(ConfiguracionNegocio.findByPk).toHaveBeenCalledTimes(2);
});

test('set hace upsert e invalida la cache', async () => {
  ConfiguracionNegocio.findByPk.mockResolvedValue({ valor: 'old' });
  await cfg.get('k'); // cachea 'old'
  ConfiguracionNegocio.upsert.mockResolvedValue([{ clave: 'k', valor: 'new' }]);
  await cfg.set('k', 'new');
  ConfiguracionNegocio.findByPk.mockResolvedValue({ valor: 'new' });
  expect(await cfg.get('k')).toBe('new'); // re-lee tras la invalidación
  expect(ConfiguracionNegocio.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ clave: 'k', valor: 'new' })
  );
});
