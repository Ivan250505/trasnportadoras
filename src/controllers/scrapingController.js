const { pool } = require('../config/database');
const { 
  rastrearGuiaCopetran, 
  rastrearGuiaTransmoralar 
} = require('../services/scrapingService');

/**
 * Rastrear guía de cualquier transportadora
 */
async function rastrearGuia(req, res) {
  try {
    // Extraer parámetros
    const transportadora = (req.params.transportadora || req.body.transportadora || 'copetran').toLowerCase();
    const numeroGuia = req.params.numero || req.body.numeroGuia || req.query.numero;

    console.log('📦 Parámetros recibidos:', {
      transportadora,
      numeroGuia,
      params: req.params,
      body: req.body,
      query: req.query
    });

    if (!numeroGuia) {
      return res.status(400).json({ 
        error: 'Número de guía es requerido',
        recibido: {
          params: req.params,
          body: req.body
        }
      });
    }

    let resultado;

    // Seleccionar función según transportadora
    switch(transportadora) {
      case 'copetran':
        resultado = await rastrearGuiaCopetran(numeroGuia);
        break;
      
      case 'transmoralar':
        resultado = await rastrearGuiaTransmoralar(numeroGuia);
        break;
      
      default:
        return res.status(400).json({
          error: 'Transportadora no soportada',
          transportadorasDisponibles: ['copetran', 'transmoralar']
        });
    }

    if (!resultado.success) {
      return res.status(resultado.error.includes('no se encontraron') ? 404 : 500).json(resultado);
    }

    // Intentar actualizar en BD si el pedido existe
    try {
      const [pedidos] = await pool.query(
        'SELECT id FROM pedidos WHERE numero_guia = ?',
        [numeroGuia]
      );

      if (pedidos.length > 0) {
        console.log(`📝 Actualizando estado en BD para guía ${numeroGuia}`);
        // TODO: Parsear contenido y actualizar estados_pedido
      }
    } catch (dbError) {
      console.error('Error al actualizar BD:', dbError.message);
      // No fallar la petición si hay error en BD
    }

    res.json(resultado);
  } catch (error) {
    console.error('Error en rastrearGuia:', error);
    res.status(500).json({
      error: 'Error al consultar la guía',
      details: error.message
    });
  }
}

module.exports = {
  rastrearGuia
};