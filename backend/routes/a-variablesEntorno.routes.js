// routes/envChecker.routes.js

const express = require('express');
const router = express.Router();
const envCheckerController = require('../controllers/a-variablesEntorno.controller');

/**
 * @route   GET /api/env-checker/variables
 * @desc    Verificar todas las variables de entorno
 * @access  Private (desarrollo)
 */
router.get('/variables', envCheckerController.checkEnvVariables);

/**
 * @route   GET /api/env-checker/connectivity
 * @desc    Probar conectividad con servicios externos
 * @access  Private (desarrollo)
 */
router.get('/connectivity', envCheckerController.checkConnectivity);

module.exports = router;