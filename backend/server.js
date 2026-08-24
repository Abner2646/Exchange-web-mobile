require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

// ⭐ Escuchar en 0.0.0.0 para aceptar conexiones de red local
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // ⚠️ TEMPORAL: Una sola vez para recrear ENUMs
    await sequelize.sync({ force: true });
    console.log('⚠️ Database reset (recreating ENUMs)');

    app.listen(PORT, '0.0.0.0', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
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
