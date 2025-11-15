const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bucaclinicos_secret_2025';
const SALT_ROUNDS = 10;

// ============================================================================
// CONFIGURACIÓN DE FIREBASE ADMIN SDK (API V1)
// ============================================================================

// Ruta al archivo de cuenta de servicio de Firebase
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.join(__dirname, 'firebase-service-account.json');

// Inicializar Firebase Admin SDK
let firebaseInitialized = false;
if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin SDK:', error.message);
    console.error('   Las notificaciones push NO funcionarán');
  }
} else {
  console.warn('⚠️ Archivo de cuenta de servicio de Firebase no encontrado');
  console.warn(`   Buscado en: ${serviceAccountPath}`);
  console.warn('   Las notificaciones push NO funcionarán');
  console.warn('   Descarga el archivo desde Firebase Console y guárdalo como firebase-service-account.json');
}

// ============================================================================
// CONFIGURACIÓN DE MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// CONFIGURACIÓN DE BASE DE DATOS MYSQL
// ============================================================================

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'appbucaclinicos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Verificar conexión al iniciar
async function verificarConexion() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión exitosa a MySQL - Base de datos: ' + dbConfig.database);
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    console.error('   Verifica que XAMPP esté corriendo y la BD exista');
  }
}

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
}

// ============================================================================
// VALIDACIÓN DE ESTADOS (NO RETROCESO)
// ============================================================================

const JERARQUIA_ESTADOS = {
  'pendiente': 1,
  'recibido': 2,
  'en_proceso': 3,
  'facturado': 4,
  'entregado_transportadora': 5,
  'en_transito': 6,
  'entregado_cliente': 7,
  'confirmado_qr': 8
};

function validarCambioEstado(estadoActual, nuevoEstado) {
  const nivelActual = JERARQUIA_ESTADOS[estadoActual] || 0;
  const nivelNuevo = JERARQUIA_ESTADOS[nuevoEstado] || 0;

  if (nivelNuevo <= nivelActual) {
    return {
      valido: false,
      mensaje: `No se puede retroceder de "${estadoActual}" a "${nuevoEstado}". Los estados solo pueden avanzar.`
    };
  }

  return { valido: true };
}

// ============================================================================
// FUNCIÓN PARA ENVIAR NOTIFICACIONES PUSH (FCM V1 API)
// ============================================================================

async function enviarNotificacionPush(fcmToken, titulo, mensaje, data = {}) {
  if (!fcmToken || fcmToken === null) {
    console.log('⚠️ Token FCM no disponible, notificación no enviada');
    return false;
  }

  if (!firebaseInitialized) {
    console.log('⚠️ Firebase no inicializado, notificación no enviada');
    console.log('   Configura firebase-service-account.json en el servidor');
    return false;
  }

  try {
    const message = {
      token: fcmToken,
      notification: {
        title: titulo,
        body: mensaje
      },
      data: {
        ...data,
        // Convertir todos los valores a string (requisito de FCM)
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Convertir data a strings
    if (message.data) {
      Object.keys(message.data).forEach(key => {
        if (message.data[key] !== null && message.data[key] !== undefined) {
          message.data[key] = String(message.data[key]);
        }
      });
    }

    const response = await admin.messaging().send(message);
    console.log(`✅ Notificación push enviada: "${titulo}" - ID: ${response}`);
    return true;
  } catch (error) {
    console.error('❌ Error al enviar notificación FCM:', error.message);
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('   Token FCM inválido o expirado');
    }
    return false;
  }
}

// Función helper para enviar notificación a un usuario específico
async function enviarNotificacionAUsuario(usuarioId, titulo, mensaje, pedidoId = null) {
  try {
    const [usuarios] = await pool.query(
      'SELECT token_fcm FROM usuarios WHERE id = ? AND token_fcm IS NOT NULL',
      [usuarioId]
    );

    if (usuarios.length > 0 && usuarios[0].token_fcm) {
      await enviarNotificacionPush(
        usuarios[0].token_fcm,
        titulo,
        mensaje,
        { pedido_id: pedidoId ? pedidoId.toString() : null }
      );
    }
  } catch (error) {
    console.error('Error al enviar notificación a usuario:', error.message);
  }
}

// ============================================================================
// ENDPOINT DE SALUD
// ============================================================================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      message: 'Bucaclínicos API funcionando correctamente',
      database: 'conectada',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Servidor funcionando pero BD desconectada',
      database: 'desconectada',
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINTS DE AUTENTICACIÓN
// ============================================================================

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    // Buscar usuario por email o username
    const [usuarios] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ? OR username = ? LIMIT 1',
      [email, email]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = usuarios[0];

    // Por ahora, comparación directa (en desarrollo)
    // TODO: En producción usar bcrypt.compare(password, usuario.password)
    if (password !== usuario.password) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // No enviar la contraseña al cliente
    delete usuario.password;

    res.json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor', details: error.message });
  }
});

// REGISTER (solo clientes)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nombre, email, username, password, telefono, ciudad, direccion } = req.body;

    if (!nombre || !email || !username || !password) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si el email o username ya existe
    const [existentes] = await pool.query(
      'SELECT id FROM usuarios WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existentes.length > 0) {
      return res.status(400).json({ error: 'Email o username ya registrado' });
    }

    // Por ahora guardar password en texto plano (desarrollo)
    // TODO: En producción usar: const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      `INSERT INTO usuarios (nombre, email, username, password, rol, telefono, ciudad, direccion)
       VALUES (?, ?, ?, ?, 'cliente', ?, ?, ?)`,
      [nombre, email, username, password, telefono, ciudad, direccion]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      usuarioId: result.insertId
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error al registrar usuario', details: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE USUARIOS
// ============================================================================

// Obtener usuario por ID
app.get('/api/usuarios/:id', authenticateToken, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nombre, email, username, rol, telefono, direccion, ciudad, fecha_registro FROM usuarios WHERE id = ?',
      [req.params.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true, usuario: usuarios[0] });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario', details: error.message });
  }
});

// Obtener clientes de un vendedor
app.get('/api/vendedores/:id/clientes', authenticateToken, async (req, res) => {
  try {
    const [clientes] = await pool.query(
      'SELECT id, nombre, email, telefono, ciudad, direccion FROM usuarios WHERE vendedor_asignado_id = ? AND rol = "cliente"',
      [req.params.id]
    );

    res.json({ success: true, clientes });
  } catch (error) {
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error al obtener clientes', details: error.message });
  }
});

// Actualizar token FCM de un usuario
app.put('/api/usuarios/:id/fcm-token', authenticateToken, async (req, res) => {
  try {
    const { token_fcm } = req.body;

    if (!token_fcm) {
      return res.status(400).json({ error: 'Token FCM requerido' });
    }

    // Verificar que el usuario solo actualice su propio token
    if (req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await pool.query(
      'UPDATE usuarios SET token_fcm = ? WHERE id = ?',
      [token_fcm, req.params.id]
    );

    console.log(`📱 Token FCM actualizado para usuario ${req.params.id}`);

    res.json({ success: true, message: 'Token FCM actualizado' });
  } catch (error) {
    console.error('Error al actualizar token FCM:', error);
    res.status(500).json({ error: 'Error al actualizar token FCM', details: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE PEDIDOS
// ============================================================================

// Obtener todos los pedidos (con filtros por rol)
app.get('/api/pedidos', authenticateToken, async (req, res) => {
  try {
    const { rol, id } = req.user;
    let query;
    let params;

    if (rol === 'admin') {
      // Admin ve todos los pedidos
      query = 'SELECT * FROM vista_pedidos_completos ORDER BY fecha_creacion DESC';
      params = [];
    } else if (rol === 'vendedor') {
      // Vendedor ve pedidos de sus clientes
      query = 'SELECT * FROM vista_pedidos_completos WHERE vendedor_id = ? ORDER BY fecha_creacion DESC';
      params = [id];
    } else {
      // Cliente ve solo sus pedidos
      query = 'SELECT * FROM vista_pedidos_completos WHERE cliente_id = ? ORDER BY fecha_creacion DESC';
      params = [id];
    }

    const [pedidos] = await pool.query(query, params);
    res.json({ success: true, pedidos });
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ error: 'Error al obtener pedidos', details: error.message });
  }
});

// Obtener pedido por ID
app.get('/api/pedidos/:id', authenticateToken, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      'SELECT * FROM vista_pedidos_completos WHERE id = ?',
      [req.params.id]
    );

    if (pedidos.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = pedidos[0];

    // Validar permisos
    const { rol, id: userId } = req.user;
    if (rol === 'cliente' && pedido.cliente_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido' });
    }
    if (rol === 'vendedor' && pedido.vendedor_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver este pedido' });
    }

    // Obtener historial de estados
    const [estados] = await pool.query(
      'SELECT * FROM estados_pedido WHERE pedido_id = ? ORDER BY fecha_registro ASC',
      [req.params.id]
    );

    res.json({ success: true, pedido, estados });
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ error: 'Error al obtener pedido', details: error.message });
  }
});

// Crear nuevo pedido
app.post('/api/pedidos', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { rol, id: userId } = req.user;
    const {
      cliente_id,
      ciudad_destino,
      direccion_entrega,
      link_pedido,
      observaciones
    } = req.body;

    // Validar permisos (solo vendedores y admins pueden crear pedidos)
    if (rol === 'cliente') {
      return res.status(403).json({ error: 'Los clientes no pueden crear pedidos directamente' });
    }

    if (!cliente_id || !ciudad_destino || !direccion_entrega) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    await connection.beginTransaction();

    // Generar número de pedido
    const [config] = await connection.query(
      'SELECT valor FROM configuracion WHERE clave = "contador_pedido" FOR UPDATE'
    );
    const contador = parseInt(config[0].valor) + 1;
    await connection.query(
      'UPDATE configuracion SET valor = ? WHERE clave = "contador_pedido"',
      [contador]
    );
    const numeroPedido = `BUC-${new Date().getFullYear()}-${String(contador).padStart(4, '0')}`;

    // Insertar pedido
    const [result] = await connection.query(
      `INSERT INTO pedidos (
        numero_pedido, cliente_id, vendedor_id, ciudad_destino,
        direccion_entrega, link_pedido, observaciones, estado_actual
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [numeroPedido, cliente_id, userId, ciudad_destino, direccion_entrega, link_pedido, observaciones]
    );

    const pedidoId = result.insertId;

    // Registrar estado inicial (el trigger lo hace automáticamente, pero también podemos verificar)

    // Crear notificación para el cliente
    const mensajeCliente = `Tu pedido ${numeroPedido} ha sido creado`;
    await connection.query(
      `INSERT INTO notificaciones (usuario_id, pedido_id, tipo, titulo, mensaje)
       VALUES (?, ?, 'pedido_creado', 'Nuevo Pedido', ?)`,
      [cliente_id, pedidoId, mensajeCliente]
    );
    // Enviar notificación push
    await enviarNotificacionAUsuario(cliente_id, 'Nuevo Pedido', mensajeCliente, pedidoId);

    // Crear notificación para el admin
    const [admins] = await connection.query(
      'SELECT id FROM usuarios WHERE rol = "admin"'
    );
    const mensajeAdmin = `Pedido ${numeroPedido} requiere aprobación`;
    for (const admin of admins) {
      await connection.query(
        `INSERT INTO notificaciones (usuario_id, pedido_id, tipo, titulo, mensaje)
         VALUES (?, ?, 'pedido_pendiente', 'Nuevo Pedido Pendiente', ?)`,
        [admin.id, pedidoId, mensajeAdmin]
      );
      // Enviar notificación push
      await enviarNotificacionAUsuario(admin.id, 'Nuevo Pedido Pendiente', mensajeAdmin, pedidoId);
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Pedido creado exitosamente',
      pedido: {
        id: pedidoId,
        numero_pedido: numeroPedido
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al crear pedido:', error);
    res.status(500).json({ error: 'Error al crear pedido', details: error.message });
  } finally {
    connection.release();
  }
});

// Actualizar estado de pedido
app.put('/api/pedidos/:id/estado', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { rol } = req.user;
    const { nuevo_estado, descripcion, ubicacion, numero_guia, transportadora_id, link_factura } = req.body;

    // Solo admin y vendedores pueden cambiar estados
    if (rol === 'cliente') {
      return res.status(403).json({ error: 'Los clientes no pueden cambiar estados' });
    }

    if (!nuevo_estado) {
      return res.status(400).json({ error: 'Nuevo estado requerido' });
    }

    await connection.beginTransaction();

    // Obtener estado actual del pedido
    const [pedidos] = await connection.query(
      'SELECT estado_actual, numero_guia FROM pedidos WHERE id = ?',
      [req.params.id]
    );

    if (pedidos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoActual = pedidos[0].estado_actual;

    // Validar que no se retroceda el estado
    const validacion = validarCambioEstado(estadoActual, nuevo_estado);
    if (!validacion.valido) {
      await connection.rollback();
      return res.status(400).json({ error: validacion.mensaje });
    }

    // Preparar datos para actualizar
    let updateFields = { estado_actual: nuevo_estado };
    let updateParams = [nuevo_estado];

    // Si se está entregando a transportadora, guardar guía y generar QR
    if (nuevo_estado === 'entregado_transportadora') {
      if (!numero_guia || !transportadora_id) {
        await connection.rollback();
        return res.status(400).json({ error: 'Número de guía y transportadora requeridos para este estado' });
      }

      updateFields.numero_guia = numero_guia;
      updateFields.transportadora_id = transportadora_id;
      updateParams.push(numero_guia, transportadora_id);

      // Generar código QR
      const [configQR] = await connection.query(
        'SELECT valor FROM configuracion WHERE clave = "contador_qr" FOR UPDATE'
      );
      const contadorQR = parseInt(configQR[0].valor) + 1;
      await connection.query(
        'UPDATE configuracion SET valor = ? WHERE clave = "contador_qr"',
        [contadorQR]
      );
      const codigoQR = `bucaclinicos_QR_${String(contadorQR).padStart(4, '0')}`;

      updateFields.codigo_qr = codigoQR;
      updateParams.push(codigoQR);

      // Insertar en tabla codigos_qr
      await connection.query(
        'INSERT INTO codigos_qr (pedido_id, codigo) VALUES (?, ?)',
        [req.params.id, codigoQR]
      );
    }

    // Si se está facturando, guardar link de factura
    if (nuevo_estado === 'facturado' && link_factura) {
      updateFields.link_factura = link_factura;
      updateParams.push(link_factura);
    }

    // Construir query de actualización
    const setClause = Object.keys(updateFields).map(key => `${key} = ?`).join(', ');
    updateParams.push(req.params.id);

    await connection.query(
      `UPDATE pedidos SET ${setClause} WHERE id = ?`,
      updateParams
    );

    // Registrar en historial de estados
    await connection.query(
      `INSERT INTO estados_pedido (pedido_id, estado, descripcion, ubicacion, usuario_id, origen)
       VALUES (?, ?, ?, ?, ?, 'manual')`,
      [req.params.id, nuevo_estado, descripcion || '', ubicacion || '', req.user.id]
    );

    // Obtener datos del pedido para notificaciones
    const [pedidoData] = await connection.query(
      'SELECT cliente_id, vendedor_id, numero_pedido FROM pedidos WHERE id = ?',
      [req.params.id]
    );

    // Crear notificación para el cliente
    let mensajeNotif = `Tu pedido ${pedidoData[0].numero_pedido} cambió a: ${nuevo_estado}`;
    if (nuevo_estado === 'entregado_transportadora') {
      mensajeNotif += ` - Guía: ${numero_guia} - QR: ${updateFields.codigo_qr || ''}`;
    }

    await connection.query(
      `INSERT INTO notificaciones (usuario_id, pedido_id, tipo, titulo, mensaje)
       VALUES (?, ?, 'cambio_estado', 'Actualización de Pedido', ?)`,
      [pedidoData[0].cliente_id, req.params.id, mensajeNotif]
    );
    // Enviar notificación push
    await enviarNotificacionAUsuario(pedidoData[0].cliente_id, 'Actualización de Pedido', mensajeNotif, req.params.id);

    await connection.commit();

    res.json({
      success: true,
      message: 'Estado actualizado exitosamente',
      nuevo_estado,
      codigo_qr: updateFields.codigo_qr || null
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado', details: error.message });
  } finally {
    connection.release();
  }
});

// ============================================================================
// ENDPOINTS DE CÓDIGOS QR
// ============================================================================

// Validar código QR
app.post('/api/qr/validar', authenticateToken, async (req, res) => {
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
    await connection.query(
      `INSERT INTO estados_pedido (pedido_id, estado, descripcion, usuario_id, origen)
       VALUES (?, 'confirmado_qr', 'Cliente confirmó recepción escaneando QR', ?, 'manual')`,
      [qr.pedido_id, userId]
    );

    // Notificar a admin y vendedor
    const [pedidoData] = await connection.query(
      'SELECT vendedor_id, numero_pedido FROM pedidos WHERE id = ?',
      [qr.pedido_id]
    );

    const mensaje = `Cliente confirmó recepción del pedido ${pedidoData[0].numero_pedido}`;

    // Notificar vendedor
    await connection.query(
      `INSERT INTO notificaciones (usuario_id, pedido_id, tipo, titulo, mensaje)
       VALUES (?, ?, 'qr_confirmado', 'Entrega Confirmada', ?)`,
      [pedidoData[0].vendedor_id, qr.pedido_id, mensaje]
    );
    // Enviar notificación push
    await enviarNotificacionAUsuario(pedidoData[0].vendedor_id, 'Entrega Confirmada', mensaje, qr.pedido_id);

    // Notificar admins
    const [admins] = await connection.query('SELECT id FROM usuarios WHERE rol = "admin"');
    for (const admin of admins) {
      await connection.query(
        `INSERT INTO notificaciones (usuario_id, pedido_id, tipo, titulo, mensaje)
         VALUES (?, ?, 'qr_confirmado', 'Entrega Confirmada', ?)`,
        [admin.id, qr.pedido_id, mensaje]
      );
      // Enviar notificación push
      await enviarNotificacionAUsuario(admin.id, 'Entrega Confirmada', mensaje, qr.pedido_id);
    }

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
});

// ============================================================================
// ENDPOINTS DE NOTIFICACIONES
// ============================================================================

// Obtener notificaciones de un usuario
app.get('/api/notificaciones/:usuario_id', authenticateToken, async (req, res) => {
  try {
    // Verificar que el usuario solo acceda a sus notificaciones
    if (req.user.id !== parseInt(req.params.usuario_id) && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para ver estas notificaciones' });
    }

    const [notificaciones] = await pool.query(
      'SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY fecha_envio DESC LIMIT 50',
      [req.params.usuario_id]
    );

    res.json({ success: true, notificaciones });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    res.status(500).json({ error: 'Error al obtener notificaciones', details: error.message });
  }
});

// Marcar notificación como leída
app.put('/api/notificaciones/:id/leer', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notificaciones SET leida = TRUE WHERE id = ?',
      [req.params.id]
    );

    res.json({ success: true, message: 'Notificación marcada como leída' });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    res.status(500).json({ error: 'Error al marcar notificación', details: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE ESTADÍSTICAS
// ============================================================================

// Estadísticas de admin
app.get('/api/stats/admin', authenticateToken, async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden acceder a estas estadísticas' });
    }

    const [stats] = await pool.query('CALL sp_stats_admin()');

    res.json({ success: true, estadisticas: stats[0][0] });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas', details: error.message });
  }
});

// Estadísticas de vendedor
app.get('/api/stats/vendedor/:id', authenticateToken, async (req, res) => {
  try {
    // Verificar permisos
    if (req.user.rol === 'cliente' || (req.user.rol === 'vendedor' && req.user.id !== parseInt(req.params.id))) {
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
});

// ============================================================================
// WEB SCRAPING DE COPETRAN (INTEGRADO CON BD)
// ============================================================================

app.post('/api/rastrear-guia', async (req, res) => {
  try {
    const { numeroGuia } = req.body;

    if (!numeroGuia) {
      return res.status(400).json({ error: 'Número de guía es requerido' });
    }

    console.log(`🔍 Consultando guía Copetran: ${numeroGuia}`);

    // Paso 1: Obtener la página inicial para establecer sesión
    const sessionResponse = await axios.get(
      'https://autogestion.copetran.com.co/gestion_2/Forms/trakingRemesas.php',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        }
      }
    );

    const cookies = sessionResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    console.log('✅ Sesión establecida');

    // Paso 2: Hacer la consulta de la guía
    const formData = new URLSearchParams({
      'PR00': numeroGuia,
      'Archivo': 'Remesas',
      'Clase': 'Remesas',
      'Funcion': 'trakingRemesas',
      'PR20': '',
      'PR01': 'true',
      'Boton': 'Boton'
    });

    const response = await axios.post(
      'https://autogestion.copetran.com.co/gestion_2/controller/controlador.php',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString,
          'Referer': 'https://autogestion.copetran.com.co/gestion_2/Forms/trakingRemesas.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        },
        timeout: 15000
      }
    );

    console.log('✅ Respuesta recibida de Copetran');

    const htmlContent = response.data || '';
    const lowerHtml = htmlContent.toLowerCase();
    const noResultPhrases = [
      'no se encontraron',
      'no se encontraron remesas',
      'no existe remesa',
      'la remesa consultada no existe',
      'remesa consultada no existe',
      'la remesa consultada',
      'no se encontro',
      'no hay registros',
      'sin resultados',
    ];

    const hasNoResults = noResultPhrases.some((p) => lowerHtml.includes(p));

    if (hasNoResults) {
      console.log('⚠️ Copetran devolvió página sin resultados');
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: numeroGuia,
      });
    }

    // Guardar en BD si el pedido existe
    try {
      const [pedidos] = await pool.query(
        'SELECT id FROM pedidos WHERE numero_guia = ?',
        [numeroGuia]
      );

      if (pedidos.length > 0) {
        // Actualizar estado del pedido en BD (parsear HTML aquí si es necesario)
        console.log(`📝 Actualizando estado en BD para guía ${numeroGuia}`);
        // TODO: Parsear HTML y actualizar estados_pedido
      }
    } catch (dbError) {
      console.error('Error al actualizar BD:', dbError.message);
      // No fallar la petición si hay error en BD
    }

    // Retornar el HTML completo para que el cliente lo parsee
    res.json({
      success: true,
      html: htmlContent,
      numeroGuia: numeroGuia
    });

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Tiempo de espera agotado al consultar Copetran'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Error del servidor de Copetran: ${error.response.status}`
      });
    }

    res.status(500).json({
      error: 'Error al consultar la guía',
      details: error.message
    });
  }
});

// Endpoint GET alternativo
app.get('/api/rastrear-guia/:numero', async (req, res) => {
  try {
    const numeroGuia = req.params.numero;

    if (!numeroGuia) {
      return res.status(400).json({ error: 'Número de guía es requerido' });
    }

    console.log(`🔍 Consultando guía Copetran (GET): ${numeroGuia}`);

    // Paso 1: Obtener la página inicial para establecer sesión
    const sessionResponse = await axios.get(
      'https://autogestion.copetran.com.co/gestion_2/Forms/trakingRemesas.php',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        }
      }
    );

    const cookies = sessionResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';

    console.log('✅ Sesión establecida');

    // Paso 2: Hacer la consulta de la guía
    const formData = new URLSearchParams({
      'PR00': numeroGuia,
      'Archivo': 'Remesas',
      'Clase': 'Remesas',
      'Funcion': 'trakingRemesas',
      'PR20': '',
      'PR01': 'true',
      'Boton': 'Boton'
    });

    const response = await axios.post(
      'https://autogestion.copetran.com.co/gestion_2/controller/controlador.php',
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString,
          'Referer': 'https://autogestion.copetran.com.co/gestion_2/Forms/trakingRemesas.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        },
        timeout: 15000
      }
    );

    console.log('✅ Respuesta recibida de Copetran');

    const htmlContent = response.data || '';
    const lowerHtml = htmlContent.toLowerCase();
    const noResultPhrases = [
      'no se encontraron',
      'no se encontraron remesas',
      'no existe remesa',
      'la remesa consultada no existe',
      'remesa consultada no existe',
      'la remesa consultada',
      'no se encontro',
      'no hay registros',
      'sin resultados',
    ];

    const hasNoResults = noResultPhrases.some((p) => lowerHtml.includes(p));

    if (hasNoResults) {
      console.log('⚠️ Copetran devolvió página sin resultados');
      return res.status(404).json({
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: numeroGuia,
      });
    }

    // Guardar en BD si el pedido existe
    try {
      const [pedidos] = await pool.query(
        'SELECT id FROM pedidos WHERE numero_guia = ?',
        [numeroGuia]
      );

      if (pedidos.length > 0) {
        // Actualizar estado del pedido en BD (parsear HTML aquí si es necesario)
        console.log(`📝 Actualizando estado en BD para guía ${numeroGuia}`);
        // TODO: Parsear HTML y actualizar estados_pedido
      }
    } catch (dbError) {
      console.error('Error al actualizar BD:', dbError.message);
      // No fallar la petición si hay error en BD
    }

    // Retornar el HTML completo para que el cliente lo parsee
    res.json({
      success: true,
      html: htmlContent,
      numeroGuia: numeroGuia
    });

  } catch (error) {
    console.error('❌ Error:', error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Tiempo de espera agotado al consultar Copetran'
      });
    }

    if (error.response) {
      return res.status(error.response.status).json({
        error: `Error del servidor de Copetran: ${error.response.status}`
      });
    }

    res.status(500).json({
      error: 'Error al consultar la guía',
      details: error.message
    });
  }
});

// ============================================================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ============================================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ============================================================================
// INICIAR SERVIDOR
// ============================================================================

app.listen(PORT, async () => {
  await verificarConexion();

  console.log(`
╔════════════════════════════════════════════════════════════╗
║   🚚 BUCACLÍNICOS EN RUTA - API SERVER                     ║
║   ✅ Servidor corriendo en puerto ${PORT}                     ║
║   🗄️  Base de datos: ${dbConfig.database}                    ║
║                                                            ║
║   📡 ENDPOINTS DISPONIBLES:                                ║
║                                                            ║
║   GENERAL:                                                 ║
║      GET  /health                                          ║
║                                                            ║
║   AUTENTICACIÓN:                                           ║
║      POST /api/auth/login                                  ║
║      POST /api/auth/register                               ║
║                                                            ║
║   USUARIOS:                                                ║
║      GET  /api/usuarios/:id                                ║
║      PUT  /api/usuarios/:id/fcm-token                      ║
║      GET  /api/vendedores/:id/clientes                     ║
║                                                            ║
║   PEDIDOS:                                                 ║
║      GET  /api/pedidos                                     ║
║      GET  /api/pedidos/:id                                 ║
║      POST /api/pedidos                                     ║
║      PUT  /api/pedidos/:id/estado                          ║
║                                                            ║
║   CÓDIGOS QR:                                              ║
║      POST /api/qr/validar                                  ║
║                                                            ║
║   NOTIFICACIONES:                                          ║
║      GET  /api/notificaciones/:usuario_id                  ║
║      PUT  /api/notificaciones/:id/leer                     ║
║                                                            ║
║   ESTADÍSTICAS:                                            ║
║      GET  /api/stats/admin                                 ║
║      GET  /api/stats/vendedor/:id                          ║
║                                                            ║
║   RASTREO:                                                 ║
║      POST /api/rastrear-guia                               ║
║      GET  /api/rastrear-guia/:numero                       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});
