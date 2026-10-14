// pm2 ecosystem para el backend de BitFlow (MVP).
// Uso en el server:  pm2 start deploy/ecosystem.config.js  &&  pm2 save  &&  pm2 startup
//
// ⚠️ instances: 1 + fork es OBLIGATORIO, no cluster. Los jobs in-process (order matching,
// pollers de blockchain, outbox publisher, reconciliación) son SINGLETON: con 2+ instancias se
// duplicarían → doble procesamiento de retiros / doble barrido. Una sola instancia, siempre.
//
// Secretos: el proceso arranca vía deploy/start-backend.sh, que corre `doppler run` e inyecta las
// env vars de bitflow/prd (fuente única = Doppler). No hay backend/.env en producción. El wrapper
// lee un service token read-only desde un archivo fuera del repo (ver start-backend.sh).
module.exports = {
  apps: [
    {
      name: 'bitflow-backend',
      // Correr el wrapper de Doppler (que a su vez hace `cd backend && doppler run -- node server.js`).
      script: './deploy/start-backend.sh',
      interpreter: 'bash',
      cwd: __dirname + '/..',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      // Protege el box de 1GB: si el proceso se infla, pm2 lo reinicia.
      max_memory_restart: '650M',
      // NODE_ENV también vive en Doppler; lo dejamos acá como red de seguridad del arranque.
      env: {
        NODE_ENV: 'production',
      },
      // Logs rotables (instalá pm2-logrotate: pm2 install pm2-logrotate).
      out_file: '/var/log/bitflow/backend.out.log',
      error_file: '/var/log/bitflow/backend.err.log',
      time: true,
    },
    {
      // Next.js frontend (Slice 8 go-live). `next build` with output:'standalone'
      // produces web/.next/standalone/server.js (+ copy web/.next/static and
      // web/public beside it). Build OFF the 1GB box, rsync the standalone bundle,
      // then pm2 runs server.js on :3000 — nginx (bitflow-next.conf) proxies to it.
      name: 'bitflow-web',
      script: 'web/.next/standalone/server.js',
      cwd: __dirname + '/..',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
      },
      out_file: '/var/log/bitflow/web.out.log',
      error_file: '/var/log/bitflow/web.err.log',
      time: true,
    },
  ],
};
