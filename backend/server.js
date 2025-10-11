const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

// Validaciones de entorno
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no configurado');
}

const { sequelize } = require('./models');
const configurePassport = require('./config/passport.config');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3001;

// 🔧 FIX: CORS PRIMERO, ANTES DE HELMET
const rawAllowed = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
const allowedOrigins = rawAllowed
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// En entorno de desarrollo, permitir localhost:3000 por conveniencia
if (process.env.NODE_ENV === 'development') {
  if (!allowedOrigins.includes('http://localhost:3000')) allowedOrigins.push('http://localhost:3000');
}

console.log('CORS allowed origins:', allowedOrigins.length ? allowedOrigins.join(',') : '[none]');

// 🔧 FIX: CORS configuration BEFORE helmet
app.use(cors({
  origin: function(origin, callback) {
    // permitir solicitudes sin origin (p. ej. curl, server2server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    
    console.warn(`❌ CORS blocked origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
}));

// 🔧 FIX: helmet DESPUÉS de CORS, con configuración que no interfiera
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Global middleware to ensure preflight responses always include correct headers
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (!origin) {
    return res.sendStatus(204);
  }
  if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.sendStatus(204);
  }

  console.warn(`CORS preflight denied for origin: ${origin}`);
  return res.status(403).send('CORS origin denied');
});

// Also ensure responses include Access-Control-Allow-Origin when allowed
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session para Passport
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Configurar Passport PRIMERO
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// AHORA importar rutas de auth (después de configurar passport)
const authRoutes = require('./routes/auth.routes');

// Logging middleware para depuración de CORS / endpoints problemáticos
app.use((req, res, next) => {
  if (req.path && (req.path.includes('/usuario/register') || req.path.includes('/usuario/login'))) {
    console.log('--- Incoming auth request ---');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Origin header:', req.headers.origin || 'none');
    console.log('Content-Type:', req.headers['content-type']);
  }
  next();
});

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Rutas
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Inicializar servidor
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    const JobManager = require('./jobs');
    await JobManager.startAll();
  } catch (error) {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

/* ========== PARA EL CERTIFICADO SSL ========= */
/*
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized');
    }

    // 🔐 Configuración HTTPS local
    const sslPath = path.join(__dirname, 'ssl');
    const sslOptions = {
      key: fs.readFileSync(path.join(sslPath, 'key.pem')),
      cert: fs.readFileSync(path.join(sslPath, 'cert.pem')),
    };

    // 🚀 Servidor HTTPS
    const httpsServer = https.createServer(sslOptions, app);
    httpsServer.listen(PORT, () => {
      console.log(`🚀 HTTPS Server running on https://localhost:${PORT}`);
    });

    // 🌍 Servidor HTTP → redirige a HTTPS
    const httpServer = http.createServer((req, res) => {
      const host = req.headers.host ? req.headers.host.split(':')[0] : 'localhost';
      res.writeHead(301, { "Location": `https://${host}:${PORT}${req.url}` });
      res.end();
    });
    httpServer.listen(3000, () => console.log('🌍 HTTP server redirecting to HTTPS'));

    const JobManager = require('./jobs');
    await JobManager.startAll();
  } catch (error) {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
}

*/
