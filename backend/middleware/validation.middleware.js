// middleware/validation.middleware.js

const { body, param, query, validationResult } = require('express-validator');
const { Criptomoneda } = require('../models');

// Middleware principal para validar resultados
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      })),
      message: 'Errores de validación en la solicitud'
    });
  }
  
  next();
};

// Validar UUID en parámetros
const validateUUID = (field) => {
  return param(field)
    .isUUID(4)
    .withMessage(`${field} debe ser un UUID válido`);
};

// Validar cantidad
const validateAmount = (field = 'amount') => {
  return body(field)
    .isFloat({ gt: 0 })
    .withMessage(`${field} debe ser un número mayor a 0`);
};

// Validar dirección de criptomoneda
const validateAddress = (field = 'address') => {
  return body(field)
    .isString()
    .notEmpty()
    .trim()
    .withMessage(`${field} es requerida y debe ser válida`);
};

// Validar email
const validateEmail = (field = 'email') => {
  return body(field)
    .isEmail()
    .normalizeEmail()
    .withMessage(`${field} debe ser un email válido`);
};

// Validar que existe una criptomoneda
const validateCryptoExists = (field = 'criptomonedaId') => {
  return body(field)
    .isUUID()
    .withMessage(`${field} debe ser un UUID válido`)
    .custom(async (value) => {
      const crypto = await Criptomoneda.findByPk(value);
      if (!crypto) {
        throw new Error('Criptomoneda no encontrada');
      }
      if (!crypto.activa) {
        throw new Error('Criptomoneda no está activa');
      }
      return true;
    });
};

// Validar paginación
const validatePagination = () => {
  return [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('limit debe estar entre 1 y 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset debe ser mayor o igual a 0')
  ];
};

module.exports = {
  validate,
  validateUUID,
  validateAmount,
  validateAddress,
  validateEmail,
  validateCryptoExists,
  validatePagination
};