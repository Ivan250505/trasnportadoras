const express = require('express');
const cors = require('cors');
const { CORS_ORIGIN } = require('./config/env');
const routes = require('./routes');
const { pool } = require('./config/database');

const app = express();

// ============================================================================
// MIDDLEWARES GLOBALES
// ============================================================================

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// RUTAS DE LA API
// ============================================================================

app.use('/api', routes);

// ============================================================================
// MANEJO DE RUTAS NO ENCONTRADAS (404)
// ============================================================================

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ============================================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message
  });
});

module.exports = app;
