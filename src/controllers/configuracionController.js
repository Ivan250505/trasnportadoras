const { pool } = require('../config/database');

/**
 * Listar todas las configuraciones
 */
async function listarConfiguraciones(req, res) {
  try {
    const [configuraciones] = await pool.query(
      'SELECT * FROM configuracion ORDER BY clave ASC'
    );

    res.json({ success: true, configuraciones, total: configuraciones.length });
  } catch (error) {
    console.error('Error al listar configuraciones:', error);
    res.status(500).json({ error: 'Error al listar configuraciones', details: error.message });
  }
}

/**
 * Obtener configuración por ID
 */
async function obtenerConfiguracion(req, res) {
  try {
    const [configuraciones] = await pool.query(
      'SELECT * FROM configuracion WHERE id = ?',
      [req.params.id]
    );

    if (configuraciones.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    res.json({ success: true, configuracion: configuraciones[0] });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración', details: error.message });
  }
}

/**
 * Obtener configuración por clave
 */
async function obtenerConfiguracionPorClave(req, res) {
  try {
    const [configuraciones] = await pool.query(
      'SELECT * FROM configuracion WHERE clave = ?',
      [req.params.clave]
    );

    if (configuraciones.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    res.json({ success: true, configuracion: configuraciones[0] });
  } catch (error) {
    console.error('Error al obtener configuración:', error);
    res.status(500).json({ error: 'Error al obtener configuración', details: error.message });
  }
}

/**
 * Crear configuración
 */
async function crearConfiguracion(req, res) {
  try {
    const { clave, valor, descripcion } = req.body;

    if (!clave || !valor) {
      return res.status(400).json({ error: 'Clave y valor son requeridos' });
    }

    // Verificar que la clave no exista
    const [existentes] = await pool.query(
      'SELECT id FROM configuracion WHERE clave = ?',
      [clave]
    );

    if (existentes.length > 0) {
      return res.status(400).json({ error: 'Ya existe una configuración con esa clave' });
    }

    const [result] = await pool.query(
      `INSERT INTO configuracion (clave, valor, descripcion)
       VALUES (?, ?, ?)`,
      [clave, valor, descripcion || null]
    );

    res.status(201).json({
      success: true,
      message: 'Configuración creada exitosamente',
      configuracion: {
        id: result.insertId,
        clave,
        valor,
        descripcion
      }
    });
  } catch (error) {
    console.error('Error al crear configuración:', error);
    res.status(500).json({ error: 'Error al crear configuración', details: error.message });
  }
}

/**
 * Actualizar configuración
 */
async function actualizarConfiguracion(req, res) {
  try {
    const { valor, descripcion } = req.body;
    const configId = req.params.id;

    // Verificar que existe
    const [configuraciones] = await pool.query(
      'SELECT id FROM configuracion WHERE id = ?',
      [configId]
    );

    if (configuraciones.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    // Construir query dinámico
    const updates = [];
    const params = [];

    if (valor !== undefined) {
      updates.push('valor = ?');
      params.push(valor);
    }
    if (descripcion !== undefined) {
      updates.push('descripcion = ?');
      params.push(descripcion);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    params.push(configId);

    await pool.query(
      `UPDATE configuracion SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Configuración actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar configuración:', error);
    res.status(500).json({ error: 'Error al actualizar configuración', details: error.message });
  }
}

/**
 * Eliminar configuración
 */
async function eliminarConfiguracion(req, res) {
  try {
    const configId = req.params.id;

    // Verificar que existe
    const [configuraciones] = await pool.query(
      'SELECT clave FROM configuracion WHERE id = ?',
      [configId]
    );

    if (configuraciones.length === 0) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }

    // Verificar que no sea una configuración crítica (contadores)
    const clavesProtegidas = ['contador_qr', 'contador_pedido'];
    if (clavesProtegidas.includes(configuraciones[0].clave)) {
      return res.status(403).json({
        error: 'No se puede eliminar esta configuración porque es crítica para el sistema'
      });
    }

    await pool.query('DELETE FROM configuracion WHERE id = ?', [configId]);

    res.json({ success: true, message: 'Configuración eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar configuración:', error);
    res.status(500).json({ error: 'Error al eliminar configuración', details: error.message });
  }
}

module.exports = {
  listarConfiguraciones,
  obtenerConfiguracion,
  obtenerConfiguracionPorClave,
  crearConfiguracion,
  actualizarConfiguracion,
  eliminarConfiguracion
};
