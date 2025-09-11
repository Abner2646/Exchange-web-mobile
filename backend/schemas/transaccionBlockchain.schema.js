// schemas/transaccionBlockchain.schema.js
const Joi = require('joi');

class TransaccionBlockchainSchema {
  // Schema para crear retiro
  createWithdrawal = Joi.object({
    criptomonedaId: Joi.string()
      .uuid({ version: 4 })
      .required()
      .messages({
        'string.empty': 'criptomonedaId es requerido',
        'string.guid': 'criptomonedaId debe ser un UUID válido'
      }),
    
    cantidad: Joi.number()
      .positive()
      .precision(8)
      .min(0.00000001)
      .max(999999999)
      .required()
      .messages({
        'number.base': 'cantidad debe ser un número',
        'number.positive': 'cantidad debe ser positiva',
        'number.min': 'cantidad mínima es 0.00000001',
        'number.max': 'cantidad máxima excedida',
        'any.required': 'cantidad es requerida'
      }),
    
    direccionDestino: Joi.string()
      .min(20)
      .max(100)
      .pattern(/^[a-zA-Z0-9]+$/, 'alfanumérico')
      .required()
      .messages({
        'string.empty': 'direccionDestino es requerida',
        'string.min': 'direccionDestino debe tener al menos 20 caracteres',
        'string.max': 'direccionDestino no puede exceder 100 caracteres',
        'string.pattern.name': 'direccionDestino debe ser alfanumérica'
      }),
    
    memo: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'memo no puede exceder 500 caracteres'
      })
  });

  // Schema para filtros de consulta
  queryFilters = Joi.object({
    tipo: Joi.string()
      .valid('deposito', 'retiro')
      .optional(),
    
    estado: Joi.string()
      .valid('pendiente', 'procesando', 'confirmado', 'completado', 'fallido')
      .optional(),
    
    criptomonedaId: Joi.string()
      .uuid({ version: 4 })
      .optional(),
    
    fechaDesde: Joi.date()
      .iso()
      .optional()
      .messages({
        'date.format': 'fechaDesde debe estar en formato ISO'
      }),
    
    fechaHasta: Joi.date()
      .iso()
      .greater(Joi.ref('fechaDesde'))
      .optional()
      .messages({
        'date.format': 'fechaHasta debe estar en formato ISO',
        'date.greater': 'fechaHasta debe ser posterior a fechaDesde'
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20)
      .optional(),
    
    offset: Joi.number()
      .integer()
      .min(0)
      .default(0)
      .optional(),
    
    montoMin: Joi.number()
      .positive()
      .optional(),
    
    montoMax: Joi.number()
      .positive()
      .greater(Joi.ref('montoMin'))
      .optional()
  });

  // Schema para aprobar/rechazar transacción
  adminAction = Joi.object({
    razon: Joi.string()
      .min(5)
      .max(500)
      .when('action', {
        is: 'reject',
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'string.empty': 'razón es requerida para rechazar',
        'string.min': 'razón debe tener al menos 5 caracteres',
        'string.max': 'razón no puede exceder 500 caracteres'
      }),
    
    action: Joi.string()
      .valid('approve', 'reject')
      .required()
  });

  // Schema para actualizar confirmaciones
  updateConfirmations = Joi.object({
    confirmaciones: Joi.number()
      .integer()
      .min(0)
      .max(100)
      .required()
      .messages({
        'number.base': 'confirmaciones debe ser un número',
        'number.integer': 'confirmaciones debe ser un entero',
        'number.min': 'confirmaciones no puede ser negativo',
        'number.max': 'confirmaciones no puede exceder 100'
      }),
    
    txHash: Joi.string()
      .min(10)
      .max(100)
      .optional()
      .messages({
        'string.min': 'txHash debe tener al menos 10 caracteres',
        'string.max': 'txHash no puede exceder 100 caracteres'
      })
  });

  // Validar direcciones por red
  validateAddress(address, network) {
    let schema;
    
    switch (network.toLowerCase()) {
      case 'bitcoin':
      case 'btc':
        schema = Joi.string()
          .pattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/)
          .messages({
            'string.pattern.base': 'Dirección Bitcoin inválida'
          });
        break;
      
      case 'ethereum':
      case 'eth':
      case 'bsc':
        schema = Joi.string()
          .pattern(/^0x[a-fA-F0-9]{40}$/)
          .messages({
            'string.pattern.base': 'Dirección Ethereum/BSC inválida'
          });
        break;
      
      default:
        schema = Joi.string()
          .min(20)
          .max(100)
          .messages({
            'string.min': 'Dirección debe tener al menos 20 caracteres',
            'string.max': 'Dirección no puede exceder 100 caracteres'
          });
    }
    
    return schema.validate(address);
  }
}

module.exports = new TransaccionBlockchainSchema();