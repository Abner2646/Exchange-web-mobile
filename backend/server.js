require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;
// Interfaz de bind. Default 0.0.0.0 (sin cambio). En prod detrás de un reverse proxy, seteá
// BIND_HOST=127.0.0.1 para que el backend NO escuche en la interfaz pública (defensa en profundidad:
// el firewall ya bloquea 3001, esto lo blinda igual).
const HOST = process.env.BIND_HOST || '0.0.0.0';

// ⭐ Escuchar en 0.0.0.0 para aceptar conexiones de network local
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Sincronizar modelos sin destruir datos
    await sequelize.sync();
    console.log('✅ Database models synchronized');

    app.listen(PORT, HOST, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    const { registerAllHandlers } = require('./modules/events/registerHandlers');
    registerAllHandlers();

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
