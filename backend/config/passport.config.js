const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userService = require('../services/user.service');

const configurePassport = () => {
  // 🔧 Construir la URL completa del callback
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || 
    `${process.env.BACKEND_URL}/auth/google/callback`;

  console.log('🔐 Google OAuth callbackURL:', callbackURL); // Para debugging

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL  // URL absoluta
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await userService.findOrCreateGoogleUser(profile);
      return done(null, user);
    } catch (error) {
      console.error('Error in Google OAuth:', error);
      return done(error, null);
    }
  }));

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });
};

module.exports = configurePassport;