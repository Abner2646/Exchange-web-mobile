// routes/configuracionNegocio.routes.js
// Radar #13 — CRUD de admin sobre la config de negocio. Prefijo: /config
const { Router } = require('express');
const router = Router();

const { authenticateToken } = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/adminMiddleware');
const requireOperatorMFA = require('../middleware/operatorMFA.middleware');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/configuracionNegocio.controller');

// Editar política de negocio es una acción privilegiada de operador (Fase 4.9):
// autenticado + admin + 2FA de operador para TODAS las rutas de config.
router.use(authenticateToken, isAdmin, requireOperatorMFA);

/**
 * @openapi
 * /config:
 *   get:
 *     tags: [Configuración de negocio - admin]
 *     summary: Listar la configuración de negocio (Radar #13)
 *     parameters:
 *       - { in: query, name: categoria, required: false, schema: { type: string } }
 *     responses:
 *       200: { description: Lista de parámetros de configuración }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Operador sin 2FA activado (Fase 4.9) }
 * /config/{clave}:
 *   get:
 *     tags: [Configuración de negocio - admin]
 *     summary: Obtener un parámetro por clave
 *     parameters:
 *       - { in: path, name: clave, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Parámetro }
 *       404: { $ref: '#/components/responses/BadRequest' }
 *   put:
 *     tags: [Configuración de negocio - admin]
 *     summary: Crear o actualizar un parámetro (invalida la cache)
 *     parameters:
 *       - { in: path, name: clave, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [valor]
 *             properties:
 *               valor: { type: string }
 *               tipo: { type: string, enum: [string, number, boolean, json] }
 *               categoria: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       200: { description: Guardado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.get('/', asyncHandler(controller.getConfiguraciones));
router.get('/:clave', asyncHandler(controller.getConfiguracion));
router.put('/:clave', asyncHandler(controller.upsertConfiguracion));

module.exports = router;
