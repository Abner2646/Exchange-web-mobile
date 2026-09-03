// routes/auth.routes

const express = require('express');
const passport = require('passport');
const authController = require('../controllers/auth.controller');

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
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleCallback
);

router.post('/logout', authController.logout);

module.exports = router;