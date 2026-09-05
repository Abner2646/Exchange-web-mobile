// middleware/operatorMFA.middleware.js
//
// Fase 4.9 — MFA obligatorio para operadores (back-office) en acciones
// privilegiadas. NYDFS Part 500 §500.12 (MFA en acceso privilegiado) + §500.7
// (least privilege / control de acceso). Se aplica DESPUÉS de authenticateToken.
//
// Regla: quien ejecuta una acción de operador debe (a) ser admin/super_admin y
// (b) tener 2FA activado. El flag `dosFactoresActivado` se lee autoritativo de la
// DB —no del JWT— para que desactivar el 2FA de un operador surta efecto de
// inmediato sobre las acciones sensibles, sin esperar a que expire su token.
//
// (El step-up por-acción —re-autenticación fresca en cada retiro/ajuste— y la
// separación de realm operador/cliente son la parte de infra de §4.9: Fase 5 /
// Cognito. Ver ROADMAP §4.9.)
const authz = require('../utils/authz');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

async function requireOperatorMFA(req, res, next) {
  try {
    if (!authz.isAdmin(req.user)) {
      return next(new AppError(403, errorCodes.OPERATOR_REQUIRED, 'Se requieren permisos de operador para esta acción'));
    }
    const { Usuario } = require('../models');
    const usuario = await Usuario.findByPk(req.user.id, { attributes: ['dosFactoresActivado'] });
    if (!usuario || !usuario.dosFactoresActivado) {
      return next(new AppError(403, errorCodes.OPERATOR_MFA_REQUIRED,
        'Los operadores deben tener 2FA activado para ejecutar acciones privilegiadas'));
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = requireOperatorMFA;
