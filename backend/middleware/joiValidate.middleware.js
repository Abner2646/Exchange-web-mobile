// middleware/joiValidate.middleware.js
//
// Adaptador genérico para conectar los schemas de Joi ya escritos en
// schemas/ (hasta ahora sin ningún consumidor real). No reemplaza a
// express-validator/validation.middleware.js, que sigue siendo el sistema
// activo en trading.routes.js — ver AUDITORIA_BACKEND.md Código muerto #10.

const joiValidate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación en la solicitud',
      errors: error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      })),
    });
  }

  req.body = value;
  next();
};

module.exports = { joiValidate };
