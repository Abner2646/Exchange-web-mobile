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

// 🔧 CORS Configuration
const rawAllowed = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
const allowedOrigins = rawAllowed
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ⭐ MODIFICADO: En desarrollo, permitir TODO (para mobile)
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('*'); // Permite cualquier origen en desarrollo
  console.log('🔓 CORS: Modo desarrollo - Aceptando todos los orígenes');
}

console.log('CORS allowed origins:', allowedOrigins.length ? allowedOrigins.join(',') : '[none]');

// ⭐ CORS SIMPLIFICADO para desarrollo mobile
app.use(cors({
  origin: function(origin, callback) {
    // En desarrollo, permitir todo
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // En producción, validar
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

// Helmet DESPUÉS de CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// ⭐ LOG de requests (útil para debug mobile)
app.use((req, res, next) => {
  console.log(`📱 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Rutas
app.use('/api', apiRoutes);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

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
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ⭐ MODIFICADO: Escuchar en 0.0.0.0 para aceptar conexiones de red local
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✅ Database synchronized');
    }
    
    // ⭐ CLAVE: Escuchar en 0.0.0.0 en lugar de localhost
    app.listen(PORT, '0.0.0.0', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌍 Frontend URL: ${process.env.FRONTEND_URL || 'not set'}`);
      console.log(`📱 Mobile access: Use your PC IP + :${PORT}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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