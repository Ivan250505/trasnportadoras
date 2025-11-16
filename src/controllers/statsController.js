const { pool } = require('../config/database');
const { ROLES } = require('../utils/constants');

/**
 * Obtener estadísticas de administrador
 */
async function obtenerStatsAdmin(req, res) {
  try {
    if (req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Solo administradores pueden acceder a estas estadísticas' });
    }

    const [stats] = await pool.query('CALL sp_stats_admin()');

    res.json({ success: true, estadisticas: stats[0][0] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
  }
}

/**
 * Obtener estadísticas de vendedor
 */
async function obtenerStatsVendedor(req, res) {
  try {
    // Verificar permisos
    if (req.user.rol === ROLES.CLIENTE || (req.user.rol === ROLES.VENDEDOR && req.user.id !== parseInt(req.params.id))) {
      return res.status(403).json({ error: 'No tienes permiso para ver estas estadísticas' });
    }

    const [stats] = await pool.query(
      'SELECT * FROM vista_stats_vendedor WHERE vendedor_id = ?',
      [req.params.id]
    );

    if (stats.length === 0) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }

    res.json({ success: true, estadisticas: stats[0] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
  }
}

module.exports = {
  obtenerStatsAdmin,
  obtenerStatsVendedor
};
