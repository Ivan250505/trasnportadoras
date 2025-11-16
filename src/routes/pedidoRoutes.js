const express = require('express');
const router = express.Router();
const {
  obtenerPedidos,
  obtenerPedidoPorId,
  crearPedido,
  actualizarEstadoPedido
} = require('../controllers/pedidoController');
const { authenticateToken, requireVendedorOrAdmin } = require('../middlewares/auth');
const { validateRequired, validateEstado } = require('../middlewares/validator');

// GET /api/pedidos
router.get('/', authenticateToken, obtenerPedidos);

// GET /api/pedidos/:id
router.get('/:id', authenticateToken, obtenerPedidoPorId);

// POST /api/pedidos
router.post('/',
  authenticateToken,
  requireVendedorOrAdmin,
  validateRequired(['cliente_id', 'ciudad_destino', 'direccion_entrega']),
  crearPedido
);

// PUT /api/pedidos/:id/estado
router.put('/:id/estado',
  authenticateToken,
  requireVendedorOrAdmin,
  validateRequired(['nuevo_estado']),
  validateEstado,
  actualizarEstadoPedido
);

module.exports = router;
