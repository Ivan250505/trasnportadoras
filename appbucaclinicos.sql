-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 16-11-2025 a las 16:42:10
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `appbucaclinicos`
--

DELIMITER $$
--
-- Procedimientos
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_generar_codigo_qr` (OUT `nuevo_codigo` VARCHAR(50))   BEGIN
    DECLARE contador INT;

    -- Obtener y actualizar contador
    SELECT CAST(valor AS UNSIGNED) INTO contador FROM configuracion WHERE clave = 'contador_qr';
    SET contador = contador + 1;
    UPDATE configuracion SET valor = contador WHERE clave = 'contador_qr';

    -- Generar código con formato bucaclinicos_QR_0001
    SET nuevo_codigo = CONCAT('bucaclinicos_QR_', LPAD(contador, 4, '0'));
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_generar_numero_pedido` (OUT `nuevo_numero` VARCHAR(50))   BEGIN
    DECLARE contador INT;

    -- Obtener y actualizar contador
    SELECT CAST(valor AS UNSIGNED) INTO contador FROM configuracion WHERE clave = 'contador_pedido';
    SET contador = contador + 1;
    UPDATE configuracion SET valor = contador WHERE clave = 'contador_pedido';

    -- Generar número con formato BUC-2025-0001
    SET nuevo_numero = CONCAT('BUC-', YEAR(CURDATE()), '-', LPAD(contador, 4, '0'));
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_stats_admin` ()   BEGIN
    SELECT
        COUNT(*) AS total_pedidos,
        SUM(CASE WHEN estado_actual = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado_actual IN ('recibido', 'en_proceso', 'facturado') THEN 1 ELSE 0 END) AS en_proceso,
        SUM(CASE WHEN estado_actual IN ('entregado_transportadora', 'en_transito') THEN 1 ELSE 0 END) AS en_camino,
        SUM(CASE WHEN estado_actual IN ('entregado_cliente', 'confirmado_qr') THEN 1 ELSE 0 END) AS entregados,
        SUM(CASE WHEN confirmado_qr = TRUE THEN 1 ELSE 0 END) AS confirmados_qr
    FROM pedidos;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `codigos_qr`
--

CREATE TABLE `codigos_qr` (
  `id` int(11) NOT NULL,
  `pedido_id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL COMMENT 'Código único (ej: bucaclinicos_QR_0001)',
  `imagen_path` varchar(255) DEFAULT NULL COMMENT 'Ruta de la imagen del QR generado',
  `usado` tinyint(1) DEFAULT 0,
  `fecha_generacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_escaneo` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `codigos_qr`
--

INSERT INTO `codigos_qr` (`id`, `pedido_id`, `codigo`, `imagen_path`, `usado`, `fecha_generacion`, `fecha_escaneo`) VALUES
(1, 1, 'bucaclinicos_QR_0001', NULL, 1, '2025-01-16 16:00:00', '2025-01-17 19:35:00'),
(2, 2, 'bucaclinicos_QR_0002', NULL, 0, '2025-01-19 17:00:00', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `configuracion`
--

CREATE TABLE `configuracion` (
  `id` int(11) NOT NULL,
  `clave` varchar(100) NOT NULL,
  `valor` text NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `configuracion`
--

INSERT INTO `configuracion` (`id`, `clave`, `valor`, `descripcion`, `fecha_actualizacion`) VALUES
(1, 'contador_qr', '2', 'Contador para generar códigos QR únicos', '2025-11-09 19:07:39'),
(2, 'contador_pedido', '5', 'Contador para generar números de pedido internos', '2025-11-09 19:07:39'),
(3, 'tiempo_actualizacion_estados', '3600', 'Tiempo en segundos entre actualizaciones de estados (1 hora)', '2025-11-09 19:07:38'),
(4, 'empresa_nombre', 'Bucaclínicos En Ruta', 'Nombre de la empresa', '2025-11-09 19:07:38'),
(5, 'empresa_ciudad', 'Bucaramanga', 'Ciudad principal de operación', '2025-11-09 19:07:38');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `estados_pedido`
--

CREATE TABLE `estados_pedido` (
  `id` int(11) NOT NULL,
  `pedido_id` int(11) NOT NULL,
  `estado` varchar(100) NOT NULL COMMENT 'Nombre del estado',
  `descripcion` text DEFAULT NULL COMMENT 'Descripción adicional del estado',
  `ubicacion` varchar(200) DEFAULT NULL COMMENT 'Ubicación física del paquete',
  `es_subpaso_transportadora` tinyint(1) DEFAULT 0 COMMENT 'Indica si es un sub-estado de la transportadora',
  `usuario_id` int(11) DEFAULT NULL,
  `origen` enum('manual','automatico','transportadora') DEFAULT 'manual',
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `estados_pedido`
--

INSERT INTO `estados_pedido` (`id`, `pedido_id`, `estado`, `descripcion`, `ubicacion`, `es_subpaso_transportadora`, `usuario_id`, `origen`, `fecha_registro`) VALUES
(1, 1, 'Pendiente', 'Pedido creado por vendedor', NULL, 0, 4, 'manual', '2025-01-15 14:00:00'),
(2, 1, 'Recibido', 'Pedido confirmado por administrador', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-15 15:30:00'),
(3, 1, 'En Proceso', 'Preparando mercancía', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-15 19:00:00'),
(4, 1, 'Facturado', 'Factura generada y adjuntada', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-16 13:00:00'),
(5, 1, 'Entregado a Transportadora', 'Entregado a Copetran - Guía #9999', 'Terminal Bucaramanga', 0, 6, 'manual', '2025-01-16 16:00:00'),
(6, 1, 'En Centro de Distribución Origen', 'Paquete en bodega de origen', 'Terminal Bucaramanga', 1, NULL, 'transportadora', '2025-01-16 17:00:00'),
(7, 1, 'En Camino', 'En tránsito hacia destino', 'Carretera Bucaramanga-Bogotá', 1, NULL, 'transportadora', '2025-01-16 23:00:00'),
(8, 1, 'En Bodega Destino', 'Llegó a bodega de destino', 'Terminal Bogotá', 1, NULL, 'transportadora', '2025-01-17 11:00:00'),
(9, 1, 'En Ruta de Entrega', 'En ruta de entrega final', 'Bogotá - Zona Norte', 1, NULL, 'transportadora', '2025-01-17 15:00:00'),
(10, 1, 'Entregado', 'Entregado al cliente', 'Calle 100 #15-20', 1, NULL, 'transportadora', '2025-01-17 19:30:00'),
(11, 1, 'Confirmado por Cliente (QR)', 'Cliente confirmó recepción escaneando QR', NULL, 0, 1, 'manual', '2025-01-17 19:35:00'),
(12, 2, 'Pendiente', 'Pedido creado por vendedor', NULL, 0, 4, 'manual', '2025-01-18 15:00:00'),
(13, 2, 'Recibido', 'Pedido confirmado', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-18 16:00:00'),
(14, 2, 'En Proceso', 'Preparando envío', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-18 20:00:00'),
(15, 2, 'Facturado', 'Factura generada', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-19 14:00:00'),
(16, 2, 'Entregado a Transportadora', 'Entregado a Copetran - Guía #6666', 'Terminal Bucaramanga', 0, 6, 'manual', '2025-01-19 17:00:00'),
(17, 2, 'En Centro de Distribución Origen', 'Recibido en terminal', 'Terminal Bucaramanga', 1, NULL, 'transportadora', '2025-01-19 18:00:00'),
(18, 2, 'En Camino', 'En tránsito hacia Cali', 'Carretera Nacional', 1, NULL, 'transportadora', '2025-01-20 01:00:00'),
(19, 3, 'Pendiente', 'Pedido creado', NULL, 0, 5, 'manual', '2025-01-20 13:00:00'),
(20, 3, 'Recibido', 'Confirmado por admin', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-20 14:00:00'),
(21, 3, 'En Proceso', 'En preparación', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-20 19:00:00'),
(22, 3, 'Facturado', 'Factura lista', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-21 15:00:00'),
(23, 4, 'Pendiente', 'Pedido recién creado, esperando confirmación de admin', NULL, 0, 4, 'manual', '2025-01-22 16:00:00'),
(24, 5, 'Pendiente', 'Pedido creado', NULL, 0, 4, 'manual', '2025-01-21 18:00:00'),
(25, 5, 'Recibido', 'Confirmado', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-21 19:00:00'),
(26, 5, 'En Proceso', 'Preparando paquete', 'Bodega Bucaramanga', 0, 6, 'manual', '2025-01-22 14:00:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notificaciones`
--

CREATE TABLE `notificaciones` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `pedido_id` int(11) DEFAULT NULL COMMENT 'Pedido relacionado (si aplica)',
  `tipo` varchar(50) NOT NULL COMMENT 'Tipo de notificación (pedido_creado, cambio_estado, etc.)',
  `titulo` varchar(200) NOT NULL,
  `mensaje` text NOT NULL,
  `leida` tinyint(1) DEFAULT 0,
  `enviada_push` tinyint(1) DEFAULT 0 COMMENT 'Indica si se envió como push notification',
  `fecha_envio` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_lectura` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `notificaciones`
--

INSERT INTO `notificaciones` (`id`, `usuario_id`, `pedido_id`, `tipo`, `titulo`, `mensaje`, `leida`, `enviada_push`, `fecha_envio`, `fecha_lectura`) VALUES
(1, 1, 1, 'pedido_creado', 'Nuevo Pedido', 'Tu pedido BUC-2025-0001 ha sido creado', 1, 1, '2025-01-15 14:00:00', NULL),
(2, 1, 1, 'cambio_estado', 'Pedido Recibido', 'Tu pedido BUC-2025-0001 ha sido recibido', 1, 1, '2025-01-15 15:30:00', NULL),
(3, 1, 1, 'cambio_estado', 'Pedido en Proceso', 'Tu pedido está siendo preparado', 1, 1, '2025-01-15 19:00:00', NULL),
(4, 1, 1, 'cambio_estado', 'Factura Generada', 'La factura de tu pedido está lista', 1, 1, '2025-01-16 13:00:00', NULL),
(5, 1, 1, 'entrega_transportadora', 'Entregado a Copetran', 'Tu pedido fue entregado a la transportadora. Guía: 9999', 1, 1, '2025-01-16 16:00:00', NULL),
(6, 1, 1, 'cambio_estado', 'En Camino', 'Tu pedido está en tránsito', 1, 1, '2025-01-16 23:00:00', NULL),
(7, 1, 1, 'cambio_estado', 'Llegó a Destino', 'Tu pedido llegó a la bodega de Bogotá', 1, 1, '2025-01-17 11:00:00', NULL),
(8, 1, 1, 'entregado', 'Pedido Entregado', 'Tu pedido fue entregado. Escanea el QR para confirmar', 1, 1, '2025-01-17 19:30:00', NULL),
(9, 2, 2, 'pedido_creado', 'Nuevo Pedido', 'Tu pedido BUC-2025-0002 ha sido creado', 1, 1, '2025-01-18 15:00:00', NULL),
(10, 2, 2, 'cambio_estado', 'Pedido en Camino', 'Tu pedido está en tránsito hacia Cali', 0, 1, '2025-01-20 01:00:00', NULL),
(11, 3, 3, 'pedido_creado', 'Nuevo Pedido', 'Tu pedido BUC-2025-0003 ha sido creado', 1, 1, '2025-01-20 13:00:00', NULL),
(12, 3, 3, 'cambio_estado', 'Pedido Facturado', 'Tu pedido ha sido facturado', 0, 1, '2025-01-21 15:00:00', NULL),
(13, 6, 4, 'pedido_pendiente', 'Nuevo Pedido Pendiente', 'Pedido BUC-2025-0004 requiere aprobación', 0, 1, '2025-01-22 16:00:00', NULL),
(14, 6, 1, 'qr_confirmado', 'Entrega Confirmada', 'Cliente confirmó recepción del pedido BUC-2025-0001', 1, 1, '2025-01-17 19:35:00', NULL);

--
-- Disparadores `notificaciones`
--
DELIMITER $$
CREATE TRIGGER `tr_notificacion_before_update` BEFORE UPDATE ON `notificaciones` FOR EACH ROW BEGIN
    IF NEW.leida = TRUE AND OLD.leida = FALSE THEN
        SET NEW.fecha_lectura = CURRENT_TIMESTAMP;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos`
--

CREATE TABLE `pedidos` (
  `id` int(11) NOT NULL,
  `numero_pedido` varchar(50) NOT NULL COMMENT 'Número interno del pedido (ej: BUC-2025-0001)',
  `cliente_id` int(11) NOT NULL,
  `vendedor_id` int(11) NOT NULL,
  `numero_guia` varchar(100) DEFAULT NULL COMMENT 'Número de guía de la transportadora',
  `transportadora_id` int(11) DEFAULT NULL,
  `ciudad_origen` varchar(100) DEFAULT 'Bucaramanga',
  `ciudad_destino` varchar(100) NOT NULL,
  `direccion_entrega` text NOT NULL,
  `link_pedido` varchar(500) DEFAULT NULL COMMENT 'Link de Google Drive del pedido/cotización',
  `link_factura` varchar(500) DEFAULT NULL COMMENT 'Link de Google Drive de la factura',
  `estado_actual` enum('pendiente','recibido','en_proceso','facturado','entregado_transportadora','en_transito','entregado_cliente','confirmado_qr') NOT NULL DEFAULT 'pendiente',
  `codigo_qr` varchar(50) DEFAULT NULL COMMENT 'Código QR único para confirmar entrega',
  `confirmado_qr` tinyint(1) DEFAULT 0,
  `fecha_confirmacion_qr` timestamp NULL DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `pedidos`
--

INSERT INTO `pedidos` (`id`, `numero_pedido`, `cliente_id`, `vendedor_id`, `numero_guia`, `transportadora_id`, `ciudad_origen`, `ciudad_destino`, `direccion_entrega`, `link_pedido`, `link_factura`, `estado_actual`, `codigo_qr`, `confirmado_qr`, `fecha_confirmacion_qr`, `observaciones`, `fecha_creacion`, `fecha_actualizacion`) VALUES
(1, 'BUC-2025-0001', 1, 4, '9999', 1, 'Bucaramanga', 'Bogotá', 'Calle 100 #15-20, Edificio Torres del Parque, Apto 501', 'https://drive.google.com/file/d/ejemplo1/view', 'https://drive.google.com/file/d/factura1/view', 'confirmado_qr', 'bucaclinicos_QR_0001', 1, '2025-01-17 19:35:00', 'Pedido de prueba completado', '2025-11-09 19:07:38', '2025-11-09 19:07:39'),
(2, 'BUC-2025-0002', 2, 4, '6666', 1, 'Bucaramanga', 'Cali', 'Avenida 6 Norte #25-30, Barrio Granada', 'https://drive.google.com/file/d/ejemplo2/view', 'https://drive.google.com/file/d/factura2/view', 'en_transito', 'bucaclinicos_QR_0002', 0, NULL, 'En camino a destino', '2025-11-09 19:07:38', '2025-11-09 19:07:39'),
(3, 'BUC-2025-0003', 3, 5, NULL, NULL, 'Bucaramanga', 'Medellín', 'Carrera 43A #1-50, El Poblado', 'https://drive.google.com/file/d/ejemplo3/view', 'https://drive.google.com/file/d/factura3/view', 'facturado', NULL, 0, NULL, 'Esperando entrega a transportadora', '2025-11-09 19:07:38', '2025-11-09 19:07:38'),
(4, 'BUC-2025-0004', 1, 4, NULL, NULL, 'Bucaramanga', 'Barranquilla', 'Calle 72 #56-45, Barrio El Prado', 'https://drive.google.com/file/d/ejemplo4/view', NULL, 'recibido', NULL, 0, NULL, 'Pedido recién creado', '2025-11-09 19:07:38', '2025-11-10 01:36:58'),
(5, 'BUC-2025-0005', 2, 4, NULL, NULL, 'Bucaramanga', 'Cartagena', 'Bocagrande, Edificio Palmeras del Mar, Torre B, Piso 10', 'https://drive.google.com/file/d/ejemplo5/view', NULL, 'en_proceso', NULL, 0, NULL, 'Preparando mercancía', '2025-11-09 19:07:38', '2025-11-09 19:07:38');

--
-- Disparadores `pedidos`
--
DELIMITER $$
CREATE TRIGGER `tr_pedido_after_insert` AFTER INSERT ON `pedidos` FOR EACH ROW BEGIN
    INSERT INTO estados_pedido (pedido_id, estado, descripcion, usuario_id, origen)
    VALUES (NEW.id, 'Pendiente', 'Pedido creado', NEW.vendedor_id, 'manual');
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `transportadoras`
--

CREATE TABLE `transportadoras` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `url_rastreo` varchar(255) NOT NULL,
  `tipo_scraping` enum('html','iframe','api') DEFAULT 'html',
  `activa` tinyint(1) DEFAULT 1,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `transportadoras`
--

INSERT INTO `transportadoras` (`id`, `nombre`, `url_rastreo`, `tipo_scraping`, `activa`, `fecha_creacion`) VALUES
(1, 'Copetran', 'https://autogestion.copetran.com.co/rastrearcarga.aspx?codigo={guia}', 'html', 1, '2025-11-09 19:07:38');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL COMMENT 'Hash bcrypt de la contraseña',
  `rol` enum('cliente','vendedor','admin') NOT NULL DEFAULT 'cliente',
  `telefono` varchar(20) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `ciudad` varchar(100) DEFAULT NULL,
  `vendedor_asignado_id` int(11) DEFAULT NULL COMMENT 'ID del vendedor asignado (solo para clientes)',
  `activo` tinyint(1) DEFAULT 1,
  `token_fcm` varchar(255) DEFAULT NULL COMMENT 'Token de Firebase Cloud Messaging para notificaciones',
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_actualizacion` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `nombre`, `email`, `username`, `password`, `rol`, `telefono`, `direccion`, `ciudad`, `vendedor_asignado_id`, `activo`, `token_fcm`, `fecha_registro`, `fecha_actualizacion`) VALUES
(1, 'Juan Pérez', 'juan.perez@mail.com', 'juanperez', '123456', 'cliente', '3001234567', NULL, 'Bucaramanga', 4, 1, NULL, '2025-11-09 19:07:38', '2025-11-09 19:07:38'),
(2, 'María González', 'maria.gonzalez@mail.com', 'mariagonzalez', '123456', 'cliente', '3007654321', NULL, 'Bogotá', 4, 1, NULL, '2025-11-09 19:07:38', '2025-11-09 19:07:38'),
(3, 'Carlos Rodríguez', 'carlos.rodriguez@mail.com', 'carlosrodriguez', '123456', 'cliente', '3009876543', NULL, 'Medellín', 5, 1, NULL, '2025-11-09 19:07:38', '2025-11-09 19:07:38'),
(4, 'Ana Martínez', 'ana.martinez@bucaclinicos.com', 'anamartinez', '123456', 'vendedor', '3101112222', NULL, 'Bucaramanga', NULL, 1, NULL, '2025-11-09 19:07:38', '2025-11-09 19:07:38'),
(5, 'Luis Ramírez', 'luis.ramirez@bucaclinicos.com', 'luisramirez', '123456', 'vendedor', '3203334444', NULL, 'Bucaramanga', NULL, 1, NULL, '2025-11-09 19:07:38', '2025-11-09 19:07:38'),
(6, 'Admin Sistema', 'admin@bucaclinicos.com', 'admin', '123456', 'admin', '3005556666', NULL, 'Bucaramanga', NULL, 1, NULL, '2025-11-09 19:07:38', '2025-11-09 19:07:38');

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_notificaciones_no_leidas`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_notificaciones_no_leidas` (
`usuario_id` int(11)
,`usuario_nombre` varchar(100)
,`notificaciones_no_leidas` bigint(21)
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_pedidos_completos`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_pedidos_completos` (
`id` int(11)
,`numero_pedido` varchar(50)
,`numero_guia` varchar(100)
,`cliente_id` int(11)
,`cliente_nombre` varchar(100)
,`cliente_email` varchar(150)
,`cliente_telefono` varchar(20)
,`vendedor_id` int(11)
,`vendedor_nombre` varchar(100)
,`vendedor_email` varchar(150)
,`transportadora_id` int(11)
,`transportadora_nombre` varchar(100)
,`ciudad_origen` varchar(100)
,`ciudad_destino` varchar(100)
,`direccion_entrega` text
,`link_pedido` varchar(500)
,`link_factura` varchar(500)
,`estado_actual` enum('pendiente','recibido','en_proceso','facturado','entregado_transportadora','en_transito','entregado_cliente','confirmado_qr')
,`codigo_qr` varchar(50)
,`confirmado_qr` tinyint(1)
,`fecha_confirmacion_qr` timestamp
,`observaciones` text
,`fecha_creacion` timestamp
,`fecha_actualizacion` timestamp
);

-- --------------------------------------------------------

--
-- Estructura Stand-in para la vista `vista_stats_vendedor`
-- (Véase abajo para la vista actual)
--
CREATE TABLE `vista_stats_vendedor` (
`vendedor_id` int(11)
,`vendedor_nombre` varchar(100)
,`total_pedidos` bigint(21)
,`pedidos_pendientes` decimal(22,0)
,`pedidos_en_proceso` decimal(22,0)
,`pedidos_en_camino` decimal(22,0)
,`pedidos_entregados` decimal(22,0)
,`pedidos_confirmados_qr` decimal(22,0)
);

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_notificaciones_no_leidas`
--
DROP TABLE IF EXISTS `vista_notificaciones_no_leidas`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_notificaciones_no_leidas`  AS SELECT `u`.`id` AS `usuario_id`, `u`.`nombre` AS `usuario_nombre`, count(`n`.`id`) AS `notificaciones_no_leidas` FROM (`usuarios` `u` left join `notificaciones` `n` on(`u`.`id` = `n`.`usuario_id` and `n`.`leida` = 0)) GROUP BY `u`.`id`, `u`.`nombre` ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_pedidos_completos`
--
DROP TABLE IF EXISTS `vista_pedidos_completos`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_pedidos_completos`  AS SELECT `p`.`id` AS `id`, `p`.`numero_pedido` AS `numero_pedido`, `p`.`numero_guia` AS `numero_guia`, `c`.`id` AS `cliente_id`, `c`.`nombre` AS `cliente_nombre`, `c`.`email` AS `cliente_email`, `c`.`telefono` AS `cliente_telefono`, `v`.`id` AS `vendedor_id`, `v`.`nombre` AS `vendedor_nombre`, `v`.`email` AS `vendedor_email`, `t`.`id` AS `transportadora_id`, `t`.`nombre` AS `transportadora_nombre`, `p`.`ciudad_origen` AS `ciudad_origen`, `p`.`ciudad_destino` AS `ciudad_destino`, `p`.`direccion_entrega` AS `direccion_entrega`, `p`.`link_pedido` AS `link_pedido`, `p`.`link_factura` AS `link_factura`, `p`.`estado_actual` AS `estado_actual`, `p`.`codigo_qr` AS `codigo_qr`, `p`.`confirmado_qr` AS `confirmado_qr`, `p`.`fecha_confirmacion_qr` AS `fecha_confirmacion_qr`, `p`.`observaciones` AS `observaciones`, `p`.`fecha_creacion` AS `fecha_creacion`, `p`.`fecha_actualizacion` AS `fecha_actualizacion` FROM (((`pedidos` `p` join `usuarios` `c` on(`p`.`cliente_id` = `c`.`id`)) join `usuarios` `v` on(`p`.`vendedor_id` = `v`.`id`)) left join `transportadoras` `t` on(`p`.`transportadora_id` = `t`.`id`)) ;

-- --------------------------------------------------------

--
-- Estructura para la vista `vista_stats_vendedor`
--
DROP TABLE IF EXISTS `vista_stats_vendedor`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vista_stats_vendedor`  AS SELECT `v`.`id` AS `vendedor_id`, `v`.`nombre` AS `vendedor_nombre`, count(`p`.`id`) AS `total_pedidos`, sum(case when `p`.`estado_actual` = 'pendiente' then 1 else 0 end) AS `pedidos_pendientes`, sum(case when `p`.`estado_actual` in ('recibido','en_proceso','facturado') then 1 else 0 end) AS `pedidos_en_proceso`, sum(case when `p`.`estado_actual` in ('entregado_transportadora','en_transito') then 1 else 0 end) AS `pedidos_en_camino`, sum(case when `p`.`estado_actual` in ('entregado_cliente','confirmado_qr') then 1 else 0 end) AS `pedidos_entregados`, sum(case when `p`.`confirmado_qr` = 1 then 1 else 0 end) AS `pedidos_confirmados_qr` FROM (`usuarios` `v` left join `pedidos` `p` on(`v`.`id` = `p`.`vendedor_id`)) WHERE `v`.`rol` = 'vendedor' GROUP BY `v`.`id`, `v`.`nombre` ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `codigos_qr`
--
ALTER TABLE `codigos_qr`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `pedido_id` (`pedido_id`),
  ADD UNIQUE KEY `codigo` (`codigo`),
  ADD KEY `idx_codigo` (`codigo`),
  ADD KEY `idx_pedido` (`pedido_id`),
  ADD KEY `idx_usado` (`usado`);

--
-- Indices de la tabla `configuracion`
--
ALTER TABLE `configuracion`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `clave` (`clave`);

--
-- Indices de la tabla `estados_pedido`
--
ALTER TABLE `estados_pedido`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_pedido` (`pedido_id`),
  ADD KEY `idx_fecha` (`fecha_registro`),
  ADD KEY `idx_origen` (`origen`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_estados_pedido_fecha` (`pedido_id`,`fecha_registro`);

--
-- Indices de la tabla `notificaciones`
--
ALTER TABLE `notificaciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_pedido` (`pedido_id`),
  ADD KEY `idx_leida` (`leida`),
  ADD KEY `idx_tipo` (`tipo`),
  ADD KEY `idx_fecha` (`fecha_envio`),
  ADD KEY `idx_notificaciones_usuario_leida` (`usuario_id`,`leida`);

--
-- Indices de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_pedido` (`numero_pedido`),
  ADD UNIQUE KEY `codigo_qr` (`codigo_qr`),
  ADD KEY `idx_cliente` (`cliente_id`),
  ADD KEY `idx_vendedor` (`vendedor_id`),
  ADD KEY `idx_estado` (`estado_actual`),
  ADD KEY `idx_numero_guia` (`numero_guia`),
  ADD KEY `idx_transportadora` (`transportadora_id`),
  ADD KEY `idx_codigo_qr` (`codigo_qr`),
  ADD KEY `idx_fecha_creacion` (`fecha_creacion`),
  ADD KEY `idx_pedidos_fecha_creacion_estado` (`fecha_creacion`,`estado_actual`);

--
-- Indices de la tabla `transportadoras`
--
ALTER TABLE `transportadoras`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`),
  ADD KEY `idx_activa` (`activa`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_rol` (`rol`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_vendedor_asignado` (`vendedor_asignado_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `codigos_qr`
--
ALTER TABLE `codigos_qr`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `configuracion`
--
ALTER TABLE `configuracion`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `estados_pedido`
--
ALTER TABLE `estados_pedido`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT de la tabla `notificaciones`
--
ALTER TABLE `notificaciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `transportadoras`
--
ALTER TABLE `transportadoras`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `codigos_qr`
--
ALTER TABLE `codigos_qr`
  ADD CONSTRAINT `codigos_qr_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `estados_pedido`
--
ALTER TABLE `estados_pedido`
  ADD CONSTRAINT `estados_pedido_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `estados_pedido_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `notificaciones`
--
ALTER TABLE `notificaciones`
  ADD CONSTRAINT `notificaciones_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notificaciones_ibfk_2` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `pedidos_ibfk_2` FOREIGN KEY (`vendedor_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `pedidos_ibfk_3` FOREIGN KEY (`transportadora_id`) REFERENCES `transportadoras` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`vendedor_asignado_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
