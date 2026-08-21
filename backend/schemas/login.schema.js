const Joi = require('joi')

// El schema original solo validaba `password` (con una regla de longitud
// mínima propia de un formulario de registro) y ni siquiera cubría
// `emailOrUsername`, que es el campo real que lee usuarioController.loginStep1
// (ver controllers/usuario.controller.js). Un login no valida política de
// contraseña — solo compara contra el hash guardado — así que acá solo se
// chequea presencia/tipo, no fortaleza.
const LoginSchema = {
    login: Joi.object({
        emailOrUsername: Joi.string().trim().min(1).required().messages({
            'string.empty': 'emailOrUsername es requerido',
            'any.required': 'emailOrUsername es requerido',
        }),
        password: Joi.string().min(1).required().messages({
            'string.empty': 'password es requerido',
            'any.required': 'password es requerido',
        })
    })
}

module.exports = { LoginSchema }
