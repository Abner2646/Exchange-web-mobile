const { Usuario, Criptomoneda, WalletMaestra, DireccionDeposito, BalanceUsuario, Notificaciones } = require('../models/index.js');
const { Op } = require('sequelize');
//const sequelize = require('../config/database'); // Para transacciones (Esto estaba así antes y lo cambié por esto:)
// Usa la ruta correcta a tu archivo de configuración de sequelize:
const { sequelize } = require('../models/index.js');

// Función helper para generar dirección única
const generarDireccionDerivada = async (walletMaestra, usuarioId, derivationIndex) => {
  // Esta función debe implementarse según tu librería crypto específica
  // Por ahora devuelvo una dirección simulada
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
    .update(`${walletMaestra.direccionPublica}-${usuarioId}-${derivationIndex}`)
    .digest('hex');
  
  // Simular dirección según el tipo de red
  switch (walletMaestra.criptomoneda.red) {
    case 'bitcoin':
      return `1${hash.substring(0, 33)}`; // Dirección Bitcoin simulada
    case 'ethereum':
    case 'erc20':
      return `0x${hash.substring(0, 40)}`; // Dirección Ethereum simulada
    default:
      return hash.substring(0, 34);
  }
};

// Función helper para inicializar todo lo del usuario nuevo
const inicializarUsuarioCompleto = async (usuario, transaction) => {
  try {
    // 1. Obtener todas las criptomonedas activas
    const criptomonedasActivas = await Criptomoneda.getActive();
    
    if (criptomonedasActivas.length === 0) {
      throw new Error('No hay criptomonedas activas en el sistema');
    }

    const direccionesCreadas = [];
    const balancesCreados = [];

    // 2. Para cada criptomoneda, crear dirección de depósito y balance
    for (const criptomoneda of criptomonedasActivas) {
      // 2a. Buscar wallet maestra para esta criptomoneda
      const walletMaestra = await WalletMaestra.getByCriptomoneda(criptomoneda.id);
      
      if (!walletMaestra) {
        console.warn(`No hay wallet maestra para ${criptomoneda.symbol}. Saltando...`);
        continue;
      }

      // 2b. Obtener siguiente índice de derivación
      const derivationIndex = await DireccionDeposito.getNextDerivationIndex(walletMaestra.id);
      
      // 2c. Generar dirección única derivada
      const nuevaDireccion = await generarDireccionDerivada(
        { ...walletMaestra, criptomoneda }, 
        usuario.id, 
        derivationIndex
      );

      // 2d. Crear dirección de depósito
      const direccionDeposito = await DireccionDeposito.create({
        usuarioId: usuario.id,
        criptomonedaId: criptomoneda.id,
        walletMaestraId: walletMaestra.id,
        direccion: nuevaDireccion,
        derivationIndex: derivationIndex,
        activa: true
      }, { transaction });

      direccionesCreadas.push({
        criptomoneda: criptomoneda.symbol,
        direccion: nuevaDireccion
      });

      // 2e. Crear balance inicial (en 0)
      const balanceInicial = await BalanceUsuario.create({
        usuarioId: usuario.id,
        criptomonedaId: criptomoneda.id,
        balanceDisponible: 0,
        balanceBloqueado: 0
      }, { transaction });

      balancesCreados.push({
        criptomoneda: criptomoneda.symbol,
        balance: 0
      });
    }

    // 3. Crear notificación de bienvenida con info útil
    const mensajeBienvenida = `¡Bienvenido al Exchange! Tu cuenta ha sido creada exitosamente. 
    
Se han generado ${direccionesCreadas.length} direcciones de depósito para las siguientes criptomonedas: ${direccionesCreadas.map(d => d.criptomoneda).join(', ')}.

Para comenzar a operar:
1. Completa tu verificación KYC
2. Realiza tu primer depósito
3. ¡Comienza a intercambiar!`;
    const {Notificaciones} = require('../models/index.js');
    await Notificaciones.createNotification({
      usuarioId: usuario.id,
      tipo: 'sistema',
      titulo: 'Bienvenido al Exchange',
      mensaje: mensajeBienvenida,
      importante: true,
      canales: { email: true, push: false, inApp: true },
      metadatos: {
        direccionesCreadas: direccionesCreadas.length,
        balancesCreados: balancesCreados.length,
        tipoRegistro: usuario.googleId ? 'google' : 'email'
      }
    }, { transaction });

    return {
      direccionesCreadas,
      balancesCreados,
      notificacionEnviada: true
    };
  } catch (error) {
    throw new Error(`Error en inicialización completa: ${error.message}`);
  }
};

// Listar usuarios con filtros (admin)
const getUsuarios = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Usuario.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuario por ID
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Usuario.getById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Los usuarios normales solo pueden ver su propio perfil completo
    if (req.user.rol === 'normal' && req.user.id !== id) {
      // Devolver versión pública limitada
      const publicProfile = {
        id: result.id,
        username: result.username,
        reputacionPromedio: result.reputacionPromedio,
        totalValoraciones: result.totalValoraciones,
        kycVerificado: result.kycVerificado,
        created_at: result.created_at
      };
      return res.json(publicProfile);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registrar nuevo usuario - ADAPTADO con inicialización completa
const registerUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userData = req.body;
    
    // 1. Crear usuario básico
    const { user, token } = await Usuario.createWithPassword(userData);
    
    // 2. Inicializar todo lo relacionado al usuario
    //const inicializacionResult = await inicializarUsuarioCompleto(user, transaction); //<-- Comentar para crear el primer usuario porque no están creados campos en "criptomoneda", "walletMaestra", etc... Además debería checkear si se crean bien esos campos automáticamente.
    
    // 3. Si todo salió bien, confirmar transacción
    await transaction.commit();

    // 4. Respuesta exitosa con información completa
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        pais: user.pais
      },
      token,
      inicializacion: {
        //direccionesCreadas: inicializacionResult.direccionesCreadas.length, //<-- Comentar para crear el primer usuario
        //balancesCreados: inicializacionResult.balancesCreados.length, //<-- Comentar para crear el primer usuario
        //criptomonedas: inicializacionResult.direccionesCreadas.map(d => d.criptomoneda) //<-- Comentar para crear el primer usuario
      }
    });
  } catch (error) {
    // Si algo falla, hacer rollback
    await transaction.rollback();
    
    console.error('Error en registro de usuario:', error);
    res.status(400).json({ 
      error: error.message,
      details: 'Error durante la inicialización del usuario'
    });
  }
};

// Login de usuario
const loginUsuario = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    const { user, token } = await Usuario.findByCredentials(emailOrUsername, password);
    
    // Actualizar última conexión
    await user.update({ updated_at: new Date() });

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio
      },
      token
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// Login con Google - ADAPTADO con inicialización completa
const loginWithGoogle = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { googleId, email, username, pais } = req.body;
    
    // 1. Crear o encontrar usuario con Google
    const { user, token, isNew } = await Usuario.createWithProvider({
      googleId,
      email,
      username,
      pais
    });

    let inicializacionResult = null;
    
    // 2. Si es usuario nuevo, inicializar todo
    if (isNew) {
      inicializacionResult = await inicializarUsuarioCompleto(user, transaction);
    }
    
    // 3. Confirmar transacción
    await transaction.commit();

    // 4. Respuesta diferenciada según si es nuevo o existente
    const response = {
      message: isNew ? 'Usuario registrado con Google exitosamente' : 'Login exitoso con Google',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio,
        pais: user.pais
      },
      token,
      isNew
    };

    // Si es nuevo, agregar info de inicialización
    if (isNew && inicializacionResult) {
      response.inicializacion = {
        direccionesCreadas: inicializacionResult.direccionesCreadas.length,
        balancesCreados: inicializacionResult.balancesCreados.length,
        criptomonedas: inicializacionResult.direccionesCreadas.map(d => d.criptomoneda)
      };
    }

    res.json(response);
  } catch (error) {
    // Si algo falla, hacer rollback
    await transaction.rollback();
    
    console.error('Error en login con Google:', error);
    res.status(400).json({ 
      error: error.message,
      details: 'Error durante el proceso de autenticación'
    });
  }
};

// Actualizar perfil propio
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;
    
    const { user, token } = await Usuario.updateProfile(userId, updateData);
    
    res.json({
      message: 'Perfil actualizado exitosamente' //No se muestra QUE se actualizó. Para verlo, llamar a GET /me.
      //user, //Dato sensible
      //token //Dato sensible
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener mi perfil
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.getById(userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis direcciones de depósito - NUEVO
const getMyDepositAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const direcciones = await DireccionDeposito.getByUser(userId);
    
    const direccionesFormateadas = direcciones.map(addr => ({
      id: addr.id,
      criptomoneda: {
        id: addr.criptomoneda.id,
        symbol: addr.criptomoneda.symbol,
        nombre: addr.criptomoneda.nombre,
        red: addr.criptomoneda.red
      },
      direccion: addr.direccion,
      activa: addr.activa,
      created_at: addr.created_at
    }));
    
    res.json({
      direcciones: direccionesFormateadas,
      total: direccionesFormateadas.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis balances - NUEVO
const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const balances = await BalanceUsuario.getByUserId(userId);
    
    // Obtener información de criptomonedas para cada balance
    const balancesDetallados = await Promise.all(
      balances.map(async (balance) => {
        const criptomoneda = await Criptomoneda.getById(balance.criptomonedaId);
        const totalBalance = parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado);
        
        return {
          criptomoneda: {
            id: criptomoneda.id,
            symbol: criptomoneda.symbol,
            nombre: criptomoneda.nombre,
            decimales: criptomoneda.decimales
          },
          balanceDisponible: parseFloat(balance.balanceDisponible),
          balanceBloqueado: parseFloat(balance.balanceBloqueado),
          balanceTotal: totalBalance,
          updated_at: balance.updated_at
        };
      })
    );

    // Filtrar solo balances que tienen algo (disponible o bloqueado > 0)
    const balancesConFondos = balancesDetallados.filter(
      balance => balance.balanceTotal > 0
    );
    
    res.json({
      balances: balancesConFondos,
      total: balancesConFondos.length,
      balancesCompletos: balancesDetallados.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cambiar contraseña
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    const { user, token } = await Usuario.changePassword(userId, currentPassword, newPassword);

    //--
    /*await Notificaciones.createNotification({
      usuarioId: userId,
      tipo: 'sistema',
      titulo: 'Contraseña cambiada',
      mensaje: 'mensajeBienvenida',
      importante: true,
    });*/
    //--
    
    res.json({
      message: 'Contraseña cambiada exitosamente',
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de usuario (admin)
const updateUsuarioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    
    const { user, token } = await Usuario.updateStatus(id, activo);
    
    res.json({
      message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`,
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar rol de usuario (super_admin)
const updateUsuarioRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    
    // Solo super_admin puede cambiar roles
    if (req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super administradores pueden cambiar roles' });
    }
    
    const { user, token } = await Usuario.updateRole(id, rol);
    
    res.json({
      message: 'Rol actualizado exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar usuarios
const searchUsuarios = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Término de búsqueda requerido' });
    }

    const results = await Usuario.search(term, parseInt(limit));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar KYC (admin)
const updateUsuarioKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { kycData, verified } = req.body;
    
    const { user, token } = await Usuario.updateKYC(id, kycData, verified);
    
    res.json({
      message: `KYC ${verified ? 'aprobado' : 'actualizado'} exitosamente`,
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Verificar límite de transacción
const checkTransactionLimit = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { amount } = req.query;
    
    // Solo admin puede verificar límites de otros usuarios
    if (req.user.rol !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos para verificar este límite' });
    }
    
    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    const result = await Usuario.canMakeTransaction(userId, parseFloat(amount));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar límite diario (admin)
const updateDailyLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { limiteDiarioUsd } = req.body;
    
    const { user, token } = await Usuario.updateDailyLimit(id, limiteDiarioUsd);
    
    res.json({
      message: 'Límite diario actualizado exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener volumen diario
const getDailyVolume = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { fecha } = req.query;
    
    // Solo admin puede ver volúmenes de otros usuarios
    if (req.user.rol !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos para ver este volumen' });
    }
    
    const fechaConsulta = fecha ? new Date(fecha) : new Date();
    const volume = await Usuario.getDailyVolume(userId, fechaConsulta);
    
    res.json({
      usuarioId: userId,
      fecha: fechaConsulta.toISOString().split('T')[0],
      volumenDiario: volume
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de usuarios (admin)
const getUsuariosStats = async (req, res) => {
  try {
    const stats = await Usuario.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener top traders
const getTopTraders = async (req, res) => {
  try {
    const { limit = 10, period = '30d' } = req.query;
    const topTraders = await Usuario.getTopTraders(parseInt(limit), period);
    res.json(topTraders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Desactivar usuarios inactivos (admin)
const deactivateInactiveUsers = async (req, res) => {
  try {
    const { days = 365 } = req.query;
    const deactivatedCount = await Usuario.deactivateInactiveUsers(parseInt(days));
    
    res.json({
      message: `${deactivatedCount} usuarios desactivados por inactividad`,
      deactivatedCount,
      daysSinceLogin: parseInt(days)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar reputación (sistema interno)
const updateUsuarioReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reputacionPromedio, totalValoraciones } = req.body;
    
    const { user, token } = await Usuario.updateReputation(id, reputacionPromedio, totalValoraciones);
    
    res.json({
      message: 'Reputación actualizada exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar usuario (solo super_admin)
const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Solo super_admin puede eliminar usuarios
    if (req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super administradores pueden eliminar usuarios' });
    }

    // No permitir auto-eliminación
    if (req.user.id === id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar que no tenga transacciones activas
    const { TransaccionP2P } = require('../models/index.js');
    const activeTransactions = await TransaccionP2P.count({
      where: {
        [Op.or]: [
          { compradorId: id },
          { vendedorId: id }
        ],
        estado: { [Op.in]: ['iniciada', 'cryptos_bloqueadas', 'pago_confirmado'] }
      }
    });

    if (activeTransactions > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar usuario con transacciones activas' 
      });
    }

    // Desactivar en lugar de eliminar (para mantener integridad referencial)
    await user.update({ 
      activo: false,
      email: `deleted_${Date.now()}_${user.email}`,
      username: `deleted_${Date.now()}_${user.username}`
    });

    res.json({ message: 'Usuario eliminado (desactivado) exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Renovar token
const renewToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.findByPk(userId);
    
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    const newToken = user.generateUpdatedJWT();
    
    res.json({
      message: 'Token renovado exitosamente',
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener perfil público de usuario
const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Usuario.findByPk(id, {
      attributes: [
        'id', 
        'username', 
        'reputacionPromedio', 
        'totalValoraciones', 
        'kycVerificado', 
        'created_at'
      ]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar disponibilidad de email
const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }

    const existingUser = await Usuario.findOne({
      where: { email: email.toLowerCase() }
    });

    res.json({ 
      available: !existingUser,
      email: email.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar disponibilidad de username
const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ error: 'Username requerido' });
    }

    const existingUser = await Usuario.findOne({
      where: { username: username.toLowerCase() }
    });

    res.json({ 
      available: !existingUser,
      username: username.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Solicitar verificación KYC
const requestKYCVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const kycData = req.body;
    
    const { user, token } = await Usuario.updateKYC(userId, kycData, false);
    
    // Notificar a admins sobre nueva solicitud KYC
    await Notificaciones.notifyUsersByRole('admin', {
      tipo: 'kyc',
      titulo: 'Nueva solicitud de verificación KYC',
      mensaje: `El usuario ${user.username} ha enviado documentos para verificación KYC.`,
      importante: true
    });
    
    res.json({
      message: 'Documentos KYC enviados para revisión',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Logout (invalidar token - opcional)
const logout = async (req, res) => {
  try {
    // En una implementación real, podrías mantener una lista negra de tokens
    // Por ahora, solo confirmamos el logout del lado cliente
    res.json({ message: 'Logout exitoso' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Regenerar dirección de depósito (admin) - NUEVO
const regenerateDepositAddress = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, criptomonedaId } = req.body;
    
    // Verificar permisos admin
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden regenerar direcciones' });
    }
    
    // 1. Desactivar dirección actual
    const direccionActual = await DireccionDeposito.getByUserAndCrypto(userId, criptomonedaId);
    if (direccionActual) {
      await direccionActual.update({ activa: false }, { transaction });
    }
    
    // 2. Obtener wallet maestra y generar nueva dirección
    const criptomoneda = await Criptomoneda.getById(criptomonedaId);
    const walletMaestra = await WalletMaestra.getByCriptomoneda(criptomonedaId);
    
    if (!walletMaestra) {
      throw new Error('No hay wallet maestra para esta criptomoneda');
    }
    
    const derivationIndex = await DireccionDeposito.getNextDerivationIndex(walletMaestra.id);
    const nuevaDireccion = await generarDireccionDerivada(
      { ...walletMaestra, criptomoneda }, 
      userId, 
      derivationIndex
    );
    
    // 3. Crear nueva dirección
    const nuevaDireccionDeposito = await DireccionDeposito.create({
      usuarioId: userId,
      criptomonedaId: criptomonedaId,
      walletMaestraId: walletMaestra.id,
      direccion: nuevaDireccion,
      derivationIndex: derivationIndex,
      activa: true
    }, { transaction });
    
    // 4. Notificar al usuario
    const {Notificaciones} = require('../models/index.js');
    await Notificaciones.createNotification({
      usuarioId: userId,
      tipo: 'seguridad',
      titulo: 'Dirección de depósito regenerada',
      mensaje: `Tu dirección de depósito para ${criptomoneda.symbol} ha sido regenerada por seguridad. Nueva dirección: ${nuevaDireccion}`,
      importante: true
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      message: 'Dirección regenerada exitosamente',
      nuevaDireccion: {
        id: nuevaDireccionDeposito.id,
        criptomoneda: criptomoneda.symbol,
        direccion: nuevaDireccion,
        direccionAnterior: direccionActual ? direccionActual.direccion : null
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ error: error.message });
  }
};

// Verificar estado de inicialización del usuario - NUEVO
const checkUserInitialization = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Verificar direcciones creadas
    const direcciones = await DireccionDeposito.getByUser(userId);
    const balances = await BalanceUsuario.getByUserId(userId);
    const notificaciones = await Notificaciones.getUserNotifications(userId, { limit: 1 });
    
    const criptomonedasActivas = await Criptomoneda.getActive();
    
    const estado = {
      usuarioId: userId,
      inicializacionCompleta: direcciones.length === criptomonedasActivas.length,
      direccionesCreadas: direcciones.length,
      direccionesEsperadas: criptomonedasActivas.length,
      balancesCreados: balances.length,
      notificacionesBienvenida: notificaciones.total > 0,
      criptomonedasSinDireccion: criptomonedasActivas.filter(crypto => 
        !direcciones.some(dir => dir.criptomonedaId === crypto.id)
      ).map(c => c.symbol)
    };
    
    res.json(estado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Completar inicialización faltante (admin) - NUEVO
const completeUserInitialization = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId } = req.params;
    
    // Solo admin puede completar inicialización de otros usuarios
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Sin permisos para completar esta inicialización' });
    }
    
    const usuario = await Usuario.getById(userId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const inicializacionResult = await inicializarUsuarioCompleto(usuario, transaction);
    await transaction.commit();
    
    res.json({
      message: 'Inicialización completada exitosamente',
      usuario: {
        id: usuario.id,
        username: usuario.username
      },
      inicializacion: inicializacionResult
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  // Métodos de gestión básica de usuarios
  getUsuarios,
  getUsuarioById,
  searchUsuarios,
  getUsuariosStats,
  getTopTraders,
  
  // Métodos de autenticación (ADAPTADOS con inicialización completa)
  registerUsuario,
  loginUsuario,
  loginWithGoogle,
  logout,
  renewToken,
  
  // Métodos de perfil de usuario
  updateMyProfile,
  getMyProfile,
  getPublicProfile,
  changePassword,
  
  // Métodos de wallets y balances (NUEVOS)
  getMyDepositAddresses,
  getMyBalances,
  regenerateDepositAddress,
  checkUserInitialization,
  completeUserInitialization,
  
  // Métodos de administración (admin/super_admin)
  updateUsuarioStatus,
  updateUsuarioRole,
  updateUsuarioKYC,
  updateDailyLimit,
  updateUsuarioReputation,
  deleteUsuario,
  deactivateInactiveUsers,
  
  // Métodos de transacciones y límites
  checkTransactionLimit,
  getDailyVolume,
  
  // Métodos de verificación
  checkEmailAvailability,
  checkUsernameAvailability,
  requestKYCVerification,
  
  // Helpers exportados para uso en otros controladores
  inicializarUsuarioCompleto,
  generarDireccionDerivada
};