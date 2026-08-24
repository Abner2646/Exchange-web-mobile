// Sets the environment every test run needs, in-process (cross-platform,
// no shell env / cross-env). Only fills values that are not already set, so
// an explicit CI/dev override still wins. Required first thing by test files,
// setupFiles, and jest globalSetup.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

// Dummy Google OAuth config: configurePassport() builds a GoogleStrategy at app
// construction, and passport-oauth2 throws if clientID/callbackURL are missing.
// Tests never exercise the OAuth flow — these just let the app mount.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
process.env.GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost/auth/google/callback';

// Point Sequelize's `test` config at the disposable docker-compose.test.yml DB.
// config/database.js `test` uses DB_NAME + '_test' → app_database_test.
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '55432';
process.env.DB_NAME = process.env.DB_NAME || 'app_database';
process.env.DB_USER = process.env.DB_USER || 'app_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'app_password';
