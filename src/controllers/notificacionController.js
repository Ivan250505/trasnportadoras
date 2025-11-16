const { pool } = require('../config/database');
const { ROLES } = require('../utils/constants');

/**
 * Listar todas las notificaciones (solo admin)
 */
async function listarNotificaciones(req, res) {
  try {
    const { usuario_id, pedido_id, tipo, leida } = req.query;

    let query = 'SELECT * FROM notificaciones WHERE 1=1';
    const params = [];

    if (usuario_id) {
      query += ' AND usuario_id = ?';
      params.push(usuario_id);
    }

    if (pedido_id) {
      query += ' AND pedido_id = ?';
      params.push(pedido_id);
    }

    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }

    if (leida !== undefined) {
      query += ' AND leida = ?';
      params.push(leida === 'true' ? 1 : 0);
    }

    query += ' ORDER BY fecha_envio DESC LIMIT 100';

    const [notificaciones] = await pool.query(query, params);
    res.json({ success: true, notificaciones, total: notificaciones.length });
  } catch (error) {
    console.error('Error al listar notificaciones:', error);
    res.status(500).json({ error: 'Error al listar notificaciones', details: error.message });
  }
}

/**
 * Obtener notificaciones de un usuario
 */
async function obtenerNotificaciones(req, res) {
  try {
    // Verificar que el usuario solo acceda a sus notificaciones
    if (req.user.id !== parseInt(req.params.usuario_id) && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para ver estas notificaciones' });
    }

    const { leida, tipo } = req.query;
    let query = 'SELECT * FROM notificaciones WHERE usuario_id = ?';
    const params = [req.params.usuario_id];

    if (leida !== undefined) {
      query += ' AND leida = ?';
      params.push(leida === 'true' ? 1 : 0);
    }

    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY fecha_envio DESC LIMIT 50';

    const [notificaciones] = await pool.query(query, params);

    // Contar no leídas
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as no_leidas FROM notificaciones WHERE usuario_id = ? AND leida = 0',
      [req.params.usuario_id]
    );

    res.json({
      success: true,
      notificaciones,
      total: notificaciones.length,
      no_leidas: countResult[0].no_leidas
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones', details: error.message });
  }
}

/**
 * Obtener notificación por ID
 */
async function obtenerNotificacion(req, res) {
  try {
    const [notificaciones] = await pool.query(
      'SELECT * FROM notificaciones WHERE id = ?',
      [req.params.id]
    );

    if (notificaciones.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const notificacion = notificaciones[0];

    // Verificar permisos
    if (req.user.id !== notificacion.usuario_id && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta notificación' });
    }

    res.json({ success: true, notificacion });
  } catch (error) {
    console.error('Error al obtener notificación:', error);
    res.status(500).json({ error: 'Error al obtener notificación', details: error.message });
  }
}

/**
 * Marcar notificación como leída
 */
async function marcarComoLeida(req, res) {
  try {
    const [notificaciones] = await pool.query(
      'SELECT usuario_id FROM notificaciones WHERE id = ?',
      [req.params.id]
    );

    if (notificaciones.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    // Verificar permisos
    if (req.user.id !== notificaciones[0].usuario_id && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta notificación' });
    }

    await pool.query(
      'UPDATE notificaciones SET leida = TRUE WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({ error: 'Error al marcar notificación', details: error.message });
  }
}

/**
 * Marcar todas las notificaciones de un usuario como leídas
 */
async function marcarTodasComoLeidas(req, res) {
  try {
    const usuarioId = req.params.usuario_id;

    // Verificar permisos
    if (req.user.id !== parseInt(usuarioId) && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para modificar estas notificaciones' });
    }

    const [result] = await pool.query(
      'UPDATE notificaciones SET leida = TRUE WHERE usuario_id = ? AND leida = FALSE',
      [usuarioId]
    );

    res.json({
      success: true,
      message: 'Todas las notificaciones marcadas como leídas',
      actualizadas: result.affectedRows
    });
  } catch (error) {
    console.error('Error al marcar todas como leídas:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones', details: error.message });
  }
}

/**
 * Eliminar notificación
 */
async function eliminarNotificacion(req, res) {
  try {
    const [notificaciones] = await pool.query(
      'SELECT usuario_id FROM notificaciones WHERE id = ?',
      [req.params.id]
    );

    if (notificaciones.length === 0) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    // Verificar permisos
    if (req.user.id !== notificaciones[0].usuario_id && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta notificación' });
    }

    await pool.query('DELETE FROM notificaciones WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Notificación eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    res.status(500).json({ error: 'Error al eliminar notificación', details: error.message });
  }
}

/**
 * Eliminar todas las notificaciones leídas de un usuario
 */
async function eliminarLeidasUsuario(req, res) {
  try {
    const usuarioId = req.params.usuario_id;

    // Verificar permisos
    if (req.user.id !== parseInt(usuarioId) && req.user.rol !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar estas notificaciones' });
    }

    const [result] = await pool.query(
      'DELETE FROM notificaciones WHERE usuario_id = ? AND leida = TRUE',
      [usuarioId]
    );

    res.json({
      success: true,
      message: 'Notificaciones leídas eliminadas',
      eliminadas: result.affectedRows
    });
  } catch (error) {
    console.error('Error al eliminar notificaciones leídas:', error);
    res.status(500).json({ error: 'Error al eliminar notificaciones', details: error.message });
  }
}

module.exports = {
  listarNotificaciones,
  obtenerNotificaciones,
  obtenerNotificacion,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  eliminarLeidasUsuario
};
