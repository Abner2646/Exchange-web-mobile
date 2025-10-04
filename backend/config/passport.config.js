const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userService = require('../services/user.service');

const configurePassport = () => {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
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