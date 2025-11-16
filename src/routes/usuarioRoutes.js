const express = require('express');
const router = express.Router();
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  obtenerClientesVendedor,
  actualizarTokenFCM,
  listarVendedores
} = require('../controllers/usuarioController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { validateRequired } = require('../middlewares/validator');

// GET /api/usuarios - Listar todos los usuarios (admin)
router.get('/', authenticateToken, requireAdmin, listarUsuarios);

// GET /api/usuarios/vendedores/lista - Listar vendedores
router.get('/vendedores/lista', authenticateToken, listarVendedores);

// GET /api/usuarios/vendedores/:id/clientes - Clientes de un vendedor
router.get('/vendedores/:id/clientes', authenticateToken, obtenerClientesVendedor);

// GET /api/usuarios/:id - Obtener usuario por ID
router.get('/:id', authenticateToken, obtenerUsuario);

// POST /api/usuarios - Crear usuario (admin)
router.post('/',
  authenticateToken,
  requireAdmin,
  validateRequired(['nombre', 'email', 'username', 'password', 'rol']),
  crearUsuario
);

// PUT /api/usuarios/:id - Actualizar usuario
router.put('/:id', authenticateToken, actualizarUsuario);

// PUT /api/usuarios/:id/fcm-token - Actualizar token FCM
router.put('/:id/fcm-token', authenticateToken, actualizarTokenFCM);

// DELETE /api/usuarios/:id - Eliminar usuario (admin)
router.delete('/:id', authenticateToken, requireAdmin, eliminarUsuario);

module.exports = router;
