require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || 'app_password',
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
    password: process.env.DB_PASSWORD || 'app_password',
    database: process.env.DB_NAME + '_test' || 'app_database_test',
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
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    },
    // DB_SSL=false deshabilita TLS por completo: para un Postgres co-locado en localhost (sin cert
    // de una CA, solo el snakeoil de Ubuntu) el TLS no aporta nada y rompería el boot
    // (DEPTH_ZERO_SELF_SIGNED_CERT). Default: SSL ON con validación de cert (DB gestionada / RDS).
    dialectOptions: process.env.DB_SSL === 'false' ? {} : {
      ssl: {
        require: true,
        // Validate the DB server's TLS certificate by default — prevents a
        // man-in-the-middle on the Postgres connection. Previously this was
        // hardcoded to false, which silently disabled that validation.
        // DB_SSL_REJECT_UNAUTHORIZED=false is an explicit, insecure escape hatch
        // only for a provider whose CA chain isn't wired up yet; prefer supplying
        // the CA bundle via DB_SSL_CA (e.g. the RDS global bundle) and leaving
        // validation on.
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
      }
    }
  }
};