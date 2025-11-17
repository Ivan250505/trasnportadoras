const axios = require('axios');
const cheerio = require('cheerio');
const pdfParse = require('pdf-parse');
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
      responseType: 'arraybuffer', // ⚠️ IMPORTANTE: obtener como buffer
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
      // Parsear el PDF y extraer texto
      console.log('📖 Extrayendo texto del PDF...');
      const pdfData = await pdfParse(buffer);
      textContent = pdfData.text;
      console.log(`✅ Texto extraído: ${textContent.length} caracteres`);
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
      html: textContent, // Enviar el texto extraído como "html"
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

/**
 * Extrae TODOS los datos del texto extraído del PDF de Transmoralar
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

    // Limpiar el texto
    const textoLimpio = texto.replace(/\r/g, '').trim();
    
    // Extraer número de guía (buscar secuencia de 10+ dígitos)
    const guiaMatch = textoLimpio.match(/Guia\s*#?\s*(\d{10,})/i) || 
                      textoLimpio.match(/(\d{10,})/);
    if (guiaMatch) {
      datos.numeroGuia = guiaMatch[1];
      console.log('✅ Guía encontrada:', datos.numeroGuia);
    }

    // Extraer ORIGEN (después de "Origen :" hasta el siguiente campo)
    const origenMatch = textoLimpio.match(/Origen\s*:?\s*([^\n]+)/i);
    if (origenMatch) {
      datos.remitente.origen = origenMatch[1].trim();
      console.log('✅ Origen:', datos.remitente.origen);
    }

    // Extraer DESTINO
    const destinoMatch = textoLimpio.match(/Destino\s*:?\s*([^\n]+)/i);
    if (destinoMatch) {
      datos.destinatario.destino = destinoMatch[1].trim();
      console.log('✅ Destino:', datos.destinatario.destino);
    }

    // Extraer UNIDAD
    const unidadMatch = textoLimpio.match(/Unidad\s*:?\s*([^\n]+)/i);
    if (unidadMatch) {
      datos.destinatario.unidad = unidadMatch[1].trim();
      console.log('✅ Unidad:', datos.destinatario.unidad);
    }

    // Extraer nombres (hay dos secciones de "Nombre:")
    const nombresMatch = textoLimpio.matchAll(/Nombre\s*:?\s*([^\n]+)/gi);
    const nombres = Array.from(nombresMatch).map(m => m[1].trim());
    
    if (nombres.length >= 1) {
      datos.remitente.nombre = nombres[0];
      console.log('✅ Remitente:', datos.remitente.nombre);
    }
    if (nombres.length >= 2) {
      datos.destinatario.nombre = nombres[1];
      console.log('✅ Destinatario:', datos.destinatario.nombre);
    }

    // Extraer ESTADO principal (buscar después de "ESTADO")
    const estadoMatch = textoLimpio.match(/ESTADO\s*\n\s*([A-Z\s]+)/);
    if (estadoMatch) {
      datos.estadoActual = estadoMatch[1].trim();
      console.log('✅ Estado actual:', datos.estadoActual);
    }

    // Extraer HISTORIAL completo
    // Patrón: ESTADO + FECHA (YYYY/MM/DD HH.MM AM/PM) + posibles detalles
    const historialRegex = /([A-Z][A-Z\s]{5,})\s*(\d{4}\/\d{2}\/\d{2}\s+\d{2}\.\d{2}\s+(?:AM|PM))/g;
    let match;
    
    while ((match = historialRegex.exec(textoLimpio)) !== null) {
      const estado = match[1].trim();
      const fecha = match[2].trim();
      
      // Filtrar estados válidos
      if (estado.length > 5 && !estado.includes('TRANSMORALAR')) {
        datos.historial.push({
          estado: estado,
          fecha: fecha,
          detalles: ''
        });
        console.log(`📝 Estado añadido: ${estado} - ${fecha}`);
      }
    }

    // Buscar detalles adicionales (nombres, placas, bodegas)
    // Estos suelen aparecer en líneas después de cada estado
    const lineas = textoLimpio.split('\n').filter(l => l.trim().length > 0);
    
    for (let i = 0; i < lineas.length && i < datos.historial.length * 3; i++) {
      const linea = lineas[i].trim();
      
      // Buscar nombres de personas (generalmente en MAYÚSCULAS)
      if (/^[A-Z\s]{10,}$/.test(linea) && !linea.includes('ESTADO')) {
        // Asignar a historial si hay espacio
        const indexHistorial = Math.floor(i / 3);
        if (indexHistorial < datos.historial.length) {
          if (!datos.historial[indexHistorial].detalles) {
            datos.historial[indexHistorial].detalles = linea;
          }
        }
      }
      
      // Buscar placas de vehículos (XXX000)
      const placaMatch = linea.match(/([A-Z]{3}\d{3})/);
      if (placaMatch) {
        const indexHistorial = Math.floor(i / 3);
        if (indexHistorial < datos.historial.length) {
          if (datos.historial[indexHistorial].detalles) {
            datos.historial[indexHistorial].detalles += ` - ${placaMatch[1]}`;
          } else {
            datos.historial[indexHistorial].detalles = `Vehículo: ${placaMatch[1]}`;
          }
        }
      }
    }

    // Si hay historial, el último estado es el actual
    if (datos.historial.length > 0) {
      const ultimoEstado = datos.historial[datos.historial.length - 1];
      datos.estadoActual = ultimoEstado.estado;
      datos.fechaCreacion = ultimoEstado.fecha;
      console.log(`✅ ${datos.historial.length} estados en el historial`);
    }

    // Si no se encontró estado, buscar palabras clave
    if (!datos.estadoActual || datos.estadoActual === '') {
      const estadosComunes = [
        'ENTREGADA', 'ENTREGADA SIN CUMPLIDO', 'EN TRANSPORTE', 'EN BODEGA', 
        'DIGITADA', 'CARGADA EN VEHICULO', 'EN TRANSPORTE URBANO', 
        'EN TRANSPORTE NACIONAL'
      ];
      
      for (const estadoComun of estadosComunes) {
        if (textoLimpio.includes(estadoComun)) {
          datos.estadoActual = estadoComun;
          console.log('✅ Estado encontrado por búsqueda:', estadoComun);
          break;
        }
      }
    }

    // Fallback final
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

// Exportar funciones
module.exports = {
  rastrearGuiaCopetran,
  rastrearGuiaTransmoralar
};