# Bucaclínicos En Ruta - Backend API

Sistema de gestión de envíos y rastreo de paquetes para distribución de productos clínicos.

## Tecnologías

- **Node.js** + **Express.js** - Backend framework
- **MySQL** - Base de datos relacional
- **JWT** - Autenticación
- **Firebase Admin SDK** - Notificaciones push
- **Axios** - Web scraping de transportadoras

## Estructura del Proyecto

```
trasportadoras_backend/
├── src/
│   ├── config/          # Configuraciones (DB, Firebase, env)
│   ├── controllers/     # Controladores de endpoints
│   ├── middlewares/     # Middlewares (auth, validaciones)
│   ├── routes/          # Definición de rutas
│   ├── services/        # Lógica de negocio
│   └── utils/           # Utilidades y constantes
├── .env                 # Variables de entorno (NO subir a git)
├── .env.example         # Ejemplo de variables de entorno
├── server.js            # Punto de entrada de la aplicación
├── appbucaclinicos.sql  # Script de base de datos
└── package.json         # Dependencias del proyecto
```

## Instalación

1. **Clonar el repositorio**
```bash
git clone <url-del-repo>
cd trasportadoras_backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus valores
```

4. **Configurar base de datos**
- Crear la base de datos MySQL
- Importar el archivo `appbucaclinicos.sql`
```bash
mysql -u root -p < appbucaclinicos.sql
```

5. **Configurar Firebase (opcional, para notificaciones push)**
- Descargar el archivo de cuenta de servicio desde Firebase Console
- Guardarlo como `firebase-service-account.json` en la raíz del proyecto

6. **Iniciar el servidor**

Modo desarrollo:
```bash
npm run dev
```

Modo producción:
```bash
npm start
```

## Variables de Entorno

Ver archivo `.env.example` para todas las variables disponibles.

Principales:
- `PORT` - Puerto del servidor (default: 3000)
- `DB_HOST` - Host de MySQL (default: localhost)
- `DB_USER` - Usuario de MySQL
- `DB_PASSWORD` - Contraseña de MySQL
- `DB_NAME` - Nombre de la base de datos
- `JWT_SECRET` - Secreto para JWT (cambiar en producción)

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Login de usuario
- `POST /api/auth/register` - Registro de nuevo cliente

### Usuarios
- `GET /api/usuarios/:id` - Obtener usuario por ID
- `PUT /api/usuarios/:id/fcm-token` - Actualizar token FCM
- `GET /api/usuarios/vendedores/:id/clientes` - Clientes de un vendedor

### Pedidos
- `GET /api/pedidos` - Listar pedidos (filtrado por rol)
- `GET /api/pedidos/:id` - Detalle de pedido
- `POST /api/pedidos` - Crear pedido (vendedor/admin)
- `PUT /api/pedidos/:id/estado` - Actualizar estado

### Códigos QR
- `POST /api/qr/validar` - Validar código QR de entrega

### Notificaciones
- `GET /api/notificaciones/:usuario_id` - Notificaciones de usuario
- `PUT /api/notificaciones/:id/leer` - Marcar como leída

### Estadísticas
- `GET /api/stats/admin` - Estadísticas generales (admin)
- `GET /api/stats/vendedor/:id` - Estadísticas de vendedor

### Rastreo
- `POST /api/rastrear-guia` - Rastrear guía de Copetran
- `GET /api/rastrear-guia/:numero` - Rastrear guía (GET)

## Roles de Usuario

- **Cliente** - Recibe y rastrea sus pedidos
- **Vendedor** - Crea pedidos para sus clientes
- **Admin** - Gestión completa del sistema

## Flujo de Estados de Pedido

1. `pendiente` - Pedido creado por vendedor
2. `recibido` - Confirmado por administrador
3. `en_proceso` - Preparando mercancía
4. `facturado` - Factura generada
5. `entregado_transportadora` - Entregado a transportadora (genera QR)
6. `en_transito` - En camino
7. `entregado_cliente` - Entregado al cliente
8. `confirmado_qr` - Cliente confirma con QR

**Nota:** Los estados NO pueden retroceder, solo avanzar.

## Seguridad

- Las contraseñas están en texto plano para desarrollo
- En producción: descomentar código de bcrypt en authController.js
- Cambiar JWT_SECRET a un valor seguro en producción
- No exponer .env ni firebase-service-account.json

## Licencia

ISC
