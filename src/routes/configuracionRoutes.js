const express = require('express');
const router = express.Router();
const {
  listarConfiguraciones,
  obtenerConfiguracion,
  obtenerConfiguracionPorClave,
  crearConfiguracion,
  actualizarConfiguracion,
  eliminarConfiguracion
} = require('../controllers/configuracionController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { validateRequired } = require('../middlewares/validator');

// GET /api/configuracion - Listar todas las configuraciones (admin)
router.get('/', authenticateToken, requireAdmin, listarConfiguraciones);

// GET /api/configuracion/clave/:clave - Obtener por clave (admin)
router.get('/clave/:clave', authenticateToken, requireAdmin, obtenerConfiguracionPorClave);

// GET /api/configuracion/:id - Obtener por ID (admin)
router.get('/:id', authenticateToken, requireAdmin, obtenerConfiguracion);

// POST /api/configuracion - Crear configuración (admin)
router.post('/',
  authenticateToken,
  requireAdmin,
  validateRequired(['clave', 'valor']),
  crearConfiguracion
);

// PUT /api/configuracion/:id - Actualizar configuración (admin)
router.put('/:id', authenticateToken, requireAdmin, actualizarConfiguracion);

// DELETE /api/configuracion/:id - Eliminar configuración (admin)
router.delete('/:id', authenticateToken, requireAdmin, eliminarConfiguracion);

module.exports = router;
