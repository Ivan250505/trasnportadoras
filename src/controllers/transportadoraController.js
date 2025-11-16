const { pool } = require('../config/database');

/**
 * Listar todas las transportadoras
 */
async function listarTransportadoras(req, res) {
  try {
    const { activa } = req.query;
    let query = 'SELECT * FROM transportadoras WHERE 1=1';
    const params = [];

    if (activa !== undefined) {
      query += ' AND activa = ?';
      params.push(activa === 'true' ? 1 : 0);
    }

    query += ' ORDER BY nombre ASC';

    const [transportadoras] = await pool.query(query, params);
    res.json({ success: true, transportadoras, total: transportadoras.length });
  } catch (error) {
    console.error('Error al listar transportadoras:', error);
    res.status(500).json({ error: 'Error al listar transportadoras', details: error.message });
  }
}

/**
 * Obtener transportadora por ID
 */
async function obtenerTransportadora(req, res) {
  try {
    const [transportadoras] = await pool.query(
      'SELECT * FROM transportadoras WHERE id = ?',
      [req.params.id]
    );

    if (transportadoras.length === 0) {
      return res.status(404).json({ error: 'Transportadora no encontrada' });
    }

    res.json({ success: true, transportadora: transportadoras[0] });
  } catch (error) {
    console.error('Error al obtener transportadora:', error);
    res.status(500).json({ error: 'Error al obtener transportadora', details: error.message });
  }
}

/**
 * Crear transportadora
 */
async function crearTransportadora(req, res) {
  try {
    const { nombre, url_rastreo, tipo_scraping } = req.body;

    if (!nombre || !url_rastreo) {
      return res.status(400).json({ error: 'Nombre y URL de rastreo son requeridos' });
    }

    // Validar tipo de scraping
    const tiposValidos = ['html', 'iframe', 'api'];
    if (tipo_scraping && !tiposValidos.includes(tipo_scraping)) {
      return res.status(400).json({ error: 'Tipo de scraping inválido', tiposValidos });
    }

    const [result] = await pool.query(
      `INSERT INTO transportadoras (nombre, url_rastreo, tipo_scraping)
       VALUES (?, ?, ?)`,
      [nombre, url_rastreo, tipo_scraping || 'html']
    );

    res.status(201).json({
      success: true,
      message: 'Transportadora creada exitosamente',
      transportadora: {
        id: result.insertId,
        nombre,
        url_rastreo,
        tipo_scraping: tipo_scraping || 'html'
      }
    });
  } catch (error) {
    console.error('Error al crear transportadora:', error);
    res.status(500).json({ error: 'Error al crear transportadora', details: error.message });
  }
}

/**
 * Actualizar transportadora
 */
async function actualizarTransportadora(req, res) {
  try {
    const { nombre, url_rastreo, tipo_scraping, activa } = req.body;
    const transportadoraId = req.params.id;

    // Verificar que existe
    const [transportadoras] = await pool.query(
      'SELECT id FROM transportadoras WHERE id = ?',
      [transportadoraId]
    );

    if (transportadoras.length === 0) {
      return res.status(404).json({ error: 'Transportadora no encontrada' });
    }

    // Construir query dinámico
    const updates = [];
    const params = [];

    if (nombre !== undefined) {
      updates.push('nombre = ?');
      params.push(nombre);
    }
    if (url_rastreo !== undefined) {
      updates.push('url_rastreo = ?');
      params.push(url_rastreo);
    }
    if (tipo_scraping !== undefined) {
      const tiposValidos = ['html', 'iframe', 'api'];
      if (!tiposValidos.includes(tipo_scraping)) {
        return res.status(400).json({ error: 'Tipo de scraping inválido', tiposValidos });
      }
      updates.push('tipo_scraping = ?');
      params.push(tipo_scraping);
    }
    if (activa !== undefined) {
      updates.push('activa = ?');
      params.push(activa ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    params.push(transportadoraId);

    await pool.query(
      `UPDATE transportadoras SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ success: true, message: 'Transportadora actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar transportadora:', error);
    res.status(500).json({ error: 'Error al actualizar transportadora', details: error.message });
  }
}

/**
 * Eliminar transportadora (soft delete)
 */
async function eliminarTransportadora(req, res) {
  try {
    const transportadoraId = req.params.id;

    // Verificar que existe
    const [transportadoras] = await pool.query(
      'SELECT id FROM transportadoras WHERE id = ?',
      [transportadoraId]
    );

    if (transportadoras.length === 0) {
      return res.status(404).json({ error: 'Transportadora no encontrada' });
    }

    // Soft delete
    await pool.query('UPDATE transportadoras SET activa = 0 WHERE id = ?', [transportadoraId]);

    res.json({ success: true, message: 'Transportadora desactivada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar transportadora:', error);
    res.status(500).json({ error: 'Error al eliminar transportadora', details: error.message });
  }
}

module.exports = {
  listarTransportadoras,
  obtenerTransportadora,
  crearTransportadora,
  actualizarTransportadora,
  eliminarTransportadora
};
