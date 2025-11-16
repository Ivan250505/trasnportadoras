const axios = require('axios');
const { SCRAPING_TIMEOUT } = require('../config/env');

/**
 * Consulta el rastreo de una guía en Copetran
 */
async function rastrearGuiaCopetran(numeroGuia) {
  try {
    console.log(`🔍 Consultando guía Copetran: ${numeroGuia}`);

    // Paso 1: Obtener la página inicial para establecer sesión
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

    // Paso 2: Hacer la consulta de la guía
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
 * Consulta el rastreo de una guía en Transmoralar
 */
async function rastrearGuiaTransmoralar(numeroGuia) {
  try {
    console.log(`🔍 Consultando guía Transmoralar: ${numeroGuia}`);

    // URL del rastreo de Transmoralar
    const url = `https://transmoralar.softwareparati.com/assets/trace.html?nombre=ENC010&P_PEDIDO=${numeroGuia}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: SCRAPING_TIMEOUT,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    });

    console.log('✅ Respuesta recibida de Transmoralar');

    const htmlContent = response.data || '';
    const lowerHtml = htmlContent.toLowerCase();

    // Verificar si hay contenido válido
    const hasNoResults = 
      htmlContent.length < 100 || 
      lowerHtml.includes('no se encontr') ||
      lowerHtml.includes('sin resultados') ||
      lowerHtml.includes('no existe');

    if (hasNoResults) {
      console.log('⚠️ Transmoralar devolvió página sin resultados');
      return {
        success: false,
        error: 'No se encontraron datos para esta guía',
        numeroGuia: numeroGuia,
        transportadora: 'transmoralar'
      };
    }

    // Intentar extraer datos estructurados del HTML
    const datosExtraidos = extraerDatosTransmoralar(htmlContent);

    return {
      success: true,
      html: htmlContent,
      numeroGuia: numeroGuia,
      transportadora: 'transmoralar',
      tipo: 'html',
      url: url,
      datos: datosExtraidos
    };

  } catch (error) {
    console.error('❌ Error Transmoralar:', error.message);

    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        error: 'Tiempo de espera agotado al consultar Transmoralar'
      };
    }

    if (error.response) {
      return {
        success: false,
        error: `Error del servidor de Transmoralar: ${error.response.status}`
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
 * Extrae datos estructurados del HTML de Transmoralar
 */
function extraerDatosTransmoralar(html) {
  const datos = {
    remitente: '',
    destinatario: '',
    origen: '',
    destino: '',
    estado: '',
    fecha: '',
    observaciones: ''
  };

  try {
    // Expresiones regulares para extraer información
    const patterns = {
      remitente: /remitente[:\s]+([^<\n]+)/i,
      destinatario: /destinatario[:\s]+([^<\n]+)/i,
      origen: /origen[:\s]+([^<\n]+)/i,
      destino: /destino[:\s]+([^<\n]+)/i,
      estado: /estado[:\s]+([^<\n]+)/i,
      fecha: /fecha[:\s]+([^<\n]+)/i
    };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = html.match(pattern);
      if (match && match[1]) {
        datos[key] = match[1].trim();
      }
    }
  } catch (error) {
    console.error('Error al extraer datos:', error.message);
  }

  return datos;
}