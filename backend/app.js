const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

// Environment validation (kept here so anything importing the app fails fast).
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no configurado');
}

const configurePassport = require('./config/passport.config');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Email side-effects go through app.locals so tests can inject a fake.
// Default is the real service module (production behavior unchanged).
app.locals.emailService = require('./services/email.service');

// Google id_token verification goes through app.locals so tests can inject a
// fake. Default is the real google-auth-library verifier (prod unchanged).
app.locals.googleTokenVerifier = require('./services/auth/googleTokenVerifier');

// CORS (same policy as before)
const rawAllowed = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
const allowedOrigins = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('*');
}
app.use(cors({
  origin: function (origin, callback) {
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// Per-request log — skip in tests to keep output clean.
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`📱 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
  });
  app.use(morgan('combined'));
}

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

module.exports = app;
