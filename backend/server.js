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

// Middleware básico
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
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