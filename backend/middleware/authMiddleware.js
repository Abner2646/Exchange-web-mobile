
//ACTUALIZACIÓN INCLUIDA EN LOS CAMBIOS DEL TRANSACCIONES BLOCKCHAIN
// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');

// Middleware para autenticar usuario
const authenticateToken = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token de acceso requerido' });
    }
    
    // Quitar "Bearer " si existe
    if (token.startsWith('Bearer ')) {
      token = token.replace('Bearer ', '');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Usuario.findByPk(decoded.id);

    if (!user || !user.activo) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
    }

    // Verificar que no haya hecho un logout con este token
    if (user.lastLogoutAt && decoded.iat * 1000 < user.lastLogoutAt.getTime()) {
      return res.status(401).json({ error: 'Token invalidado por logout' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      rol: user.rol,
      kycVerificado: user.kycVerificado,
      activo: user.activo,
      limiteDiarioUsd: user.limiteDiarioUsd
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// Middleware opcional de autenticación (no lanza error si no hay token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Usuario.findByPk(decoded.id);

    if (user && user.activo) {
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        activo: user.activo,
        limiteDiarioUsd: user.limiteDiarioUsd
      };
    }

    next();
  } catch (error) {
    console.error('Error en autenticación opcional:', error);
    next(); // simplemente ignoramos si es inválido
  }
};

// Middleware para verificar KYC
const requireKYC = (req, res, next) => {
  if (!req.user?.kycVerificado) {
    return res.status(403).json({ success: false, message: 'Verificación KYC requerida para esta operación' });
  }
  next();
};

// Middleware para verificar cuenta activa
const requireActiveAccount = (req, res, next) => {
  if (!req.user?.activo) {
    return res.status(403).json({ success: false, message: 'Cuenta inactiva' });
  }
  next();
};

// Middleware para roles específicos
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  if (!allowedRoles.includes(req.user.rol)) {
    return res.status(403).json({ success: false, message: 'No autorizado para esta operación' });
  }
  next();
};

// Middleware para verificar límites de usuario
const checkUserLimits = async (req, res, next) => {
  try {
    const { cantidad } = req.body;
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' });

    if (cantidad > req.user.limiteDiarioUsd) {
      return res.status(400).json({
        success: false,
        message: `Monto excede el límite diario de $${req.user.limiteDiarioUsd} USD`
      });
    }
    next();
  } catch (error) {
    console.error('Error verificando límites:', error);
    res.status(500).json({ success: false, message: 'Error verificando límites de usuario' });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireKYC,
  requireActiveAccount,
  requireRole,
  checkUserLimits
};
