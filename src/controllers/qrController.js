const { pool } = require('../config/database');
const { TIPOS_NOTIFICACION, ROLES } = require('../utils/constants');
const { registrarEstado } = require('../services/pedidoService');
const { crearNotificacion, enviarNotificacionAUsuario, notificarAdministradores } = require('../services/notificationService');

/**
 * Listar códigos QR
 */
async function listarCodigosQR(req, res) {
  try {
    const { usado, pedido_id } = req.query;
    const { rol, id: userId } = req.user;

    let query = `
      SELECT qr.*, p.numero_pedido, p.cliente_id
      FROM codigos_qr qr
      INNER JOIN pedidos p ON qr.pedido_id = p.id
      WHERE 1=1
    `;
    const params = [];

    // Filtrar por rol
    if (rol === ROLES.CLIENTE) {
      query += ' AND p.cliente_id = ?';
      params.push(userId);
    } else if (rol === ROLES.VENDEDOR) {
      query += ' AND p.vendedor_id = ?';
      params.push(userId);
    }

    if (usado !== undefined) {
      query += ' AND qr.usado = ?';
      params.push(usado === 'true' ? 1 : 0);
    }

    if (pedido_id) {
      query += ' AND qr.pedido_id = ?';
      params.push(pedido_id);
    }

    query += ' ORDER BY qr.fecha_generacion DESC';

    const [codigos] = await pool.query(query, params);
    res.json({ success: true, codigos, total: codigos.length });
  } catch (error) {
    console.error('Error al listar códigos QR:', error);
    res.status(500).json({ error: 'Error al listar códigos QR', details: error.message });
  }
}

/**
 * Obtener código QR por ID
 */
async function obtenerCodigoQR(req, res) {
  try {
    const [codigos] = await pool.query(
      `SELECT qr.*, p.numero_pedido, p.cliente_id, p.vendedor_id
       FROM codigos_qr qr
       INNER JOIN pedidos p ON qr.pedido_id = p.id
       WHERE qr.id = ?`,
      [req.params.id]
    );

    if (codigos.length === 0) {
      return res.status(404).json({ error: 'Código QR no encontrado' });
    }

    const codigo = codigos[0];

    // Validar permisos
    const { rol, id: userId } = req.user;
    if (rol === ROLES.CLIENTE && codigo.cliente_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este código QR' });
    }
    if (rol === ROLES.VENDEDOR && codigo.vendedor_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este código QR' });
    }

    res.json({ success: true, codigo });
  } catch (error) {
    console.error('Error al obtener código QR:', error);
    res.status(500).json({ error: 'Error al obtener código QR', details: error.message });
  }
}

/**
 * Obtener código QR por código
 */
async function obtenerCodigoQRPorCodigo(req, res) {
  try {
    const [codigos] = await pool.query(
      `SELECT qr.*, p.numero_pedido, p.cliente_id, p.vendedor_id
       FROM codigos_qr qr
       INNER JOIN pedidos p ON qr.pedido_id = p.id
       WHERE qr.codigo = ?`,
      [req.params.codigo]
    );

    if (codigos.length === 0) {
      return res.status(404).json({ error: 'Código QR no encontrado' });
    }

    const codigo = codigos[0];

    // Validar permisos
    const { rol, id: userId } = req.user;
    if (rol === ROLES.CLIENTE && codigo.cliente_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este código QR' });
    }
    if (rol === ROLES.VENDEDOR && codigo.vendedor_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este código QR' });
    }

    res.json({ success: true, codigo });
  } catch (error) {
    console.error('Error al obtener código QR:', error);
    res.status(500).json({ error: 'Error al obtener código QR', details: error.message });
  }
}

/**
 * Validar código QR
 */
async function validarCodigoQR(req, res) {
  const connection = await pool.getConnection();

  try {
    const { codigo } = req.body;
    const { id: userId } = req.user;

    if (!codigo) {
      return res.status(400).json({ error: 'Código QR requerido' });
    }

    await connection.beginTransaction();

    // Buscar el QR
    const [qrs] = await connection.query(
      `SELECT qr.*, p.cliente_id, p.numero_pedido, p.estado_actual
       FROM codigos_qr qr
       INNER JOIN pedidos p ON qr.pedido_id = p.id
       WHERE qr.codigo = ?`,
      [codigo]
    );

    if (qrs.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Código QR no encontrado' });
    }

    const qr = qrs[0];

    // Validar que el QR pertenece al cliente que lo está escaneando
    if (qr.cliente_id !== userId) {
      await connection.rollback();
      return res.status(403).json({ error: 'Este código QR no pertenece a tus pedidos' });
    }

    // Validar que no haya sido usado
    if (qr.usado) {
      await connection.rollback();
      return res.status(400).json({ error: 'Este código QR ya fue utilizado' });
    }

    // Marcar QR como usado
    await connection.query(
      'UPDATE codigos_qr SET usado = TRUE, fecha_escaneo = NOW() WHERE id = ?',
      [qr.id]
    );

    // Actualizar pedido a confirmado_qr
    await connection.query(
      'UPDATE pedidos SET estado_actual = "confirmado_qr", confirmado_qr = TRUE, fecha_confirmacion_qr = NOW() WHERE id = ?',
      [qr.pedido_id]
    );

    // Registrar en historial
    await registrarEstado(connection, qr.pedido_id, 'confirmado_qr', 'Cliente confirmó recepción escaneando QR', null, userId, 'manual');

    // Obtener datos del pedido
    const [pedidoData] = await connection.query(
      'SELECT vendedor_id, numero_pedido FROM pedidos WHERE id = ?',
      [qr.pedido_id]
    );

    const mensaje = `Cliente confirmó recepción del pedido ${pedidoData[0].numero_pedido}`;

    // Notificar vendedor
    await crearNotificacion(connection, pedidoData[0].vendedor_id, qr.pedido_id, TIPOS_NOTIFICACION.QR_CONFIRMADO, 'Entrega Confirmada', mensaje);
    await enviarNotificacionAUsuario(pedidoData[0].vendedor_id, 'Entrega Confirmada', mensaje, qr.pedido_id);

    // Notificar admins
    await notificarAdministradores(connection, qr.pedido_id, TIPOS_NOTIFICACION.QR_CONFIRMADO, 'Entrega Confirmada', mensaje);

    await connection.commit();

    res.json({
      success: true,
      message: 'Entrega confirmada exitosamente',
      pedido: {
        id: qr.pedido_id,
        numero_pedido: qr.numero_pedido
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al validar QR:', error);
    res.status(500).json({ error: 'Error al validar código QR', details: error.message });
  } finally {
    connection.release();
  }
}

module.exports = {
  listarCodigosQR,
  obtenerCodigoQR,
  obtenerCodigoQRPorCodigo,
  validarCodigoQR
};
