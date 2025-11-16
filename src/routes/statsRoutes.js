const express = require('express');
const router = express.Router();
const {
  obtenerStatsAdmin,
  obtenerStatsVendedor
} = require('../controllers/statsController');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

// GET /api/stats/admin
router.get('/admin', authenticateToken, requireAdmin, obtenerStatsAdmin);

// GET /api/stats/vendedor/:id
router.get('/vendedor/:id', authenticateToken, obtenerStatsVendedor);

module.exports = router;
