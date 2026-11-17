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
router.get('/google', (req, res, next) => {
  // Carry first-touch attribution (base64 JSON: referer/landing/utm captured by the
  // frontend at the REAL landing page) through the OAuth round-trip via `state`, so a
  // Google signup still attributes to its original source — not accounts.google.com.
  const state = req.query.ft ? String(req.query.ft).slice(0, 2048) : undefined;
  // prompt:'select_account' fuerza a Google a mostrar SIEMPRE el selector de cuenta en vez de
  // reusar silenciosamente la sesión activa de Google (si no, tras un logout el usuario vuelve
  // directo a su cuenta anterior sin poder elegir).
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account', state })(req, res, next);
});

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleCallback
);

router.post('/logout', authController.logout);

module.exports = router;