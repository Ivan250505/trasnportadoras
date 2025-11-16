const mysql = require('mysql2/promise');
const { DB_CONFIG } = require('./env');

// Crear pool de conexiones
const pool = mysql.createPool(DB_CONFIG);

// Verificar conexión al iniciar
async function verificarConexion() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión exitosa a MySQL - Base de datos: ' + DB_CONFIG.database);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    console.error('   Verifica que XAMPP esté corriendo y la BD exista');
    return false;
  }
}

module.exports = {
  pool,
  verificarConexion
};
