// /middleware/adminMiddleware.js
// Middleware robusto para verificar roles y permisos

// Verifica que el usuario tenga rol de admin o super_admin
// Jerarquía: normal(1) < admin(2) < super_admin(3)

// Requiere que authenticateToken se ejecute primero

//router.get('/', authenticateToken, isAdmin, usuarioController.getUsuarios);
// ↑ Solo admin y super_admin pueden ver todos los usuarios

// Configuración de roles y jerarquías
const ROLES = {
  NORMAL: 'normal',
  USUARIO: 'Usuario', // Soporte para tu sistema actual
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
};

// Jerarquía de roles (niveles de acceso)
const ROLE_HIERARCHY = {
  [ROLES.NORMAL]: 1,
  [ROLES.USUARIO]: 1, // Mismo nivel que normal
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3
};

// Función helper para normalizar roles
const normalizeRole = (role) => {
  if (!role) return null;
  
  const roleStr = role.toString().toLowerCase();
  
  // Mapeo de roles comunes
  const roleMapping = {
    'normal': ROLES.NORMAL,
    'usuario': ROLES.NORMAL,
    'user': ROLES.NORMAL,
    'admin': ROLES.ADMIN,
    'administrator': ROLES.ADMIN,
    'super_admin': ROLES.SUPER_ADMIN,
    'superadmin': ROLES.SUPER_ADMIN,
    'super-admin': ROLES.SUPER_ADMIN
  };
  
  return roleMapping[roleStr] || role; // Retorna original si no encuentra mapeo
};

// Función helper para validar autenticación básica
const validateAuth = (req, res) => {
  // Verificar que hay un usuario autenticado
  if (!req.user) {
    res.status(401).json({ 
      error: 'Autenticación requerida',
      code: 'NO_AUTH',
      hint: 'Debe incluir token de autorización válido'
    });
    return false;
  }

  // Verificar que la cuenta esté activa
  if (req.user.activo === false) {
    res.status(403).json({ 
      error: 'Cuenta desactivada',
      code: 'ACCOUNT_DISABLED',
      hint: 'Contacte al administrador para reactivar su cuenta'
    });
    return false;
  }

  return true;
};

// Función helper para obtener el nivel de rol
const getRoleLevel = (role) => {
  const normalizedRole = normalizeRole(role);
  return ROLE_HIERARCHY[normalizedRole] || 0;
};

// Función helper para verificar si un rol es válido
const isValidRole = (role) => {
  return getRoleLevel(role) > 0;
};

// Middleware para verificar que el usuario es admin o super_admin
const isAdmin = (req, res, next) => {
  if (!validateAuth(req, res)) return;

  const userRole = normalizeRole(req.user.rol);
  const userLevel = getRoleLevel(userRole);
  const adminLevel = getRoleLevel(ROLES.ADMIN);

  if (userLevel < adminLevel) {
    return res.status(403).json({ 
      error: 'Permisos de administrador requeridos',
      code: 'ADMIN_REQUIRED',
      userRole: req.user.rol,
      requiredRoles: ['admin', 'super_admin'],
      hint: 'Esta acción requiere permisos de administrador'
    });
  }

  // Agregar información adicional al request
  req.roleInfo = {
    level: userLevel,
    normalized: userRole,
    isAdmin: true,
    isSuperAdmin: userLevel >= getRoleLevel(ROLES.SUPER_ADMIN)
  };

  next();
};

// Middleware para verificar que el usuario es super_admin
// Solo permite acceso a usuarios con rol 'super_admin'
// Es más restrictivo que isAdmin
const isSuperAdmin = (req, res, next) => {
  if (!validateAuth(req, res)) return;

  const userRole = normalizeRole(req.user.rol);
  const userLevel = getRoleLevel(userRole);
  const superAdminLevel = getRoleLevel(ROLES.SUPER_ADMIN);

  if (userLevel < superAdminLevel) {
    return res.status(403).json({ 
      error: 'Permisos de super administrador requeridos',
      code: 'SUPER_ADMIN_REQUIRED',
      userRole: req.user.rol,
      requiredRoles: ['super_admin'],
      hint: 'Esta acción requiere los máximos permisos del sistema'
    });
  }

  req.roleInfo = {
    level: userLevel,
    normalized: userRole,
    isAdmin: true,
    isSuperAdmin: true
  };

  next();
};

// Middleware para verificar que el usuario es normal (no admin)
const isNormalUser = (req, res, next) => {
  if (!validateAuth(req, res)) return;

  const userRole = normalizeRole(req.user.rol);
  const userLevel = getRoleLevel(userRole);
  const adminLevel = getRoleLevel(ROLES.ADMIN);

  if (userLevel >= adminLevel) {
    return res.status(403).json({ 
      error: 'Esta acción es solo para usuarios normales',
      code: 'NORMAL_USER_REQUIRED',
      userRole: req.user.rol,
      hint: 'Los administradores no pueden realizar esta acción'
    });
  }

  req.roleInfo = {
    level: userLevel,
    normalized: userRole,
    isAdmin: false,
    isSuperAdmin: false
  };

  next();
};

// Middleware flexible para verificar ownership o permisos de admin
const isOwnerOrAdmin = (options = {}) => {
  // Permitir tanto objeto de opciones como string (backward compatibility)
  const config = typeof options === 'string' 
    ? { userIdField: options }
    : {
        userIdField: 'userId',
        strictOwnership: false, // Si true, admin también necesita ser owner
        allowedSources: ['params', 'body', 'query'], // Dónde buscar el ID
        ...options
      };

  return (req, res, next) => {
    if (!validateAuth(req, res)) return;

    const userRole = normalizeRole(req.user.rol);
    const userLevel = getRoleLevel(userRole);
    const adminLevel = getRoleLevel(ROLES.ADMIN);
    const isAdmin = userLevel >= adminLevel;

    // Si es admin y no se requiere ownership estricto, permitir acceso
    if (isAdmin && !config.strictOwnership) {
      req.roleInfo = {
        level: userLevel,
        normalized: userRole,
        isAdmin: true,
        isSuperAdmin: userLevel >= getRoleLevel(ROLES.SUPER_ADMIN),
        accessType: 'admin'
      };
      return next();
    }

    // Buscar el ID del recurso en las fuentes especificadas
    let resourceUserId = null;
    
    for (const source of config.allowedSources) {
      if (req[source] && req[source][config.userIdField]) {
        resourceUserId = req[source][config.userIdField];
        break;
      }
    }

    // Convertir a número si es necesario (para comparación)
    const currentUserId = parseInt(req.user.id) || req.user.id;
    const resourceUserIdParsed = parseInt(resourceUserId) || resourceUserId;

    if (!resourceUserId) {
      return res.status(400).json({ 
        error: `ID de ${config.userIdField} requerido`,
        code: 'RESOURCE_ID_REQUIRED',
        hint: `Debe proporcionar ${config.userIdField} en params, body o query`
      });
    }

    // Verificar ownership
    const isOwner = currentUserId === resourceUserIdParsed;
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        error: 'Solo puedes acceder a tus propios recursos o necesitas permisos de administrador',
        code: 'OWNER_OR_ADMIN_REQUIRED',
        resourceUserId: resourceUserId,
        currentUserId: req.user.id,
        hint: 'Verifica que el ID del recurso sea correcto'
      });
    }

    req.roleInfo = {
      level: userLevel,
      normalized: userRole,
      isAdmin,
      isSuperAdmin: userLevel >= getRoleLevel(ROLES.SUPER_ADMIN),
      accessType: isOwner ? 'owner' : 'admin',
      resourceUserId: resourceUserId
    };

    next();
  };
};

// Middleware para verificar roles específicos (flexible)
const hasRole = (allowedRoles, options = {}) => {
  const config = {
    allowHierarchy: true, // Si true, roles superiores también son válidos
    caseSensitive: false,
    ...options
  };

  return (req, res, next) => {
    if (!validateAuth(req, res)) return;

    // Normalizar roles permitidos
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const normalizedAllowedRoles = roles.map(role => normalizeRole(role));
    
    const userRole = normalizeRole(req.user.rol);
    const userLevel = getRoleLevel(userRole);

    let hasPermission = false;

    if (config.allowHierarchy) {
      // Verificar si el usuario tiene un rol igual o superior
      const minRequiredLevel = Math.min(...normalizedAllowedRoles.map(role => getRoleLevel(role)));
      hasPermission = userLevel >= minRequiredLevel;
    } else {
      // Verificar match exacto
      hasPermission = normalizedAllowedRoles.includes(userRole);
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: `Rol requerido: ${roles.join(' o ')}`,
        code: 'ROLE_REQUIRED',
        userRole: req.user.rol,
        allowedRoles: roles,
        hierarchyEnabled: config.allowHierarchy,
        hint: config.allowHierarchy 
          ? 'Tu rol no tiene suficiente nivel de acceso'
          : 'Tu rol no coincide exactamente con los requeridos'
      });
    }

    req.roleInfo = {
      level: userLevel,
      normalized: userRole,
      isAdmin: userLevel >= getRoleLevel(ROLES.ADMIN),
      isSuperAdmin: userLevel >= getRoleLevel(ROLES.SUPER_ADMIN),
      matchedRoles: normalizedAllowedRoles.filter(role => 
        config.allowHierarchy ? userLevel >= getRoleLevel(role) : userRole === role
      )
    };

    next();
  };
};

// Middleware combinado robusto para autenticación y autorización
const requireAuth = (minRole = null, options = {}) => {
  const config = {
    allowHierarchy: true,
    strictRoleMatch: false,
    ...options
  };

  return (req, res, next) => {
    if (!validateAuth(req, res)) return;

    // Si no se especifica rol mínimo, solo verificar autenticación
    if (!minRole) {
      req.roleInfo = {
        level: getRoleLevel(req.user.rol),
        normalized: normalizeRole(req.user.rol),
        isAdmin: getRoleLevel(req.user.rol) >= getRoleLevel(ROLES.ADMIN),
        isSuperAdmin: getRoleLevel(req.user.rol) >= getRoleLevel(ROLES.SUPER_ADMIN)
      };
      return next();
    }

    const userRole = normalizeRole(req.user.rol);
    const userLevel = getRoleLevel(userRole);
    const requiredRole = normalizeRole(minRole);
    const requiredLevel = getRoleLevel(requiredRole);

    let hasPermission = false;

    if (config.strictRoleMatch) {
      hasPermission = userRole === requiredRole;
    } else if (config.allowHierarchy) {
      hasPermission = userLevel >= requiredLevel;
    } else {
      hasPermission = userRole === requiredRole;
    }

    if (!hasPermission) {
      return res.status(403).json({ 
        error: `Rol ${config.strictRoleMatch ? 'exacto' : 'mínimo'} requerido: ${minRole}`,
        code: 'INSUFFICIENT_ROLE',
        userRole: req.user.rol,
        requiredRole: minRole,
        userLevel: userLevel,
        requiredLevel: requiredLevel,
        hint: config.strictRoleMatch 
          ? 'Se requiere exactamente este rol'
          : 'Se requiere este rol o uno superior'
      });
    }

    req.roleInfo = {
      level: userLevel,
      normalized: userRole,
      isAdmin: userLevel >= getRoleLevel(ROLES.ADMIN),
      isSuperAdmin: userLevel >= getRoleLevel(ROLES.SUPER_ADMIN),
      meetsRequirement: hasPermission
    };

    next();
  };
};

// Middleware de debugging para roles (opcional)
const debugRoles = (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && req.user) {
    console.log('🎭 Role Debug:', {
      userId: req.user.id,
      originalRole: req.user.rol,
      normalizedRole: normalizeRole(req.user.rol),
      roleLevel: getRoleLevel(req.user.rol),
      isAdmin: getRoleLevel(req.user.rol) >= getRoleLevel(ROLES.ADMIN),
      url: req.url,
      method: req.method
    });
  }
  next();
};

// Funciones utilitarias exportadas
const roleUtils = {
  normalizeRole,
  getRoleLevel,
  isValidRole,
  ROLES,
  ROLE_HIERARCHY
};

module.exports = {
  // Middlewares principales
  isAdmin,
  isSuperAdmin,
  isNormalUser,
  isOwnerOrAdmin,
  hasRole,
  requireAuth,
  
  // Middlewares auxiliares
  debugRoles,
  validateAuth,
  
  // Utilidades
  roleUtils,
  
  // Constantes
  ROLES,
  ROLE_HIERARCHY
};