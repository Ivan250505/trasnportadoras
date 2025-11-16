const express = require('express');
const router = express.Router();
const {
  listarCodigosQR,
  obtenerCodigoQR,
  obtenerCodigoQRPorCodigo,
  validarCodigoQR
} = require('../controllers/qrController');
const { authenticateToken } = require('../middlewares/auth');
const { validateRequired } = require('../middlewares/validator');

// GET /api/qr - Listar códigos QR
router.get('/', authenticateToken, listarCodigosQR);

// GET /api/qr/codigo/:codigo - Obtener por código
router.get('/codigo/:codigo', authenticateToken, obtenerCodigoQRPorCodigo);

// GET /api/qr/:id - Obtener por ID
router.get('/:id', authenticateToken, obtenerCodigoQR);

// POST /api/qr/validar - Validar código QR
router.post('/validar',
  authenticateToken,
  validateRequired(['codigo']),
  validarCodigoQR
);

module.exports = router;
