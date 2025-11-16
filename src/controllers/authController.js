const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS } = require('../config/env');

/**
 * Login de usuario
 */
async function login(req, res) {
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
      { expiresIn: JWT_EXPIRES_IN }
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
}

/**
 * Registro de nuevo usuario (solo clientes)
 */
async function register(req, res) {
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
    // TODO: En producción usar: const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

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
}

module.exports = {
  login,
  register
};
