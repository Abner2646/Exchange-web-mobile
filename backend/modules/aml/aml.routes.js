// modules/aml/aml.routes.js
// Admin AML surface (§4.8). Same gate as business-config: authenticated + admin +
// operator 2FA. Reserved for the Fase 7 admin panel; no user-facing routes here.
const { Router } = require('express');
const router = Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const requireOperatorMFA = require('../../middleware/operatorMFA.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./aml.controller');

router.use(authenticateToken, isAdmin, requireOperatorMFA);

/**
 * @openapi
 * /aml/config:
 *   get:
 *     tags: [AML - admin]
 *     summary: Estado de los toggles AML (monitoring + hold enforcement)
 *     responses:
 *       200: { description: Toggles }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Operador sin 2FA }
 * /aml/config/{key}:
 *   put:
 *     tags: [AML - admin]
 *     summary: Setear una clave de config aml.* (invalida la cache)
 *     parameters: [ { in: path, name: key, required: true, schema: { type: string } } ]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [value], properties: { value: { type: string } } } } } }
 *     responses: { 200: { description: Guardado }, 400: { description: Clave no-aml o value faltante }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { description: Operador sin 2FA } }
 * /aml/denylist:
 *   get:
 *     tags: [AML - admin]
 *     summary: Listar direcciones en denylist (S5)
 *     responses: { 200: { description: Lista }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { description: Operador sin 2FA } }
 *   post:
 *     tags: [AML - admin]
 *     summary: Agregar una direccion a la denylist
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [address, network], properties: { address: { type: string }, network: { type: string }, reason: { type: string }, source: { type: string } } } } } }
 *     responses: { 201: { description: Creada }, 400: { description: Faltan address/network }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { description: Operador sin 2FA } }
 * /aml/denylist/{id}:
 *   delete:
 *     tags: [AML - admin]
 *     summary: Quitar una direccion de la denylist
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses: { 200: { description: Removida }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { description: Operador sin 2FA } }
 * /aml/cases:
 *   get:
 *     tags: [AML - admin]
 *     summary: Listar casos AML (tipping-off — solo admin)
 *     parameters: [ { in: query, name: status, required: false, schema: { type: string } } ]
 *     responses: { 200: { description: Casos }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { description: Operador sin 2FA } }
 * /aml/cases/{id}/resolve:
 *   put:
 *     tags: [AML - admin]
 *     summary: Resolver un caso (approve|reject; S5 libera o rechaza el retiro)
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [decision], properties: { decision: { type: string, enum: [approve, reject] } } } } } }
 *     responses: { 200: { description: Resuelto }, 400: { description: decision invalida }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { description: Operador sin 2FA }, 404: { description: No encontrado }, 409: { description: El caso ya está resuelto } }
 */
router.get('/config', asyncHandler(controller.getConfig));
router.put('/config/:key', asyncHandler(controller.putConfig));
router.get('/denylist', asyncHandler(controller.getDenylist));
router.post('/denylist', asyncHandler(controller.addDenylist));
router.delete('/denylist/:id', asyncHandler(controller.removeDenylist));
router.get('/cases', asyncHandler(controller.getCases));
router.put('/cases/:id/resolve', asyncHandler(controller.resolveCase));

module.exports = router;
