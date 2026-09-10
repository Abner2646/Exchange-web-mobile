// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Middleware para autenticar usuario (solo tokens normales)
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
    const user = await User.findByPk(decoded.id);

    if (!user || !user.active) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
    }

    // Verificar que no haya hecho un logout con este token
    if (user.lastLogoutAt && decoded.iat * 1000 < user.lastLogoutAt.getTime()) {
      return res.status(401).json({ error: 'Token invalidado por logout' });
    }

    // Incluir info del usuario en req.user (SIN flags de temporal)
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      kycVerified: user.kycVerified,
      active: user.active,
      dailyLimitUsd: user.dailyLimitUsd,
      emailVerified: user.emailVerified,
      googleId: user.googleId
    };

    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// Middleware para verificar email verificado (sin restricción de tokens temporales)
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }

  // Usuarios de Google están automáticamente verificados
  if (req.user.googleId) {
    return next();
  }

  // Verificar que el email esté verificado en la base de datos
  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      success: false, 
      message: 'Debes verificar tu email antes de realizar esta operación',
      requiresEmailVerification: true,
      email: req.user.email
    });
  }

  next();
};

// Middleware opcional de autenticación (no lanza error si no hay token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (user && user.active) {
      req.user = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        kycVerified: user.kycVerified,
        active: user.active,
        dailyLimitUsd: user.dailyLimitUsd,
        emailVerified: user.emailVerified,
        googleId: user.googleId
      };
    }

    next();
  } catch (error) {
    console.error('Error en autenticación opcional:', error);
    next();
  }
};

// Middleware para verificar KYC
const requireKYC = (req, res, next) => {
  if (!req.user?.kycVerified) {
    return res.status(403).json({ success: false, message: 'Verificación KYC requerida para esta operación' });
  }
  next();
};

// Middleware para verificar cuenta active
const requireActiveAccount = (req, res, next) => {
  if (!req.user?.active) {
    return res.status(403).json({ success: false, message: 'Cuenta inactiva' });
  }
  next();
};

// Middleware para roles específicos
const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'No autorizado para esta operación' });
  }
  next();
};

// Middleware para verificar límites de usuario
const checkUserLimits = async (req, res, next) => {
  try {
    const { cantidad } = req.body;
    if (!req.user) return res.status(401).json({ success: false, message: 'No autenticado' });

    if (cantidad > req.user.dailyLimitUsd) {
      return res.status(400).json({
        success: false,
        message: `Monto excede el límite diario de $${req.user.dailyLimitUsd} USD`
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
  requireEmailVerified,
  optionalAuth,
  requireKYC,
  requireActiveAccount,
  requireRole,
  checkUserLimits
};