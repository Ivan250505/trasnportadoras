const express = require('express');
const router = express.Router();
const {
  listarNotificaciones,
  obtenerNotificaciones,
  obtenerNotificacion,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  eliminarLeidasUsuario
} = require('../controllers/notificacionController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// GET /api/notificaciones - Listar todas (admin)
router.get('/', authenticateToken, requireAdmin, listarNotificaciones);

// GET /api/notificaciones/usuario/:usuario_id - Notificaciones de un usuario
router.get('/usuario/:usuario_id', authenticateToken, obtenerNotificaciones);

// PUT /api/notificaciones/usuario/:usuario_id/marcar-todas-leidas - Marcar todas como leídas
router.put('/usuario/:usuario_id/marcar-todas-leidas', authenticateToken, marcarTodasComoLeidas);

// DELETE /api/notificaciones/usuario/:usuario_id/eliminar-leidas - Eliminar leídas
router.delete('/usuario/:usuario_id/eliminar-leidas', authenticateToken, eliminarLeidasUsuario);

// GET /api/notificaciones/:id - Obtener notificación por ID
router.get('/:id', authenticateToken, obtenerNotificacion);

// PUT /api/notificaciones/:id/leer - Marcar como leída
router.put('/:id/leer', authenticateToken, marcarComoLeida);

// DELETE /api/notificaciones/:id - Eliminar notificación
router.delete('/:id', authenticateToken, eliminarNotificacion);

module.exports = router;
