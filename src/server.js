const app = require('./app');
const { PORT, DB_CONFIG } = require('./config/env');
const { verificarConexion } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');

// ============================================================================
// INICIALIZAR SERVICIOS
// ============================================================================

async function iniciarServidor() {
  // Inicializar Firebase
  initializeFirebase();

  // Verificar conexión a base de datos
  await verificarConexion();

  // Iniciar servidor HTTP
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║   🚚 BUCACLÍNICOS EN RUTA - API SERVER                     ║
║   ✅ Servidor corriendo en puerto ${PORT}                     ║
║   🗄️  Base de datos: ${DB_CONFIG.database}                    ║
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
║      GET  /api/usuarios/vendedores/:id/clientes            ║
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
}

// Iniciar servidor
iniciarServidor().catch(error => {
  console.error('❌ Error al iniciar el servidor:', error);
  process.exit(1);
});
