// routes/auth.routes

const express = require('express');
const passport = require('passport');
const authController = require('./auth.controller');

const router = express.Router();

/**
 * @openapi
 * /auth/google:
 *   get:
 *     tags: [Auth (OAuth)]
 *     summary: Iniciar el login con Google (redirige a Google)
 *     security: []
 *     responses: { 302: { description: Redirect a Google OAuth } }
 * /auth/google/callback:
 *   get:
 *     tags: [Auth (OAuth)]
 *     summary: Callback de Google OAuth
 *     security: []
 *     responses: { 302: { description: Redirect post-login } }
 * /auth/logout:
 *   post:
 *     tags: [Auth (OAuth)]
 *     summary: Cerrar sesión
 *     security: []
 *     responses: { 200: { description: Sesión cerrada } }
 */
router.get('/google',
  // prompt:'select_account' fuerza a Google a mostrar SIEMPRE el selector de cuenta en vez de
  // reusar silenciosamente la sesión activa de Google (si no, tras un logout el usuario vuelve
  // directo a su cuenta anterior sin poder elegir).
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleCallback
);

router.post('/logout', authController.logout);

module.exports = router;