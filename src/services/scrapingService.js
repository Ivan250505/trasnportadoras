const axios = require('axios');
const cheerio = require('cheerio');
const { SCRAPING_TIMEOUT } = require('../config/env');

/**
 * Consulta el rastreo de una guía en Copetran
 */
async function rastrearGuiaCopetran(numeroGuia) {
  try {
    console.log(`🔍 Consultando guía Copetran: ${numeroGuia}`);

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
        timeout: SCRAPING_TIMEOUT
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
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: numeroGuia,
        transportadora: 'copetran'
      };
    }

    return {
      success: true,
      html: htmlContent,
      numeroGuia: numeroGuia,
      transportadora: 'copetran',
      tipo: 'html'
    };

  } catch (error) {
    console.error('❌ Error Copetran:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al consultar Copetran'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: `Error del servidor de Copetran: ${error.response.status}`
      };
    }

    return {
      success: false,
      error: 'Error al consultar la guía',
      details: error.message
    };
  }
}

/**
 * Consulta el rastreo de una guía en Transmoralar - VERSIÓN COMPLETA
 */
async function rastrearGuiaTransmoralar(numeroGuia) {
  try {
    const guiaLimpia = numeroGuia.toString().trim();
    console.log(`🔍 Consultando guía Transmoralar: ${guiaLimpia}`);

    const baseUrl = 'https://transmoralar.softwareparati.com';
    
    // Paso 1: Intentar obtener el reporte directamente
    const reportUrl = `${baseUrl}/reporte?nombre=ENC010&P_PEDIDO=${guiaLimpia}`;
    
    console.log(`📡 Consultando URL: ${reportUrl}`);
    
    const response = await axios.get(reportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      },
      timeout: SCRAPING_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500
    });

    console.log(`✅ Respuesta recibida (${response.status})`);

    const htmlContent = response.data || '';
    
    if (!htmlContent || htmlContent.length < 100) {
      console.log('⚠️ Contenido HTML vacío o muy corto');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    // Extraer TODOS los datos con Cheerio
    const datosCompletos = extraerDatosCompletosTransmoralar(htmlContent, guiaLimpia);

    console.log('📊 Datos extraídos:', JSON.stringify(datosCompletos, null, 2));

    // Verificar si tiene datos válidos
    if (!datosCompletos.estadoActual || datosCompletos.estadoActual === 'DESCONOCIDO') {
      console.log('⚠️ No se encontraron datos válidos en el HTML');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    return {
      success: true,
      html: htmlContent,
      numeroGuia: guiaLimpia,
      transportadora: 'transmoralar',
      tipo: 'html',
      url: reportUrl,
      datos: datosCompletos
    };

  } catch (error) {
    console.error('❌ Error Transmoralar:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al consultar Transmoralar',
        numeroGuia: numeroGuia.toString().trim(),
        transportadora: 'transmoralar'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: `Error del servidor de Transmoralar: ${error.response.status}`,
        numeroGuia: numeroGuia.toString().trim(),
        transportadora: 'transmoralar'
      };
    }

    return {
      success: false,
      error: 'Error al consultar la guía',
      details: error.message,
      numeroGuia: numeroGuia.toString().trim(),
      transportadora: 'transmoralar'
    };
  }
}

/**
 * Extrae TODOS los datos del HTML de Transmoralar usando Cheerio
 */
function extraerDatosCompletosTransmoralar(html, numeroGuia) {
  const $ = cheerio.load(html);
  
  const datos = {
    numeroGuia: numeroGuia,
    // Datos del remitente
    remitente: {
      nombre: '',
      origen: '',
      direccion: ''
    },
    // Datos del destinatario
    destinatario: {
      nombre: '',
      destino: '',
      direccion: '',
      unidad: ''
    },
    // Estado actual
    estadoActual: '',
    // Historial completo de estados (timeline)
    historial: [],
    // Datos adicionales
    fechaCreacion: '',
    horaCreacion: ''
  };

  try {
    // Extraer texto limpio del body
    const bodyText = $('body').text();
    const lines = bodyText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    console.log('📄 Líneas encontradas:', lines.length);

    // Buscar número de guía
    const guiaMatch = bodyText.match(/(\d{10,})/);
    if (guiaMatch) {
      datos.numeroGuia = guiaMatch[1];
    }

    // Extraer origen y destino
    const origenMatch = bodyText.match(/Origen\s*:?\s*([^\n]+)/i);
    if (origenMatch) {
      datos.remitente.origen = origenMatch[1].trim();
    }

    const destinoMatch = bodyText.match(/Destino\s*:?\s*([^\n]+)/i);
    if (destinoMatch) {
      datos.destinatario.destino = destinoMatch[1].trim();
    }

    // Extraer nombres
    const nombreRemitenteMatch = bodyText.match(/Nombre\s*:?\s*([^\n]+?)(?=Unidad|Nombre:|$)/i);
    if (nombreRemitenteMatch) {
      datos.remitente.nombre = nombreRemitenteMatch[1].trim();
    }

    // Buscar todos los nombres después de "Datos destinatario"
    const datosDestinatarioIndex = bodyText.indexOf('Datos destinatario');
    if (datosDestinatarioIndex > -1) {
      const despuesDestinatario = bodyText.substring(datosDestinatarioIndex);
      const nombreDestMatch = despuesDestinatario.match(/Nombre\s*:?\s*([^\n]+)/i);
      if (nombreDestMatch) {
        datos.destinatario.nombre = nombreDestMatch[1].trim();
      }
    }

    // Extraer unidad
    const unidadMatch = bodyText.match(/Unidad\s*:?\s*([^\n]+)/i);
    if (unidadMatch) {
      datos.destinatario.unidad = unidadMatch[1].trim();
    }

    // Extraer ESTADO principal (el más reciente/importante)
    const estadoMatch = bodyText.match(/ESTADO\s*\n\s*([A-Z\s]+)/);
    if (estadoMatch) {
      datos.estadoActual = estadoMatch[1].trim();
    }

    // Extraer HISTORIAL completo de estados con fechas
    const estadoRegex = /([A-Z\s]{3,})\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}\.\d{2}\s+(?:AM|PM))/g;
    let match;
    
    while ((match = estadoRegex.exec(bodyText)) !== null) {
      const estado = match[1].trim();
      const fecha = match[2].trim();
      
      // Filtrar estados válidos (no palabras sueltas)
      if (estado.length > 3 && !estado.includes('TRANSMORALAR')) {
        datos.historial.push({
          estado: estado,
          fecha: fecha,
          detalles: ''
        });
      }
    }

    // Extraer detalles adicionales de cada estado (nombres de conductores, vehículos, etc)
    const detallesRegex = /([A-Z\s]{10,})\s*\n\s*([A-Z\s]+(?:[A-Z]+\s*)+)/g;
    let detalleMatch;
    let detalleIndex = 0;
    
    while ((detalleMatch = detallesRegex.exec(bodyText)) !== null && detalleIndex < datos.historial.length) {
      const detalle = detalleMatch[2].trim();
      if (detalle && detalle.length > 3) {
        datos.historial[detalleIndex].detalles = detalle;
        detalleIndex++;
      }
    }

    // Buscar vehículos (placas)
    const vehiculoMatches = bodyText.matchAll(/([A-Z]{3}\d{3})/g);
    let vehiculoIndex = 0;
    for (const vehiculoMatch of vehiculoMatches) {
      if (vehiculoIndex < datos.historial.length) {
        if (datos.historial[vehiculoIndex].detalles) {
          datos.historial[vehiculoIndex].detalles += ` - Vehículo: ${vehiculoMatch[1]}`;
        } else {
          datos.historial[vehiculoIndex].detalles = `Vehículo: ${vehiculoMatch[1]}`;
        }
        vehiculoIndex++;
      }
    }

    // Si encontramos historial, el estado actual es el último
    if (datos.historial.length > 0) {
      const ultimoEstado = datos.historial[datos.historial.length - 1];
      datos.estadoActual = ultimoEstado.estado;
      datos.fechaCreacion = ultimoEstado.fecha;
    }

    // Si no se encontró estado, buscar más agresivamente
    if (!datos.estadoActual || datos.estadoActual === '') {
      const estadosComunes = [
        'ENTREGADA', 'EN TRANSPORTE', 'EN BODEGA', 'DIGITADA',
        'CARGADA EN VEHICULO', 'EN TRANSPORTE URBANO', 'EN TRANSPORTE NACIONAL'
      ];
      
      for (const estadoComun of estadosComunes) {
        if (bodyText.includes(estadoComun)) {
          datos.estadoActual = estadoComun;
          break;
        }
      }
    }

    // Fallback: si aún no hay estado pero hay contenido
    if ((!datos.estadoActual || datos.estadoActual === '') && bodyText.length > 200) {
      datos.estadoActual = 'CONSULTADO';
    }

    console.log('✅ Datos estructurados:', {
      tieneEstado: !!datos.estadoActual,
      cantidadHistorial: datos.historial.length,
      tieneRemitente: !!datos.remitente.nombre,
      tieneDestinatario: !!datos.destinatario.nombre
    });

  } catch (error) {
    console.error('❌ Error al extraer datos:', error.message);
    datos.estadoActual = 'ERROR EN EXTRACCIÓN';
  }

  return datos;
}

// Exportar funciones
module.exports = {
  rastrearGuiaCopetran,
  rastrearGuiaTransmoralar
};