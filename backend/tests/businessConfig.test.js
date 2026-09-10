// Radar #13 — servicio de config de negocio (lectura con cache + escritura que
// invalida). Lee de la tabla `business_config`; si la key no está sembrada,
// devuelve el fallback (así migrar un hardcode a config es no-breaking: sin fila,
// se comporta igual que antes). Las claves ausentes NO se cachean, para que
// sembrar/editar después se vea sin reiniciar.
jest.mock('../models', () => ({ BusinessConfig: { findByPk: jest.fn(), upsert: jest.fn() } }));
const { BusinessConfig } = require('../models');
const cfg = require('../modules/config/businessConfig');

beforeEach(() => { jest.clearAllMocks(); cfg.clearCache(); });

test('get devuelve el value guardado', async () => {
  BusinessConfig.findByPk.mockResolvedValue({ value: '12' });
  expect(await cfg.get('k')).toBe('12');
});

test('get devuelve el fallback si la key no existe', async () => {
  BusinessConfig.findByPk.mockResolvedValue(null);
  expect(await cfg.get('missing', 'def')).toBe('def');
});

test('getNumber parsea el value guardado', async () => {
  BusinessConfig.findByPk.mockResolvedValue({ value: '6' });
  expect(await cfg.getNumber('conf', 3)).toBe(6);
});

test('getNumber usa el fallback si no existe', async () => {
  BusinessConfig.findByPk.mockResolvedValue(null);
  expect(await cfg.getNumber('conf', 3)).toBe(3);
});

test('los valores presentes se cachean (una sola lectura para gets repetidos)', async () => {
  BusinessConfig.findByPk.mockResolvedValue({ value: 'x' });
  await cfg.get('k'); await cfg.get('k');
  expect(BusinessConfig.findByPk).toHaveBeenCalledTimes(1);
});

test('los valores ausentes NO se cachean (ver siembra posterior)', async () => {
  BusinessConfig.findByPk.mockResolvedValue(null);
  await cfg.get('k'); await cfg.get('k');
  expect(BusinessConfig.findByPk).toHaveBeenCalledTimes(2);
});

test('set hace upsert e invalida la cache', async () => {
  BusinessConfig.findByPk.mockResolvedValue({ value: 'old' });
  await cfg.get('k'); // cachea 'old'
  BusinessConfig.upsert.mockResolvedValue([{ key: 'k', value: 'new' }]);
  await cfg.set('k', 'new');
  BusinessConfig.findByPk.mockResolvedValue({ value: 'new' });
  expect(await cfg.get('k')).toBe('new'); // re-lee tras la invalidación
  expect(BusinessConfig.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ key: 'k', value: 'new' })
  );
});
