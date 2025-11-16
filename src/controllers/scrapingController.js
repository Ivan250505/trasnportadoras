const { pool } = require('../config/database');
const { rastrearGuiaCopetran } = require('../services/scrapingService');

/**
 * Rastrear guía de Copetran
 */
async function rastrearGuia(req, res) {
  try {
    const numeroGuia = req.body.numeroGuia || req.params.numero;

    if (!numeroGuia) {
      return res.status(400).json({ error: 'Número de guía es requerido' });
    }

    // Consultar Copetran
    const resultado = await rastrearGuiaCopetran(numeroGuia);

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
        // TODO: Parsear HTML y actualizar estados_pedido
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
