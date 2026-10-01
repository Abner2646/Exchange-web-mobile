require('dotenv').config();

// Pool sizing configurable por env para deploys de bajo tráfico (p.ej. 5 usuarios en una
// db.*.micro con pocas conexiones). Un max no-positivo/ inválido cae al default; min honra 0.
const poolMax = (v, def) => (Number(v) > 0 ? Number(v) : def);
const poolMin = (v, def) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== undefined && v !== '' ? Number(v) : def);

module.exports = {
  development: {
    username: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'app_password', // ✅ password, no loginPassword
    database: process.env.DB_NAME || 'app_database',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER || 'app_user',
    //password: process.env.DB_PASSWORD || 'app_password',
    database: (process.env.DB_NAME || 'app_database') + '_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: poolMax(process.env.DB_POOL_MAX, 10),
      min: poolMin(process.env.DB_POOL_MIN, 2),
      acquire: 30000,
      idle: 10000
    },
    // SSL on por default (DB gestionada / RDS). Para un Postgres en localhost SIN SSL (co-locado en
    // el mismo server), seteá DB_SSL=false o el driver falla con "server does not support SSL".
    dialectOptions: process.env.DB_SSL === 'false'
      ? {}
      : { ssl: { require: true, rejectUnauthorized: false } }
  }
};