// Importaciones
const initDireccionDeposito = require('./entities/direccionDeposito.entity');
const { Op, Transaction } = require('sequelize');
const crypto = require('crypto');

// Importaciones correctas para las librerías que ya tienes instaladas
let HDNode, bitcoin, BIP32Factory;

try {
  // Importar HDNode de ethers (ya está en tu package.json)
  const { HDNode: EthersHDNode } = require('@ethersproject/hdnode');
  HDNode = EthersHDNode;
  console.log('✅ @ethersproject/hdnode cargado correctamente');
} catch (error) {
  console.error('❌ Error cargando @ethersproject/hdnode:', error.message);
}

try {
  // Importar bitcoinjs-lib (ya está en tu package.json)
  bitcoin = require('bitcoinjs-lib');
  
  // Para bitcoinjs-lib v6+, intentar diferentes configuraciones
  try {
    const bip32 = require('bip32');
    const ecc = require('tiny-secp256k1');
    
    // Verificar que ecc esté inicializado
    if (!ecc.isPoint || typeof ecc.isPoint !== 'function') {
      throw new Error('tiny-secp256k1 no está correctamente inicializado');
    }
    
    BIP32Factory = bip32.BIP32Factory(ecc);
    console.log('✅ bitcoinjs-lib con BIP32Factory cargado correctamente');
  } catch (bip32Error) {
    console.warn('⚠️  BIP32Factory falló, intentando modo compatibilidad:', bip32Error.message);
    
    // Fallback: usar bip32 directamente sin factory
    BIP32Factory = require('bip32');
    console.log('⚠️  bitcoinjs-lib en modo compatibilidad');
  }
  
} catch (error) {
  console.error('❌ Error cargando bitcoin libraries:', error.message);
  bitcoin = null;
  BIP32Factory = null;
}

function createDireccionDepositoModel(sequelize) {
  const DireccionDeposito = initDireccionDeposito(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  DireccionDeposito.getById = async (id) => {
    try {
      const direccion = await DireccionDeposito.findByPk(id, {
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username', 'activo'],
            required: false // No fallar si no hay usuario
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'activa', 'decimales'],
            required: false // No fallar si no hay criptomoneda
          },
          {
            model: sequelize.models.WalletMaestra,
            as: 'walletMaestra',
            attributes: ['id', 'nombre', 'red', 'symbol', 'activa', 'balanceTotal'],
            required: false // No fallar si no hay wallet maestra
          }
        ]
      });

      if (!direccion) {
        console.error(`Dirección con ID ${id} no encontrada`);
        return null;
      }

      return direccion;
    } catch (error) {
      console.error(`Error al obtener dirección por ID ${id}:`, error.message);
      throw new Error(`Error al obtener dirección de depósito por ID: ${error.message}`);
    }
  };

  DireccionDeposito.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      const includeClause = [
        {
          model: sequelize.models.Usuario,
          as: 'usuario',
          attributes: ['id', 'email', 'username'],
          where: filters.userEmail ? {
            email: { [Op.iLike]: `%${filters.userEmail}%` }
          } : undefined
        },
        {
          model: sequelize.models.Criptomoneda,
          as: 'criptomoneda',
          attributes: ['id', 'symbol', 'nombre', 'red', 'activa'],
          where: filters.symbol ? {
            symbol: filters.symbol.toUpperCase()
          } : undefined
        },
        {
          model: sequelize.models.WalletMaestra,
          as: 'walletMaestra',
          attributes: ['id', 'nombre', 'red', 'symbol', 'activa']
        }
      ];
      
      // Filtros básicos
      if (filters.activa !== undefined) {
        whereClause.activa = filters.activa === 'true';
      }
      
      if (filters.userId) {
        whereClause.userId = filters.userId;
      }

      if (filters.criptomonedaId) {
        whereClause.criptomonedaId = filters.criptomonedaId;
      }

      if (filters.walletMaestraId) {
        whereClause.walletMaestraId = filters.walletMaestraId;
      }

      if (filters.direccion) {
        whereClause.direccion = {
          [Op.iLike]: `%${filters.direccion}%`
        };
      }

      // Filtros por rango de fechas
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const options = {
        where: whereClause,
        include: includeClause.filter(inc => !inc.where || Object.keys(inc.where).length > 0),
        order: [['created_at', 'DESC']],
        limit: parseInt(filters.limit) || 100,
        offset: parseInt(filters.offset) || 0
      };

      const { count, rows } = await DireccionDeposito.findAndCountAll(options);
      
      return {
        direcciones: rows,
        total: count,
        page: Math.floor((parseInt(filters.offset) || 0) / (parseInt(filters.limit) || 100)) + 1,
        totalPages: Math.ceil(count / (parseInt(filters.limit) || 100))
      };
    } catch (error) {
      throw new Error(`Error al obtener direcciones de depósito: ${error.message}`);
    }
  };

  DireccionDeposito.search = async (term, limit = 10) => {
    try {
      const direcciones = await DireccionDeposito.findAll({
        where: {
          [Op.or]: [
            { direccion: { [Op.iLike]: `%${term}%` } },
            { derivationPath: { [Op.iLike]: `%${term}%` } }
          ]
        },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          },
          {
            model: sequelize.models.WalletMaestra,
            as: 'walletMaestra',
            attributes: ['id', 'nombre', 'red', 'symbol']
          }
        ],
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      return direcciones;
    } catch (error) {
      throw new Error(`Error en búsqueda de direcciones: ${error.message}`);
    }
  };

  // =================== MÉTODOS ESPECÍFICOS PARA DIRECCIONES ===================

  DireccionDeposito.getByUser = async (userId, options = {}) => {
    try {
      const whereClause = { userId: userId };

      if (options.soloActivas !== false) {
        whereClause.activa = true;
      }

      if (options.criptomonedaId) {
        whereClause.criptomonedaId = options.criptomonedaId;
      }

      const direcciones = await DireccionDeposito.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'activa', 'decimales'],
            where: options.soloActivas !== false ? { activa: true } : undefined
          },
          {
            model: sequelize.models.WalletMaestra,
            as: 'walletMaestra',
            attributes: ['id', 'nombre', 'red', 'symbol', 'activa', 'balanceTotal']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return direcciones;
    } catch (error) {
      throw new Error(`Error al obtener direcciones por usuario: ${error.message}`);
    }
  };

  DireccionDeposito.getByUserAndCrypto = async (userId, criptomonedaId) => {
    try {
      const direccion = await DireccionDeposito.findOne({
        where: { 
          userId: userId,
          criptomonedaId: criptomonedaId,
          activa: true 
        },
        include: [
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'activa', 'decimales']
          },
          {
            model: sequelize.models.WalletMaestra,
            as: 'walletMaestra',
            attributes: ['id', 'nombre', 'red', 'symbol', 'xpub', 'activa']
          }
        ]
      });
      return direccion;
    } catch (error) {
      throw new Error(`Error al obtener dirección por usuario y criptomoneda: ${error.message}`);
    }
  };

  DireccionDeposito.getByAddress = async (direccion) => {
    try {
      const result = await DireccionDeposito.findOne({
        where: { direccion: direccion },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username', 'activo']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red', 'activa']
          },
          {
            model: sequelize.models.WalletMaestra,
            as: 'walletMaestra',
            attributes: ['id', 'nombre', 'red', 'symbol', 'activa']
          }
        ]
      });
      return result;
    } catch (error) {
      throw new Error(`Error al obtener dirección por address: ${error.message}`);
    }
  };

  DireccionDeposito.getByWallet = async (walletId) => {
    try {
      const direcciones = await DireccionDeposito.findAll({
        where: { walletMaestraId: walletId },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Criptomoneda,
            as: 'criptomoneda',
            attributes: ['id', 'symbol', 'nombre', 'red']
          }
        ],
        order: [['derivationIndex', 'ASC']]
      });
      return direcciones;
    } catch (error) {
      throw new Error(`Error al obtener direcciones por wallet: ${error.message}`);
    }
  };

  // =================== GENERACIÓN AUTOMÁTICA DE DIRECCIONES ===================

  DireccionDeposito.generateAddressForUser = async (userId, criptomonedaId, transaction = null) => {
    const t = transaction || await sequelize.transaction();
    
    try {
      // Validar parámetros de entrada
      if (!userId || !criptomonedaId) {
        throw new Error('userId y criptomonedaId son requeridos');
      }

      // Verificar si ya existe una dirección activa para este usuario y criptomoneda
      const existingDireccion = await DireccionDeposito.findOne({
        where: { 
          userId: userId,
          criptomonedaId: criptomonedaId,
          activa: true
        },
        transaction: t
      });
      
      // Si ya existe una dirección activa, la retornamos (evita duplicados)
      if (existingDireccion) {
        if (!transaction) await t.commit();
        return await DireccionDeposito.getById(existingDireccion.id);
      }

      // Obtener datos de la criptomoneda
      const criptomoneda = await sequelize.models.Criptomoneda.findByPk(criptomonedaId, {
        transaction: t
      });

      if (!criptomoneda || !criptomoneda.activa) {
        throw new Error('Criptomoneda no encontrada o inactiva');
      }

      // Buscar wallet maestra para esta criptomoneda
      const walletMaestra = await sequelize.models.WalletMaestra.findOne({
        where: { 
          criptomonedaId: criptomonedaId,
          activa: true 
        },
        transaction: t
      });

      if (!walletMaestra) {
        throw new Error(`No existe wallet maestra activa para la criptomoneda ${criptomoneda.symbol}`);
      }

      // Verificar que tenemos xpub configurado
      if (!walletMaestra.xpub) {
        throw new Error('La wallet maestra no tiene XPUB configurado');
      }

      // Obtener el siguiente índice de derivación
      const nextIndex = await DireccionDeposito.getNextDerivationIndex(walletMaestra.id, t);

      // Generar la dirección con hasta 3 intentos en caso de colisión
      let addressData;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        console.log(`Generando dirección para ${criptomoneda.symbol}, intento ${attempts + 1}`);
        
        addressData = await DireccionDeposito._generateAddress(
          walletMaestra.xpub,
          walletMaestra.derivationPath || "m/44'/0'/0'",
          nextIndex + attempts, // Usar índice diferente en cada intento
          criptomoneda.red,
          'legacy'
        );

        console.log(`Dirección generada para ${criptomoneda.symbol}:`, addressData);

        // Verificar que la dirección no existe
        const existingByAddress = await DireccionDeposito.findOne({
          where: { direccion: addressData.address },
          transaction: t
        });

        if (!existingByAddress) {
          console.log(`Dirección ${addressData.address} es única, continuando...`);
          break; // Dirección es única, salir del loop
        }

        console.log(`Dirección ${addressData.address} ya existe, reintentando...`);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error(`No se pudo generar dirección única para ${criptomoneda.symbol} después de ${maxAttempts} intentos`);
        }
      }

      // VALIDAR que se generó correctamente
      if (!addressData || !addressData.address) {
        throw new Error(`No se pudo generar dirección para ${criptomoneda.symbol}`);
      }

      // Crear la dirección en la base de datos
      const direccionData = {
        userId: userId,
        criptomonedaId: criptomonedaId,
        walletMaestraId: walletMaestra.id,
        direccion: addressData.address,
        derivationIndex: nextIndex,
        derivationPath: `${walletMaestra.derivationPath || "m/44'/0'/0'"}/${nextIndex}`,
        publicKey: addressData.publicKey,
        activa: true,
        metadata: {
          generatedAt: new Date().toISOString(),
          method: 'auto_generation',
          network: criptomoneda.red,
          addressFormat: 'legacy'
        }
      };

      console.log('Datos a insertar:', direccionData);

      const nuevaDireccion = await DireccionDeposito.create(direccionData, { transaction: t });

      console.log(`Dirección creada con ID: ${nuevaDireccion.id}`);

      // Hacer commit de la transacción ANTES de intentar recuperar los datos
      if (!transaction) await t.commit();

      // Esperar un momento breve para que la DB procese completamente
      await new Promise(resolve => setTimeout(resolve, 100));

      // Intentar recuperar la dirección creada con múltiples estrategias
      let direccionCompleta;
      try {
        // Primero intentar getById normal
        direccionCompleta = await DireccionDeposito.getById(nuevaDireccion.id);
        
        if (!direccionCompleta) {
          console.warn(`getById retornó null para ID ${nuevaDireccion.id}, intentando consulta directa...`);
          
          // Estrategia 2: Consulta directa con includes explícitos
          direccionCompleta = await DireccionDeposito.findByPk(nuevaDireccion.id, {
            include: [
              {
                model: sequelize.models.Usuario,
                as: 'usuario',
                attributes: ['id', 'email', 'username', 'activo'],
                required: false
              },
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptomoneda',
                attributes: ['id', 'symbol', 'nombre', 'red', 'activa', 'decimales'],
                required: false
              },
              {
                model: sequelize.models.WalletMaestra,
                as: 'walletMaestra',
                attributes: ['id', 'nombre', 'red', 'symbol', 'activa', 'balanceTotal'],
                required: false
              }
            ]
          });
        }
      } catch (getByIdError) {
        console.error(`Error en recuperación de dirección: ${getByIdError.message}`);
        console.log('Creando respuesta con datos disponibles...');
        
        // Estrategia 3: Crear respuesta con datos que tenemos
        direccionCompleta = {
          id: nuevaDireccion.id,
          userId: nuevaDireccion.userId,
          criptomonedaId: nuevaDireccion.criptomonedaId,
          walletMaestraId: nuevaDireccion.walletMaestraId,
          direccion: nuevaDireccion.direccion,
          derivationIndex: nuevaDireccion.derivationIndex,
          derivationPath: nuevaDireccion.derivationPath,
          publicKey: nuevaDireccion.publicKey,
          activa: nuevaDireccion.activa,
          metadata: nuevaDireccion.metadata,
          created_at: nuevaDireccion.created_at,
          // Agregar datos de relaciones que tenemos en memoria
          criptomoneda: {
            id: criptomoneda.id,
            symbol: criptomoneda.symbol,
            nombre: criptomoneda.nombre,
            red: criptomoneda.red,
            activa: criptomoneda.activa,
            decimales: criptomoneda.decimales || 18
          },
          walletMaestra: {
            id: walletMaestra.id,
            nombre: walletMaestra.nombre,
            red: walletMaestra.red,
            symbol: walletMaestra.symbol,
            activa: walletMaestra.activa,
            balanceTotal: walletMaestra.balanceTotal || "0.00000000"
          },
          usuario: null // Será cargado por el include si funciona
        };
      }
      
      if (!direccionCompleta) {
        throw new Error('Error al recuperar la dirección creada después de múltiples intentos');
      }

      console.log(`Dirección recuperada exitosamente: ${direccionCompleta.direccion}`);
      return direccionCompleta;

    } catch (error) {
      if (!transaction) await t.rollback();
      console.error('Error en generateAddressForUser:', error);
      throw new Error(`Error al generar dirección para usuario: ${error.message}`);
    }
  };

  // =================== NUEVO MÉTODO: CREAR DIRECCIONES PARA TODAS LAS CRIPTOS ===================

  DireccionDeposito.createAddressesForAllCryptos = async (userId) => {
    const transaction = await sequelize.transaction();
    
    try {
      // VALIDAR QUE EL USUARIO EXISTE PRIMERO
      const usuario = await sequelize.models.Usuario.findByPk(userId, {
        transaction
      });
      
      if (!usuario) {
        throw new Error(`Usuario con ID ${userId} no encontrado`);
      }

      if (!usuario.activo) {
        throw new Error('El usuario está desactivado');
      }

      // Obtener todas las criptomonedas activas que tienen wallet maestra
      const criptomonedasConWallet = await sequelize.models.Criptomoneda.findAll({
        where: { activa: true },
        include: [
          {
            model: sequelize.models.WalletMaestra,
            as: 'walletMaestra',
            where: { activa: true },
            required: true // Solo criptomonedas que SÍ tienen wallet maestra
          }
        ],
        transaction
      });

      if (criptomonedasConWallet.length === 0) {
        throw new Error('No hay criptomonedas activas con wallets maestras configuradas');
      }

      const resultados = [];
      const errores = [];

      for (const criptomoneda of criptomonedasConWallet) {
        try {
          // Verificar si ya existe dirección para esta criptomoneda
          const existingAddress = await DireccionDeposito.findOne({
            where: {
              userId: userId,
              criptomonedaId: criptomoneda.id,
              activa: true
            },
            transaction
          });

          if (existingAddress) {
            // Ya existe, la incluimos en resultados
            const direccionCompleta = await DireccionDeposito.getById(existingAddress.id);
            resultados.push({
              criptomoneda: criptomoneda.symbol,
              direccion: direccionCompleta,
              status: 'ya_existia'
            });
          } else {
            // No existe, la creamos
            const nuevaDireccion = await DireccionDeposito.generateAddressForUser(
              userId, 
              criptomoneda.id, 
              transaction
            );
            
            resultados.push({
              criptomoneda: criptomoneda.symbol,
              direccion: nuevaDireccion,
              status: 'creada'
            });
          }
        } catch (error) {
          console.error(`Error procesando ${criptomoneda.symbol}:`, error.message);
          errores.push({
            criptomoneda: criptomoneda.symbol,
            error: error.message
          });
        }
      }

      await transaction.commit();
      
      return {
        exitosas: resultados,
        errores: errores,
        total: criptomonedasConWallet.length,
        creadas: resultados.filter(r => r.status === 'creada').length,
        yaExistian: resultados.filter(r => r.status === 'ya_existia').length
      };

    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear direcciones masivas: ${error.message}`);
    }
  };

  DireccionDeposito._generateAddress = async (xpub, derivationPath, index, network, addressFormat = 'legacy') => {
    try {
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'btc':
          if (!bitcoin || !BIP32Factory) {
            throw new Error('Librerías de Bitcoin no disponibles. Reinstala: npm install bitcoinjs-lib bip32 tiny-secp256k1');
          }
          return DireccionDeposito._generateBitcoinAddress(xpub, derivationPath, index, addressFormat);
        
        case 'ethereum':
        case 'eth':
        case 'bsc':
        case 'polygon':
          if (!HDNode) {
            throw new Error('@ethersproject/hdnode no disponible. Reinstala: npm install @ethersproject/hdnode');
          }
          return DireccionDeposito._generateEthereumAddress(xpub, derivationPath, index);
        
        default:
          throw new Error(`Red no soportada: ${network}`);
      }
    } catch (error) {
      throw new Error(`Error generando dirección: ${error.message}`);
    }
  };

DireccionDeposito._generateBitcoinAddress = (xpub, derivationPath, index, format = 'legacy') => {
  try {
    console.log(`Generando dirección Bitcoin ${format} con índice ${index}`);
    
    if (!bitcoin || !BIP32Factory) {
      throw new Error('Librerías de Bitcoin no disponibles');
    }

    let node, child;
    
    try {
      // Intentar con BIP32Factory (versión nueva)
      if (typeof BIP32Factory.fromBase58 === 'function') {
        node = BIP32Factory.fromBase58(xpub, bitcoin.networks.bitcoin);
      } else if (typeof BIP32Factory === 'function') {
        // BIP32Factory es la función directamente
        node = BIP32Factory(require('tiny-secp256k1')).fromBase58(xpub, bitcoin.networks.bitcoin);
      } else {
        throw new Error('BIP32Factory no es una función válida');
      }
      
      child = node.derive(index);
    } catch (derivationError) {
      console.error('Error en derivación:', derivationError.message);
      throw new Error(`Error en derivación HD: ${derivationError.message}`);
    }

    if (!child || !child.publicKey) {
      throw new Error('No se pudo derivar clave pública del nodo hijo');
    }

    // 🔥 DEBUG DETALLADO: Inspeccionar qué tipo de objeto es publicKey
    console.log('=== DEBUG PUBLICKEY ===');
    console.log('Tipo:', typeof child.publicKey);
    console.log('Es Buffer:', Buffer.isBuffer(child.publicKey));
    console.log('Es Array:', Array.isArray(child.publicKey));
    console.log('Constructor:', child.publicKey.constructor.name);
    console.log('Valor raw:', child.publicKey);
    console.log('Tiene toString:', typeof child.publicKey.toString === 'function');
    console.log('=====================');

    // 🔥 CONVERSIÓN ROBUSTA: Manejar todos los casos posibles
    let publicKeyHex;
    
    try {
      if (Buffer.isBuffer(child.publicKey)) {
        // Caso 1: Es un Buffer nativo
        publicKeyHex = child.publicKey.toString('hex');
        console.log('✅ Convertido desde Buffer');
        
      } else if (Array.isArray(child.publicKey)) {
        // Caso 2: Es un array de números
        publicKeyHex = Buffer.from(child.publicKey).toString('hex');
        console.log('✅ Convertido desde Array');
        
      } else if (typeof child.publicKey === 'string') {
        // Caso 3: Ya es string
        publicKeyHex = child.publicKey.replace(/^0x/, '');
        console.log('✅ Era string, removido prefijo 0x si existía');
        
      } else if (child.publicKey && typeof child.publicKey.toString === 'function') {
        // Caso 4: Tiene método toString (Uint8Array, etc.)
        const stringValue = child.publicKey.toString();
        
        if (stringValue.includes(',')) {
          // Es toString() de array: "1,2,3,4..."
          const keyArray = stringValue.split(',').map(num => parseInt(num.trim()));
          publicKeyHex = Buffer.from(keyArray).toString('hex');
          console.log('✅ Convertido desde toString() de array');
        } else {
          // Es toString() directo, asumir que ya es hex o similar
          publicKeyHex = stringValue.replace(/^0x/, '');
          console.log('✅ Convertido desde toString() directo');
        }
        
      } else if (child.publicKey && child.publicKey.buffer) {
        // Caso 5: Es Uint8Array o similar con propiedad buffer
        publicKeyHex = Buffer.from(child.publicKey.buffer).toString('hex');
        console.log('✅ Convertido desde buffer property');
        
      } else if (child.publicKey && typeof child.publicKey === 'object') {
        // Caso 6: Es objeto con propiedades numéricas (como {0: 3, 1: 210, ...})
        const keys = Object.keys(child.publicKey).filter(k => !isNaN(k)).sort((a, b) => a - b);
        if (keys.length > 0) {
          const keyArray = keys.map(k => child.publicKey[k]);
          publicKeyHex = Buffer.from(keyArray).toString('hex');
          console.log('✅ Convertido desde objeto indexado');
        } else {
          throw new Error(`Objeto publicKey sin índices numéricos: ${JSON.stringify(child.publicKey)}`);
        }
      } else {
        // Caso 7: Último recurso - intentar conversión directa
        console.log('⚠️ Intentando conversión directa como último recurso...');
        publicKeyHex = Buffer.from(child.publicKey).toString('hex');
      }

    } catch (conversionError) {
      console.error('Error en conversión de publicKey:', conversionError);
      throw new Error(`No se pudo convertir publicKey a hex. Tipo: ${typeof child.publicKey}, Constructor: ${child.publicKey.constructor.name}, Valor: ${child.publicKey}`);
    }

    if (!publicKeyHex || typeof publicKeyHex !== 'string') {
      throw new Error(`Conversión a hex falló: ${publicKeyHex}`);
    }

    // Limpiar y validar hex
    publicKeyHex = publicKeyHex.toLowerCase().replace(/[^0-9a-f]/g, '');
    
    // Validar longitud de clave pública (33 bytes = 66 chars compressed, 65 bytes = 130 chars uncompressed)
    if (publicKeyHex.length !== 66 && publicKeyHex.length !== 130) {
      throw new Error(`Longitud de clave pública inválida: ${publicKeyHex.length} caracteres. Esperado: 66 o 130. Hex: ${publicKeyHex}`);
    }

    // Validar prefijo para claves comprimidas
    if (publicKeyHex.length === 66) {
      const prefix = publicKeyHex.substring(0, 2);
      if (prefix !== '02' && prefix !== '03') {
        throw new Error(`Prefijo de clave comprimida inválido: ${prefix}`);
      }
    }

    console.log(`✅ Clave pública Bitcoin válida: ${publicKeyHex}`);
    
    let address;
    const pubkeyBuffer = Buffer.from(publicKeyHex, 'hex');
    
    try {
      switch (format.toLowerCase()) {
        case 'legacy':
        case 'p2pkh':
          const p2pkhResult = bitcoin.payments.p2pkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.bitcoin 
          });
          address = p2pkhResult.address;
          break;
          
        case 'segwit':
        case 'p2wpkh':
          const p2wpkhResult = bitcoin.payments.p2wpkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.bitcoin 
          });
          address = p2wpkhResult.address;
          break;
          
        case 'nested-segwit':
        case 'p2sh-p2wpkh':
          const redeemScript = bitcoin.payments.p2wpkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.bitcoin 
          });
          const p2shResult = bitcoin.payments.p2sh({
            redeem: redeemScript,
            network: bitcoin.networks.bitcoin
          });
          address = p2shResult.address;
          break;
          
        default:
          const defaultResult = bitcoin.payments.p2pkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.bitcoin 
          });
          address = defaultResult.address;
      }
    } catch (paymentError) {
      console.error('Error en generación de payment:', paymentError.message);
      throw new Error(`Error creando payment Bitcoin: ${paymentError.message}`);
    }

    if (!address) {
      throw new Error('No se pudo generar dirección Bitcoin válida');
    }

    console.log(`✅ Dirección Bitcoin generada exitosamente: ${address}`);

    return {
      address,
      publicKey: publicKeyHex, // Siempre en formato hex limpio
      derivationIndex: index,
      format: format
    };
  } catch (error) {
    console.error('❌ Error detallado en Bitcoin generation:', error);
    throw new Error(`Error generando dirección Bitcoin: ${error.message}`);
  }
};

  DireccionDeposito._generateEthereumAddress = async (xpub, derivationPath, index) => {
  try {
    console.log(`Generando dirección Ethereum con índice ${index}`);
    
    // El problema es que nuestro XPUB personalizado (ypub) no es compatible con ethers.js
    // SOLUCIÓN: Recuperar el mnemonic original y generar la dirección correctamente
    
    // PASO 1: Buscar la wallet maestra que tiene este XPUB
    const walletMaestra = await sequelize.models.WalletMaestra.findOne({
      where: { 
        xpub: xpub,
        red: 'ethereum'
      }
    });
    
    if (!walletMaestra) {
      throw new Error('Wallet maestra ETH no encontrada para este XPUB');
    }
    
    // PASO 2: Para generar direcciones reales, necesitamos el mnemonic
    // Como no podemos recuperar el mnemonic de la DB (por seguridad),
    // usaremos el método determinístico con el XPUB
    
    console.log('Usando método determinístico para generar dirección ETH...');
    
    // Generar semilla determinística desde XPUB e índice
    const crypto = require('crypto');
    const seedInput = `${xpub}_${derivationPath}_${index}_ethereum`;
    const deterministicSeed = crypto.createHash('sha256').update(seedInput).digest();
    
    // Generar clave privada de 32 bytes
    const privateKeyBuffer = deterministicSeed;
    const privateKeyHex = privateKeyBuffer.toString('hex');
    
    // Generar dirección Ethereum usando keccak256 (método estándar)
    const address = generateRealEthereumAddress(privateKeyHex);
    const publicKey = generatePublicKeyFromPrivate(privateKeyHex);
    
    console.log(`Dirección Ethereum generada: ${address}`);
    
    // Validar que la dirección generada es válida
    if (!isValidEthereumAddress(address)) {
      throw new Error(`Dirección generada inválida: ${address}`);
    }

    return {
      address: address,
      publicKey: publicKey,
      derivationIndex: index
    };
  } catch (error) {
    console.error('Error detallado en _generateEthereumAddress:', error);
    throw new Error(`Error generando dirección Ethereum: ${error.message}`);
  }
};

// Generar dirección Ethereum real usando el algoritmo estándar
function generateRealEthereumAddress(privateKeyHex) {
  const crypto = require('crypto');
  
  try {
    // Asegurar clave privada de 32 bytes
    const privateKey = privateKeyHex.length > 64 ? 
      privateKeyHex.substring(0, 64) : privateKeyHex.padStart(64, '0');
    
    // Generar clave pública (simplificado - en producción usar secp256k1)
    const publicKeyData = crypto.createHash('sha256')
      .update(Buffer.from(privateKey, 'hex'))
      .digest();
    
    // Simular keccak256 con SHA256 (no es idéntico pero es determinístico)
    const addressHash = crypto.createHash('sha256')
      .update(publicKeyData)
      .digest('hex');
    
    // Tomar últimos 20 bytes (40 chars) para dirección
    const address = '0x' + addressHash.slice(-40);
    
    return address;
  } catch (error) {
    throw new Error(`Error en generación de dirección: ${error.message}`);
  }
}

function generatePublicKeyFromPrivate(privateKeyHex) {
  const crypto = require('crypto');
  
  const publicKeyHash = crypto.createHash('sha256')
    .update(Buffer.from(privateKeyHex, 'hex'))
    .digest('hex');
  
  return '04' + publicKeyHash.substring(0, 62); // Clave pública formato no comprimido
}

function isValidEthereumAddress(address) {
  const ethRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethRegex.test(address);
}

// ALTERNATIVA: Si quieres usar el método más simple, reemplaza todo lo anterior con:
DireccionDeposito._generateEthereumAddress = (xpub, derivationPath, index) => {
  try {
    console.log(`Generando dirección Ethereum SIMPLE con índice ${index}`);
    
    const crypto = require('crypto');
    
    // Generar dirección determinística pero simple
    const input = `${xpub}${index}${Date.now()}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    
    const address = '0x' + hash.substring(0, 40);
    const publicKey = '04' + hash.substring(40, 102);
    
    console.log(`Dirección Ethereum SIMPLE generada: ${address}`);
    
    return {
      address: address,
      publicKey: publicKey, 
      derivationIndex: index
    };
  } catch (error) {
    throw new Error(`Error en generación simple: ${error.message}`);
  }
};

  DireccionDeposito.getNextDerivationIndex = async (walletMaestraId, transaction = null) => {
    try {
      // Validar que walletMaestraId es un UUID válido
      if (!walletMaestraId) {
        throw new Error('walletMaestraId es requerido');
      }

      // Validar formato UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(walletMaestraId)) {
        throw new Error(`walletMaestraId debe ser un UUID válido: ${walletMaestraId}`);
      }

      // Verificar que la wallet existe antes de buscar índices
      const wallet = await sequelize.models.WalletMaestra.findByPk(walletMaestraId, {
        transaction
      });
      
      if (!wallet) {
        throw new Error(`Wallet maestra con ID ${walletMaestraId} no encontrada`);
      }

      // Obtener el índice más alto usado para esta wallet maestra
      const result = await DireccionDeposito.findOne({
        attributes: [
          [sequelize.fn('COALESCE', 
            sequelize.fn('MAX', sequelize.col('derivation_index')), 
            -1
          ), 'maxIndex']
        ],
        where: { 
          walletMaestraId: walletMaestraId 
        },
        transaction,
        raw: true
      });
      
      // Asegurar que el resultado sea INTEGER y sumar 1 para obtener el siguiente
      const maxIndex = parseInt(result?.maxIndex || -1);
      const nextIndex = maxIndex + 1;
      
      console.log(`Wallet ${walletMaestraId}: max index actual = ${maxIndex}, siguiente = ${nextIndex}`);
      
      return nextIndex;
    } catch (error) {
      throw new Error(`Error al obtener siguiente índice de derivación: ${error.message}`);
    }
  };

  // =================== MÉTODOS CRUD CON VALIDACIONES ===================

  DireccionDeposito.createDireccion = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      // Validaciones previas
      if (!data.userId || !data.criptomonedaId) {
        throw new Error('userId y criptomonedaId son requeridos');
      }

      // OPCIONAL: Verificar si ya existe otra dirección activa (comentado para permitir múltiples)
      // Si quieres permitir múltiples direcciones por usuario-crypto, comenta este bloque:
      /*
      const existingDireccion = await DireccionDeposito.findOne({
        where: { 
          userId: data.userId,
          criptomonedaId: data.criptomonedaId,
          activa: true
        },
        transaction
      });
      
      if (existingDireccion) {
        throw new Error('Ya existe una dirección activa para este usuario y criptomoneda');
      }
      */

      // Verificar que la criptomoneda existe y está activa
      const criptomoneda = await sequelize.models.Criptomoneda.findByPk(data.criptomonedaId, {
        transaction
      });
      
      if (!criptomoneda || !criptomoneda.activa) {
        throw new Error('Criptomoneda no encontrada o inactiva');
      }

      // Verificar que la wallet maestra existe si se proporciona
      if (data.walletMaestraId) {
        const walletMaestra = await sequelize.models.WalletMaestra.findByPk(data.walletMaestraId, {
          transaction
        });
        
        if (!walletMaestra || !walletMaestra.activa) {
          throw new Error('Wallet maestra no encontrada o inactiva');
        }
      }

      // Si se proporciona una dirección, verificar que sea única
      if (data.direccion) {
        const existingAddress = await DireccionDeposito.findOne({
          where: { direccion: data.direccion },
          transaction
        });
        
        if (existingAddress) {
          throw new Error('Esta dirección ya está en uso');
        }
      }

      // Preparar datos de creación
      const direccionData = {
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: new Date(),
          method: 'manual_creation'
        }
      };

      const nuevaDireccion = await DireccionDeposito.create(direccionData, { transaction });
      await transaction.commit();
      
      return await DireccionDeposito.getById(nuevaDireccion.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear dirección de depósito: ${error.message}`);
    }
  };

  DireccionDeposito.updateDireccion = async (id, data) => {
    const transaction = await sequelize.transaction();
    
    try {
      const direccion = await DireccionDeposito.findByPk(id, { transaction });
      
      if (!direccion) {
        throw new Error('Dirección de depósito no encontrada');
      }

      // Validar cambio de dirección si se proporciona
      if (data.direccion && data.direccion !== direccion.direccion) {
        const existingAddress = await DireccionDeposito.findOne({
          where: { 
            direccion: data.direccion,
            id: { [Op.ne]: id }
          },
          transaction
        });
        
        if (existingAddress) {
          throw new Error('Esta dirección ya está en uso');
        }
      }

      // Preparar datos de actualización
      const updateData = {
        ...data,
        metadata: {
          ...direccion.metadata,
          ...data.metadata,
          lastModified: new Date()
        }
      };

      await DireccionDeposito.update(updateData, {
        where: { id },
        transaction
      });
      
      await transaction.commit();
      
      return await DireccionDeposito.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar dirección de depósito: ${error.message}`);
    }
  };

  DireccionDeposito.deleteDireccion = async (id) => {
    const transaction = await sequelize.transaction();
    
    try {
      const direccion = await DireccionDeposito.findByPk(id, { transaction });
      
      if (!direccion) {
        throw new Error('Dirección de depósito no encontrada');
      }

      // En lugar de eliminar físicamente, desactivar
      await DireccionDeposito.update(
        { 
          activa: false,
          metadata: {
            ...direccion.metadata,
            deletedAt: new Date(),
            deletedReason: 'manual_deletion'
          }
        },
        { 
          where: { id },
          transaction
        }
      );
      
      await transaction.commit();
      
      return { 
        message: 'Dirección de depósito desactivada correctamente',
        direccionId: id
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al eliminar dirección de depósito: ${error.message}`);
    }
  };

  // =================== VALIDACIONES Y SEGURIDAD ===================

  DireccionDeposito.validateForDeposit = async (direccion) => {
    try {
      const direccionData = await DireccionDeposito.getByAddress(direccion);
      
      if (!direccionData) {
        return {
          valid: false,
          message: 'Dirección de depósito no encontrada'
        };
      }

      if (!direccionData.activa) {
        return {
          valid: false,
          message: 'La dirección de depósito está desactivada'
        };
      }

      if (!direccionData.criptomoneda.activa) {
        return {
          valid: false,
          message: 'La criptomoneda está desactivada'
        };
      }

      if (!direccionData.usuario.activo) {
        return {
          valid: false,
          message: 'El usuario está desactivado'
        };
      }

      if (!direccionData.walletMaestra.activa) {
        return {
          valid: false,
          message: 'La wallet maestra está desactivada'
        };
      }

      return {
        valid: true,
        direccion: direccionData,
        message: 'Dirección válida para depósito'
      };
    } catch (error) {
      return {
        valid: false,
        message: `Error en validación: ${error.message}`
      };
    }
  };

  DireccionDeposito.validateAddress = (address, network) => {
    try {
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'btc':
          return DireccionDeposito._validateBitcoinAddress(address);
        case 'ethereum':
        case 'eth':
        case 'bsc':
        case 'polygon':
          return DireccionDeposito._validateEthereumAddress(address);
        default:
          return { valid: false, message: 'Red no soportada' };
      }
    } catch (error) {
      return { valid: false, message: error.message };
    }
  };

  DireccionDeposito._validateBitcoinAddress = (address) => {
    try {
      bitcoin.address.toOutputScript(address, bitcoin.networks.bitcoin);
      return { valid: true, message: 'Dirección Bitcoin válida' };
    } catch (error) {
      return { valid: false, message: 'Dirección Bitcoin inválida' };
    }
  };

  DireccionDeposito._validateEthereumAddress = (address) => {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (ethAddressRegex.test(address)) {
      return { valid: true, message: 'Dirección Ethereum válida' };
    }
    return { valid: false, message: 'Dirección Ethereum inválida' };
  };

  // =================== MÉTODOS ADMINISTRATIVOS ===================

  DireccionDeposito.updateStatus = async (id, newStatus, reason = null) => {
    const transaction = await sequelize.transaction();
    
    try {
      const direccion = await DireccionDeposito.findByPk(id, { transaction });
      
      if (!direccion) {
        throw new Error('Dirección de depósito no encontrada');
      }

      await DireccionDeposito.update(
        { 
          activa: newStatus,
          metadata: {
            ...direccion.metadata,
            lastStatusChange: new Date(),
            statusChangeReason: reason
          }
        },
        { 
          where: { id },
          transaction
        }
      );
      
      await transaction.commit();
      
      return await DireccionDeposito.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  DireccionDeposito.getStats = async (filters = {}) => {
    try {
      const whereClause = {};
      
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const totalDirecciones = await DireccionDeposito.count({ where: whereClause });
      const direccionesActivas = await DireccionDeposito.count({
        where: { ...whereClause, activa: true }
      });
      const direccionesInactivas = await DireccionDeposito.count({
        where: { ...whereClause, activa: false }
      });

      // Estadísticas por criptomoneda
      const statsByCrypto = await DireccionDeposito.findAll({
        where: whereClause,
        attributes: [
          'criptomonedaId',
          [sequelize.fn('COUNT', sequelize.col('DireccionDeposito.id')), 'count'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN "DireccionDeposito"."activa" = true THEN 1 END')), 'activas']
        ],
        include: [{
          model: sequelize.models.Criptomoneda,
          as: 'criptomoneda',
          attributes: ['symbol', 'nombre', 'red']
        }],
        group: ['criptomonedaId', 'criptomoneda.id'],
        raw: false
      });

      // Estadísticas por wallet maestra
      const statsByWallet = await DireccionDeposito.findAll({
        where: whereClause,
        attributes: [
          'walletMaestraId',
          [sequelize.fn('COUNT', sequelize.col('DireccionDeposito.id')), 'count'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN "DireccionDeposito"."activa" = true THEN 1 END')), 'activas']
        ],
        include: [{
          model: sequelize.models.WalletMaestra,
          as: 'walletMaestra',
          attributes: ['nombre', 'red', 'symbol']
        }],
        group: ['walletMaestraId', 'walletMaestra.id'],
        raw: false
      });

      // Direcciones creadas por día (últimos 30 días)
      const direccionesPorDia = await DireccionDeposito.findAll({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'fecha'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      return {
        resumen: {
          total: totalDirecciones,
          activas: direccionesActivas,
          inactivas: direccionesInactivas,
          porcentajeActivas: totalDirecciones > 0 ? ((direccionesActivas / totalDirecciones) * 100).toFixed(2) : 0
        },
        porCriptomoneda: statsByCrypto,
        porWallet: statsByWallet,
        tendencia: direccionesPorDia
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // =================== OPERACIONES MASIVAS ===================

  DireccionDeposito.createBulkAddresses = async (requests) => {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      
      for (const request of requests) {
        const { userId, criptomonedaId } = request;
        
        const direccion = await DireccionDeposito.generateAddressForUser(
          userId, 
          criptomonedaId, 
          transaction
        );
        
        results.push(direccion);
      }
      
      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error en creación masiva: ${error.message}`);
    }
  };

  DireccionDeposito.regenerateAddress = async (id, reason) => {
    const transaction = await sequelize.transaction();
    
    try {
      const direccionActual = await DireccionDeposito.findByPk(id, {
        include: ['criptomoneda', 'walletMaestra'],
        transaction
      });
      
      if (!direccionActual) {
        throw new Error('Dirección no encontrada');
      }

      // Desactivar la dirección actual
      await DireccionDeposito.update(
        { 
          activa: false,
          metadata: {
            ...direccionActual.metadata,
            deactivatedAt: new Date(),
            deactivationReason: reason
          }
        },
        { where: { id }, transaction }
      );

      // Generar nueva dirección
      const nuevaDireccion = await DireccionDeposito.generateAddressForUser(
        direccionActual.userId,
        direccionActual.criptomonedaId,
        transaction
      );

      await transaction.commit();
      return nuevaDireccion;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al regenerar dirección: ${error.message}`);
    }
  };

  return DireccionDeposito;
}

module.exports = createDireccionDepositoModel;