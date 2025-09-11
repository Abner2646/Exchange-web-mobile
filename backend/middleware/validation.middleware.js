// middlewares/validation.middleware.js
const { body, param, query, validationResult } = require('express-validator');
const { Criptomoneda } = require('../models');

class ValidationMiddleware {
  // Validar UUID en parámetros
  validateUUID(field) {
    return param(field)
      .isUUID(4)
      .withMessage(`${field} debe ser un UUID válido`);
  }

  // Validar hash de transacción
  validateTxHash = [
    param('hash')
      .isLength({ min: 10, max: 100 })
      .withMessage('Hash de transacción inválido')
      .matches(/^[a-fA-F0-9_]+$/)
      .withMessage('Hash debe contener solo caracteres hexadecimales')
  ];

  // Validar datos de retiro
  validateWithdrawal = [
    body('criptomonedaId')
      .isUUID(4)
      .withMessage('criptomonedaId debe ser un UUID válido'),
    
    body('cantidad')
      .isFloat({ min: 0.000001 })
      .withMessage('Cantidad debe ser un número positivo mayor a 0.000001')
      .custom((value) => {
        // Validar que no tenga más de 8 decimales
        const decimals = (value.toString().split('.')[1] || '').length;
        if (decimals > 8) {
          throw new Error('Cantidad no puede tener más de 8 decimales');
        }
        return true;
      }),
    
    body('direccionDestino')
      .isString()
      .isLength({ min: 20, max: 100 })
      .withMessage('Dirección de destino debe tener entre 20 y 100 caracteres')
      .custom(async (value, { req }) => {
        // Validación básica de formato según el tipo de dirección
        const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
        const ethRegex = /^0x[a-fA-F0-9]{40}$/;
        
        if (!btcRegex.test(value) && !ethRegex.test(value)) {
          throw new Error('Formato de dirección inválido');
        }
        return true;
      }),

    // Middleware para procesar errores de validación
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }
      next();
    }
  ];

  // Validar rechazo de transacción
  validateRejection = [
    body('razon')
      .optional()
      .isString()
      .isLength({ min: 5, max: 500 })
      .withMessage('Razón debe tener entre 5 y 500 caracteres'),

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Datos de entrada inválidos',
          errors: errors.array()
        });
      }
      next();
    }
  ];

  // Validar filtros de consulta
  validateQueryFilters = [
    query('tipo')
      .optional()
      .isIn(['deposito', 'retiro'])
      .withMessage('Tipo debe ser deposito o retiro'),
    
    query('estado')
      .optional()
      .isIn(['pendiente', 'procesando', 'confirmado', 'completado', 'fallido'])
      .withMessage('Estado inválido'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit debe ser entre 1 y 100'),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset debe ser mayor o igual a 0'),

    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Parámetros de consulta inválidos',
          errors: errors.array()
        });
      }
      next();
    }
  ];
}

module.exports = new ValidationMiddleware();