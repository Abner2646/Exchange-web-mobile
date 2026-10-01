// pm2 ecosystem para el backend de BitFlow (MVP).
// Uso en el server:  pm2 start deploy/ecosystem.config.js  &&  pm2 save  &&  pm2 startup
//
// ⚠️ instances: 1 + fork es OBLIGATORIO, no cluster. Los jobs in-process (order matching,
// pollers de blockchain, outbox publisher, reconciliación) son SINGLETON: con 2+ instancias se
// duplicarían → doble procesamiento de retiros / doble barrido. Una sola instancia, siempre.
module.exports = {
  apps: [
    {
      name: 'bitflow-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      // Protege el box de 1GB: si el proceso se infla, pm2 lo reinicia.
      max_memory_restart: '650M',
      // La app lee el resto de las vars de backend/.env vía dotenv; acá solo forzamos el entorno.
      env: {
        NODE_ENV: 'production',
      },
      // Logs rotables (instalá pm2-logrotate: pm2 install pm2-logrotate).
      out_file: '/var/log/bitflow/backend.out.log',
      error_file: '/var/log/bitflow/backend.err.log',
      time: true,
    },
  ],
};
