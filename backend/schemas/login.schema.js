const Joi = require('joi')

const LoginSchema = {
    login: Joi.object({
        password: Joi.string().min(8).required().messages({
            'string.pattern.base': 'Password must contain at least 8 characters',
            'string.min': 'Password must contain at least 8 characters',
            'any.required': 'password is required',
        })
    })
}

module.exports = { LoginSchema }