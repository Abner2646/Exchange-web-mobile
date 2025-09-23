/*
//Generar este y el otro middleware (normal) (admin, superadmin)
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();
const secretWord = process.env.JWT_SECRET;

// Middleware para autenticar token JWT (robusto)
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization (flexible)
    const authHeader = req.headers['authorization'];
    let token = null;

    if (authHeader) {
      // Eliminar espacios en blanco al inicio y final
      const cleanHeader = authHeader.trim();
      
      if (cleanHeader.startsWith('Bearer ')) {
        // Formato estándar: "Bearer token"
        token = cleanHeader.substring(7).trim();
      } else if (cleanHeader.startsWith('bearer ')) {
        // Formato case-insensitive: "bearer token"
        token = cleanHeader.substring(7).trim(); 
      } else {
        // Formato directo: solo el token
        token = cleanHeader;
      }
    }

    // Validar que el token no esté vacío después de la limpieza
    if (!token || token.length === 0) {
      return res.status(401).json({ 
        error: 'Token de acceso requerido',
        code: 'NO_TOKEN',
        hint: 'Envía el token en el header Authorization como "Bearer token" o directamente'
      });
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, secretWord, {
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });

    // Verificar que el token contenga los campos necesarios
    const requiredFields = ['id', 'email', 'username', 'rol'];
    const missingFields = requiredFields.filter(field => !decoded[field]);
    
    if (missingFields.length > 0) {
      return res.status(401).json({ 
        error: 'Token inválido - datos incompletos',
        code: 'INVALID_TOKEN_DATA',
        missingFields: missingFields
      });
    }

    // Verificar que la cuenta esté activa
    if (decoded.activo === false) {
      return res.status(403).json({ 
        error: 'Cuenta desactivada',
        code: 'ACCOUNT_DISABLED' 
      });
    }

    // Validación opcional: Verificar que el usuario aún existe en la base de datos
    if (process.env.VALIDATE_USER_EXISTS === 'true') {
      try {
        const { Usuario } = require('../models/index.js');
        const user = await Usuario.findByPk(decoded.id, {
          attributes: ['id', 'activo', 'email'] // Solo campos necesarios para optimizar
        });
        
        if (!user) {
          return res.status(401).json({ 
            error: 'Usuario no encontrado',
            code: 'USER_NOT_FOUND' 
          });
        }

        if (!user.activo) {
          return res.status(403).json({ 
            error: 'Cuenta desactivada en base de datos',
            code: 'ACCOUNT_DISABLED_DB' 
          });
        }
      } catch (dbError) {
        console.error('Error validando usuario en BD:', dbError);
        // Continuar sin validación DB en caso de error de conexión
      }
    }

    // Agregar información del usuario al request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      username: decoded.username,
      rol: decoded.rol,
      kycVerificado: decoded.kycVerificado || false,
      activo: decoded.activo !== false, // Default true si no existe
      reputacionPromedio: decoded.reputacionPromedio || 0,
      pais: decoded.pais || null
    };

    // Agregar token original al request (útil para renovación)
    req.token = token;
    req.tokenFormat = authHeader?.startsWith('Bearer ') ? 'Bearer' : 'Direct';

    next();

  } catch (error) {
    // Log del error para debugging (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.error('Error en authenticateToken:', {
        name: error.name,
        message: error.message,
        token: req.headers['authorization']?.substring(0, 20) + '...', // Solo primeros 20 chars
        url: req.url,
        method: req.method
      });
    }

    // Manejar diferentes tipos de errores JWT
    switch (error.name) {
      case 'TokenExpiredError':
        return res.status(401).json({ 
          error: 'Token expirado',
          code: 'TOKEN_EXPIRED',
          expiredAt: error.expiredAt,
          hint: 'Solicita un nuevo token de acceso'
        });

      case 'JsonWebTokenError':
        return res.status(401).json({ 
          error: 'Token inválido',
          code: 'INVALID_TOKEN',
          hint: 'Verifica que el token esté completo y sin modificaciones'
        });

      case 'NotBeforeError':
        return res.status(401).json({ 
          error: 'Token aún no es válido',
          code: 'TOKEN_NOT_ACTIVE',
          notBefore: error.date
        });

      default:
        // Error genérico o inesperado
        console.error('Error inesperado en authenticateToken:', error);
        return res.status(500).json({ 
          error: 'Error interno de autenticación',
          code: 'AUTH_ERROR',
          hint: 'Contacta al administrador del sistema'
        });
    }
  }
};

// Middleware opcional para rutas que pueden funcionar con o sin token
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;

  if (!token) {
    // No hay token, pero continúa sin autenticación
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, secretWord, {
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });

    if (decoded.activo) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        username: decoded.username,
        rol: decoded.rol,
        kycVerificado: decoded.kycVerificado,
        activo: decoded.activo,
        reputacionPromedio: decoded.reputacionPromedio,
        pais: decoded.pais
      };
      req.token = token;
    } else {
      req.user = null;
    }
  } catch (error) {
    // Si hay error con el token, continúa sin autenticación
    req.user = null;
  }

  next();
};

// Middleware para verificar KYC
const requireKYC = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Autenticación requerida',
      code: 'NO_AUTH' 
    });
  }

  if (!req.user.kycVerificado) {
    return res.status(403).json({ 
      error: 'Verificación KYC requerida para esta acción',
      code: 'KYC_REQUIRED' 
    });
  }

  next();
};

// Middleware para verificar cuenta activa (adicional al token)
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Autenticación requerida',
      code: 'NO_AUTH' 
    });
  }

  if (!req.user.activo) {
    return res.status(403).json({ 
      error: 'Cuenta desactivada',
      code: 'ACCOUNT_DISABLED' 
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireKYC,
  requireActiveAccount
};
*/


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
