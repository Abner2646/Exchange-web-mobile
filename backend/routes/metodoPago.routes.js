// routes/metodoPago.routes.js
const { Router } = require('express');
const router = Router();

// Importa el controlador de métodos de pago
const metodoPagoController = require('../controllers/metodoPago.controller.js');

// Middleware de autenticación y autorización
const { authenticateToken} = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

/**
 * @openapi
 * /metodoPago:
 *   get: { tags: [Métodos de pago], summary: Listar métodos de pago, responses: { 200: { description: Métodos } } }
 *   post:
 *     tags: [Métodos de pago - admin]
 *     summary: Crear un método de pago (super admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [nombre], properties: { nombre: { type: string, example: Mercado Pago }, descripcion: { type: string }, activo: { type: boolean } } }
 *     responses: { 201: { description: Creado } }
 * /metodoPago/{id}:
 *   get:
 *     tags: [Métodos de pago]
 *     summary: Método de pago por id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Método }, 404: { $ref: '#/components/responses/BadRequest' } }
 *   put:
 *     tags: [Métodos de pago - admin]
 *     summary: Actualizar un método de pago (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Actualizado } }
 *   delete:
 *     tags: [Métodos de pago - admin]
 *     summary: Eliminar un método de pago (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Eliminado } }
 * /metodoPago/search/query:
 *   get: { tags: [Métodos de pago], summary: Buscar métodos, parameters: [{ in: query, name: q, schema: { type: string } }], responses: { 200: { description: Resultados } } }
 * /metodoPago/name/{nombre}:
 *   get:
 *     tags: [Métodos de pago]
 *     summary: Método por nombre
 *     parameters: [{ in: path, name: nombre, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Método } }
 * /metodoPago/status/active:
 *   get: { tags: [Métodos de pago], summary: Métodos activos, responses: { 200: { description: Activos } } }
 * /metodoPago/status/inactive:
 *   get: { tags: [Métodos de pago - admin], summary: Métodos inactivos (super admin), responses: { 200: { description: Inactivos } } }
 * /metodoPago/{id}/check-active:
 *   get:
 *     tags: [Métodos de pago]
 *     summary: Verificar si un método está activo
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Estado } }
 * /metodoPago/{id}/validate:
 *   get:
 *     tags: [Métodos de pago]
 *     summary: Validar un método de pago para uso
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Válido } }
 */

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los métodos de pago
router.get('/', authenticateToken, metodoPagoController.getMetodosPago); //Bien
/*
Devuelve ej: 
[
    {
        "id": "cd323f9b-2392-47a1-83fd-69d3fb146a42",
        "nombre": "Mercado Pago",
        "descripcion": "Método confiable",
        "activo": true
    }
]
*/

// Obtener método de pago por ID
router.get('/:id', authenticateToken, metodoPagoController.getMetodoPagoById);

// Crear nuevo método de pago (solo super admin)
router.post('/', authenticateToken, isSuperAdmin, metodoPagoController.createMetodoPago); // Bien

// Actualizar método de pago por ID (solo super admin)
router.put('/:id', authenticateToken, isSuperAdmin, metodoPagoController.updateMetodoPago);

// Eliminar método de pago por ID (solo super admin)
router.delete('/:id', authenticateToken, isSuperAdmin, metodoPagoController.deleteMetodoPago);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar métodos de pago por término
router.get('/search/query', authenticateToken, metodoPagoController.searchMetodosPago);

// Obtener método de pago por nombre
router.get('/name/:nombre', authenticateToken, metodoPagoController.getMetodoPagoByName);

// --------------------- RUTAS DE ESTADO --------------------- //

// Obtener métodos de pago activos
router.get('/status/active', authenticateToken, metodoPagoController.getActiveMetodosPago);

// Obtener métodos de pago inactivos (solo admin)
router.get('/status/inactive', authenticateToken, isSuperAdmin, metodoPagoController.getInactiveMetodosPago);

// Verificar si método está activo
router.get('/:id/check-active', authenticateToken, metodoPagoController.checkMetodoActive);

// Validar método de pago para uso
router.get('/:id/validate', authenticateToken, metodoPagoController.validateMetodoPago);

// --------------------- RUTAS DE GESTIÓN DE ESTADO --------------------- //

// Actualizar estado específico de método de pago (solo admin)
//router.patch('/:id/status', authenticateToken, /*requireAdmin,*/ metodoPagoController.updateMetodoPagoStatus);

// Alternar estado de método de pago (solo admin)
//router.patch('/:id/toggle', authenticateToken, /*requireAdmin,*/ metodoPagoController.toggleMetodoPagoStatus);

// Actualización masiva de estado (solo admin)
//router.patch('/bulk/status', authenticateToken, /*requireAdmin,*/ metodoPagoController.bulkUpdateStatus);

// --------------------- RUTAS DE CONSULTA ESPECIALIZADA --------------------- //

// Obtener métodos populares
//router.get('/ranking/popular', metodoPagoController.getPopularMetodosPago);

// Obtener métodos para formularios (solo activos, formato simple)
//router.get('/forms/options', metodoPagoController.getMetodosForForm);

// Obtener resumen rápido
//router.get('/summary/quick', metodoPagoController.getQuickSummary);

// --------------------- RUTAS DE DASHBOARD Y ANÁLISIS --------------------- //

// Dashboard de métodos de pago (solo admin)
//router.get('/dashboard/overview', authenticateToken, /*requireAdmin,*/ metodoPagoController.getMetodosPagoDashboard);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de métodos de pago (solo admin)
//router.get('/admin/stats', authenticateToken, /*requireAdmin,*/ metodoPagoController.getMetodoPagoStats);

// Exportar métodos de pago a CSV (solo admin)
//router.get('/admin/export', authenticateToken, /*requireAdmin,*/ metodoPagoController.exportMetodosPago);

module.exports = router;