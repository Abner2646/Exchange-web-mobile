// OpenAPI 3 spec generado desde las anotaciones @openapi de los route files
// (swagger-jsdoc). Se sirve como UI interactiva en /api-docs y como JSON en
// /api-docs.json (ver app.js).
//
// CONVENCIÓN DEL PROYECTO: al crear o cambiar un endpoint, actualizar su
// anotación @openapi EN EL MISMO COMMIT (vive al lado de la ruta, en el route
// file) — igual que el contract doc. Un endpoint sin anotar no aparece acá.
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Crypto Exchange API',
      version: '1.0.0',
      description:
        'API de un exchange de cripto custodial (portfolio/audit-grade). ' +
        'Autenticación por JWT Bearer. Los montos se manejan como strings ' +
        'decimales canónicos (nunca floats). Los errores usan el envelope ' +
        '{ error: { code, message } }.',
    },
    servers: [{ url: '/api', description: 'Base de la API (montada en /api)' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        // Envelope de error canónico — documentado una sola vez y referenciado
        // por todas las respuestas de error.
        ErrorEnvelope: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'BALANCE_INSUFFICIENT' },
                message: { type: 'string', example: 'Saldo insuficiente para transferir' },
              },
              required: ['code', 'message'],
            },
          },
        },
        // Monto de dinero: SIEMPRE string decimal canónico (8 decimales), nunca number.
        MoneyString: { type: 'string', example: '123.45000000', description: 'Decimal canónico (string, 8 decimales)' },
        // Una entrada de "mis balances" (forma compartimentada unificada).
        BalanceEntry: {
          type: 'object',
          properties: {
            userId: { type: 'string', format: 'uuid' },
            criptomonedaId: { type: 'string', format: 'uuid' },
            balanceDisponible: { $ref: '#/components/schemas/MoneyString' },
            balanceBloqueado: { $ref: '#/components/schemas/MoneyString' },
            balancePendiente: { $ref: '#/components/schemas/MoneyString' },
            compartimentos: {
              type: 'object',
              properties: {
                funding: {
                  type: 'object',
                  properties: {
                    disponible: { $ref: '#/components/schemas/MoneyString' },
                    bloqueado: { $ref: '#/components/schemas/MoneyString' },
                    pendiente: { $ref: '#/components/schemas/MoneyString' },
                  },
                },
                spot: {
                  type: 'object',
                  properties: {
                    disponible: { $ref: '#/components/schemas/MoneyString' },
                    bloqueado: { $ref: '#/components/schemas/MoneyString' },
                  },
                },
              },
            },
            criptomoneda: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string', format: 'uuid' },
                symbol: { type: 'string', example: 'BTC' },
                nombre: { type: 'string', example: 'Bitcoin' },
                red: { type: 'string', example: 'bitcoin' },
                decimales: { type: 'integer', example: 8 },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Error de negocio/validación (envelope canónico)',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
        Unauthorized: {
          description: 'Falta o es inválido el token JWT',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
      },
    },
    // Default: todo requiere JWT salvo que el endpoint declare `security: []`.
    security: [{ bearerAuth: [] }],
  },
  // Escanea las anotaciones @openapi de los route files. Glob absoluto (no depende
  // del cwd) y con forward-slashes: en Windows path.join da backslashes que el glob
  // de swagger-jsdoc no matchea.
  apis: [path.join(__dirname, '..', 'routes', '*.js').replace(/\\/g, '/')],
};

module.exports = swaggerJsdoc(options);
