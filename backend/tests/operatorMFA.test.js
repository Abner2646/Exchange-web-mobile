// Fase 4.9 — MFA obligatorio para operadores en acciones privilegiadas.
// NYDFS Part 500 §500.12 (MFA para acceso privilegiado). El guard exige que
// quien ejecuta una acción de operador (admin/super_admin) tenga 2FA activado
// (`dosFactoresActivado`), leído autoritativo de la DB (no del token, que podría
// estar desactualizado). Un no-operador se rechaza antes de tocar la DB.
jest.mock('../models', () => ({ Usuario: { findByPk: jest.fn() } }));
const { Usuario } = require('../models');
const requireOperatorMFA = require('../middleware/operatorMFA.middleware');

const admin = { id: 'a1', rol: 'admin' };
const superAdmin = { id: 's1', rol: 'super_admin' };
const normal = { id: 'u1', rol: 'normal' };

beforeEach(() => jest.clearAllMocks());

test('no-operador → 403 OPERATOR_REQUIRED, sin consultar la DB', async () => {
  const next = jest.fn();
  await requireOperatorMFA({ user: normal }, {}, next);
  const err = next.mock.calls[0][0];
  expect(err.statusCode).toBe(403);
  expect(err.code).toBe('OPERATOR_REQUIRED');
  expect(Usuario.findByPk).not.toHaveBeenCalled();
});

test('operador SIN 2FA → 403 OPERATOR_MFA_REQUIRED', async () => {
  Usuario.findByPk.mockResolvedValue({ dosFactoresActivado: false });
  const next = jest.fn();
  await requireOperatorMFA({ user: admin }, {}, next);
  const err = next.mock.calls[0][0];
  expect(err.statusCode).toBe(403);
  expect(err.code).toBe('OPERATOR_MFA_REQUIRED');
});

test('operador CON 2FA → next() sin error', async () => {
  Usuario.findByPk.mockResolvedValue({ dosFactoresActivado: true });
  const next = jest.fn();
  await requireOperatorMFA({ user: superAdmin }, {}, next);
  expect(next).toHaveBeenCalledWith();
});

test('operador cuyo usuario ya no existe → se trata como sin 2FA (default seguro)', async () => {
  Usuario.findByPk.mockResolvedValue(null);
  const next = jest.fn();
  await requireOperatorMFA({ user: admin }, {}, next);
  expect(next.mock.calls[0][0].code).toBe('OPERATOR_MFA_REQUIRED');
});
