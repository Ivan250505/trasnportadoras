const { JERARQUIA_ESTADOS, ESTADOS_PEDIDO } = require('../utils/constants');

/**
 * Valida que un cambio de estado sea válido (no retroceso)
 */
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

/**
 * Middleware para validar datos requeridos en el body
 */
function validateRequired(fields) {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Datos incompletos',
        camposFaltantes: missing
      });
    }

    next();
  };
}

/**
 * Middleware para validar formato de email
 */
function validateEmail(req, res, next) {
  const { email } = req.body;

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }
  }

  next();
}

/**
 * Middleware para validar que el estado sea válido
 */
function validateEstado(req, res, next) {
  const { nuevo_estado } = req.body;

  if (nuevo_estado && !Object.values(ESTADOS_PEDIDO).includes(nuevo_estado)) {
    return res.status(400).json({
      error: 'Estado inválido',
      estadosValidos: Object.values(ESTADOS_PEDIDO)
    });
  }

  next();
}

module.exports = {
  validarCambioEstado,
  validateRequired,
  validateEmail,
  validateEstado
};
