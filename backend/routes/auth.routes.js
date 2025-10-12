// routes/auth.routes

const express = require('express');
const passport = require('passport');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  authController.googleCallback
);

router.post('/logout', authController.logout);

module.exports = router;