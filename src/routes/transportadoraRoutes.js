const express = require('express');
const router = express.Router();
const {
  listarTransportadoras,
  obtenerTransportadora,
  crearTransportadora,
  actualizarTransportadora,
  eliminarTransportadora
} = require('../controllers/transportadoraController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { validateRequired } = require('../middlewares/validator');

// GET /api/transportadoras - Listar transportadoras
router.get('/', authenticateToken, listarTransportadoras);

// GET /api/transportadoras/:id - Obtener transportadora por ID
router.get('/:id', authenticateToken, obtenerTransportadora);

// POST /api/transportadoras - Crear transportadora (admin)
router.post('/',
  authenticateToken,
  requireAdmin,
  validateRequired(['nombre', 'url_rastreo']),
  crearTransportadora
);

// PUT /api/transportadoras/:id - Actualizar transportadora (admin)
router.put('/:id', authenticateToken, requireAdmin, actualizarTransportadora);

// DELETE /api/transportadoras/:id - Eliminar transportadora (admin)
router.delete('/:id', authenticateToken, requireAdmin, eliminarTransportadora);

module.exports = router;
