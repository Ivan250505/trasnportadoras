const axios = require('axios');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse'); // ✅ Importación simple y directa
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
 * Consulta el rastreo de una guía en Transmoralar - EXTRAE DATOS DEL PDF
 */
async function rastrearGuiaTransmoralar(numeroGuia) {
  try {
    const guiaLimpia = numeroGuia.toString().trim();
    console.log(`🔍 Consultando guía Transmoralar: ${guiaLimpia}`);

    const baseUrl = 'https://transmoralar.softwareparati.com';
    const reportUrl = `${baseUrl}/reporte?nombre=ENC010&P_PEDIDO=${guiaLimpia}`;
    
    console.log(`📡 Consultando URL: ${reportUrl}`);
    
    // Obtener el PDF como buffer
    const response = await axios.get(reportUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/pdf,text/html,*/*',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
      },
      responseType: 'arraybuffer',
      timeout: SCRAPING_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500
    });

    console.log(`✅ Respuesta recibida (${response.status})`);

    if (!response.data || response.data.length < 100) {
      console.log('⚠️ Contenido vacío o muy corto');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    // Verificar si es un PDF
    const buffer = Buffer.from(response.data);
    const isPDF = buffer.toString('utf8', 0, 5) === '%PDF-';

    console.log(`📄 Tipo de contenido: ${isPDF ? 'PDF' : 'Otro'}`);

    let textContent = '';

    if (isPDF) {
      console.log('📖 Extrayendo texto del PDF...');
      
      try {
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;
        console.log(`✅ Texto extraído: ${textContent.length} caracteres`);
      } catch (pdfError) {
        console.error('❌ Error al parsear PDF:', pdfError);
        return {
          success: false,
          error: 'Error al extraer información del PDF',
          numeroGuia: guiaLimpia,
          transportadora: 'transmoralar',
          details: pdfError.message
        };
      }
    } else {
      // Si no es PDF, intentar como HTML
      textContent = buffer.toString('utf8');
    }

    if (!textContent || textContent.length < 50) {
      console.log('⚠️ Texto extraído vacío');
      return {
        success: false,
        error: 'No se pudo extraer información del documento',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    // Extraer TODOS los datos del texto
    const datosCompletos = extraerDatosDesdeTextoTransmoralar(textContent, guiaLimpia);

    console.log('📊 Datos extraídos:', JSON.stringify(datosCompletos, null, 2));

    // Verificar si tiene datos válidos
    if (!datosCompletos.estadoActual || datosCompletos.estadoActual === 'DESCONOCIDO') {
      console.log('⚠️ No se encontraron datos válidos');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: guiaLimpia,
        transportadora: 'transmoralar'
      };
    }

    return {
      success: true,
      html: textContent,
      numeroGuia: guiaLimpia,
      transportadora: 'transmoralar',
      tipo: 'pdf',
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

/** */
function organizarEstadosTransmoralar(historial) {
  // Etapas importantes en el orden del proceso de envío
  const etapasImportantes = [
    'DIGITADA',
    'EN BODEGA',
    'CARGADA EN VEHICULO',
    'EN TRANSPORTE NACIONAL',
    'GIRON BODEGA', // Bodega destino
    'EN TRANSPORTE URBANO',
    'ENTREGADA',
    'ENTREGADA SIN CUMPLIDO'
  ];

  // Normalizar nombres de estados
  const normalizarEstado = (estado) => {
    const estadoUpper = estado.toUpperCase().trim();
    
    // Mapear variaciones al nombre estándar
    // ✅ IMPORTANTE: Verificar "SIN CÑUMPLIDO" ANTES de solo "ENTREGADA"
    if (estadoUpper.includes('DIGIT')) return 'DIGITADA';
    if (estadoUpper.includes('BODEGA') && estadoUpper.includes('GIRON')) return 'GIRON BODEGA';
    if (estadoUpper.includes('BODEGA')) return 'EN BODEGA';
    if (estadoUpper.includes('CARGADA') && estadoUpper.includes('VEHICULO')) return 'CARGADA EN VEHICULO';
    if (estadoUpper.includes('TRANSPORTE NACIONAL')) return 'EN TRANSPORTE NACIONAL';
    if (estadoUpper.includes('TRANSPORTE URBANO')) return 'EN TRANSPORTE URBANO';
    if (estadoUpper.includes('SIN CUMPLIDO') || estadoUpper.includes('ENTREGADA SIN CUMPLIDO')) return 'ENTREGADA SIN CUMPLIDO'; // ✅ PRIMERO
    if (estadoUpper.includes('ENTREGADA')) return 'ENTREGADA'; // ✅ DESPUÉS
    
    return estadoUpper;
  };

  // Filtrar y organizar historial
  const historialFiltrado = [];
  const estadosVistos = new Set();

  for (const item of historial) {
    const estadoNormalizado = normalizarEstado(item.estado);
    
    // Solo agregar si es una etapa importante y no se ha visto antes
    if (etapasImportantes.includes(estadoNormalizado) && !estadosVistos.has(estadoNormalizado)) {
      historialFiltrado.push({
        estado: estadoNormalizado,
        fecha: item.fecha,
        detalles: item.detalles || ''
      });
      estadosVistos.add(estadoNormalizado);
    }
  }

  return historialFiltrado;
}
/**
 * Obtiene un ícono representativo para cada estado
 */
function obtenerIconoEstado(estado) {
  const iconos = {
    'DIGITADA': '📝',
    'EN BODEGA': '📦',
    'CARGADA EN VEHICULO': '🚛',
    'EN TRANSPORTE NACIONAL': '🚚',
    'GIRON BODEGA': '🏢',
    'EN TRANSPORTE URBANO': '🚐',
    'ENTREGADA': '✅',
    'ENTREGADA SIN CUMPLIDO': '📦✓'
  };
  
  return iconos[estado] || '📍';
}

/**
 * Obtiene una descripción amigable para cada estado
 */
function obtenerDescripcionEstado(estado) {
  const descripciones = {
    'DIGITADA': 'Pedido registrado en el sistema',
    'EN BODEGA': 'En bodega de origen',
    'CARGADA EN VEHICULO': 'Cargada para transporte',
    'EN TRANSPORTE NACIONAL': 'En ruta hacia destino',
    'GIRON BODEGA': 'Llegó a bodega de destino',
    'EN TRANSPORTE URBANO': 'En reparto local',
    'ENTREGADA': 'Entregada exitosamente',
    'ENTREGADA SIN CUMPLIDO': 'Entregada sin firma'
  };
  
  return descripciones[estado] || estado;
}

/**
 * Agrega esta función DENTRO de tu scrapingService.js
 * ANTES de la función extraerDatosDesdeTextoTransmoralar
 */

function extraerDatosDesdeTextoTransmoralar(texto, numeroGuia) {
  const datos = {
    numeroGuia: numeroGuia,
    remitente: {
      nombre: '',
      origen: '',
      direccion: ''
    },
    destinatario: {
      nombre: '',
      destino: '',
      direccion: '',
      unidad: ''
    },
    estadoActual: '',
    historial: [],
    fechaCreacion: '',
    horaCreacion: ''
  };

  try {
    console.log('🔍 Analizando texto...');

    const textoLimpio = texto.replace(/\r/g, '').trim();
    
    // [... código de extracción existente ...]
    
    // Extraer ORIGEN
    const origenMatch = textoLimpio.match(/Origen\s*:?\s*([^\n]+)/i);
    if (origenMatch) {
      datos.remitente.origen = origenMatch[1].trim();
    }

    // Extraer DESTINO
    const destinoMatch = textoLimpio.match(/Destino\s*:?\s*([^\n]+)/i);
    if (destinoMatch) {
      datos.destinatario.destino = destinoMatch[1].trim();
    }

    // Extraer UNIDAD
    const unidadMatch = textoLimpio.match(/Unidad\s*:?\s*([^\n]+)/i);
    if (unidadMatch) {
      datos.destinatario.unidad = unidadMatch[1].trim();
    }

    // Extraer nombres
    const nombresMatch = textoLimpio.matchAll(/Nombre\s*:?\s*([^\n]+)/gi);
    const nombres = Array.from(nombresMatch).map(m => m[1].trim());
    
    if (nombres.length >= 1) {
      datos.remitente.nombre = nombres[0];
    }
    if (nombres.length >= 2) {
      datos.destinatario.nombre = nombres[1];
    }

    // Extraer HISTORIAL completo
    const historialRegex = /([A-Z][A-Z\s]{5,})\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}\.\d{2}\s+(?:AM|PM))/g;
    let match;
    
    while ((match = historialRegex.exec(textoLimpio)) !== null) {
      const estado = match[1].trim();
      const fecha = match[2].trim();
      
      if (estado.length > 5 && !estado.includes('TRANSMORALAR')) {
        datos.historial.push({
          estado: estado,
          fecha: fecha,
          detalles: ''
        });
      }
    }

    // ✅ ORGANIZAR HISTORIAL - Solo mostrar etapas importantes
    datos.historial = organizarEstadosTransmoralar(datos.historial);

    // El último estado es el actual
    if (datos.historial.length > 0) {
      const ultimoEstado = datos.historial[datos.historial.length - 1];
      datos.estadoActual = ultimoEstado.estado;
      datos.fechaCreacion = ultimoEstado.fecha;
      
      // Agregar información adicional al estado actual
      datos.estadoActualIcono = obtenerIconoEstado(ultimoEstado.estado);
      datos.estadoActualDescripcion = obtenerDescripcionEstado(ultimoEstado.estado);
    }

    // Fallback si no hay historial
    if (!datos.estadoActual || datos.estadoActual === '') {
      datos.estadoActual = 'CONSULTADO';
    }

    console.log('✅ Extracción completada:', {
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

module.exports = {
  rastrearGuiaCopetran,
  rastrearGuiaTransmoralar,
  organizarEstadosTransmoralar,
  obtenerIconoEstado,
  obtenerDescripcionEstado,
  extraerDatosDesdeTextoTransmoralar
};