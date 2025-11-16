# 📚 Bucaclínicos En Ruta - Documentación Completa de API

**Version:** 1.0.0
**Base URL:** `http://localhost:3000/api`

---

## 📋 Índice

1. [Autenticación](#autenticación)
2. [Usuarios](#usuarios)
3. [Pedidos](#pedidos)
4. [Códigos QR](#códigos-qr)
5. [Estados de Pedido](#estados-de-pedido)
6. [Notificaciones](#notificaciones)
7. [Estadísticas](#estadísticas)
8. [Transportadoras](#transportadoras)
9. [Configuración](#configuración)
10. [Rastreo](#rastreo)

---

## 🔐 Autenticación

Todos los endpoints (excepto login y register) requieren autenticación mediante **JWT Bearer Token**.

### Header de Autenticación
```
Authorization: Bearer <tu_token_jwt>
```

---

### **POST** `/api/auth/login`
Iniciar sesión

**Permisos:** Público

**Body:**
```json
{
  "email": "admin@bucaclinicos.com",
  "password": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 6,
    "nombre": "Admin Sistema",
    "email": "admin@bucaclinicos.com",
    "username": "admin",
    "rol": "admin",
    "telefono": "3005556666",
    "activo": 1
  }
}
```

---

### **POST** `/api/auth/register`
Registrar nuevo cliente

**Permisos:** Público

**Body:**
```json
{
  "nombre": "Juan Pérez",
  "email": "juan@mail.com",
  "username": "juanperez",
  "password": "123456",
  "telefono": "3001234567",
  "ciudad": "Bucaramanga",
  "direccion": "Calle 45 #10-20"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "usuarioId": 7
}
```

---

## 👥 Usuarios

### **GET** `/api/usuarios`
Listar todos los usuarios

**Permisos:** Admin

**Query Params:**
- `rol` (opcional): `cliente`, `vendedor`, `admin`
- `activo` (opcional): `true`, `false`

**Response:** `200 OK`
```json
{
  "success": true,
  "usuarios": [...],
  "total": 6
}
```

---

### **GET** `/api/usuarios/:id`
Obtener usuario por ID

**Permisos:** Autenticado

**Response:** `200 OK`
```json
{
  "success": true,
  "usuario": {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan.perez@mail.com",
    "username": "juanperez",
    "rol": "cliente",
    "telefono": "3001234567",
    "direccion": null,
    "ciudad": "Bucaramanga",
    "vendedor_asignado_id": 4,
    "activo": 1,
    "fecha_registro": "2025-11-09T19:07:38.000Z"
  }
}
```

---

### **GET** `/api/usuarios/vendedores/lista`
Listar vendedores activos

**Permisos:** Autenticado

**Response:** `200 OK`
```json
{
  "success": true,
  "vendedores": [
    {
      "id": 4,
      "nombre": "Ana Martínez",
      "email": "ana.martinez@bucaclinicos.com",
      "telefono": "3101112222"
    }
  ],
  "total": 2
}
```

---

### **GET** `/api/usuarios/vendedores/:id/clientes`
Obtener clientes de un vendedor

**Permisos:** Autenticado

**Response:** `200 OK`
```json
{
  "success": true,
  "clientes": [...]
}
```

---

### **POST** `/api/usuarios`
Crear usuario (admin puede crear cualquier rol)

**Permisos:** Admin

**Body:**
```json
{
  "nombre": "Luis Vendedor",
  "email": "luis@bucaclinicos.com",
  "username": "luisv",
  "password": "123456",
  "rol": "vendedor",
  "telefono": "3001112222",
  "ciudad": "Bucaramanga",
  "direccion": "Calle 50 #20-30"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Usuario creado exitosamente",
  "usuario": {
    "id": 8,
    "nombre": "Luis Vendedor",
    "email": "luis@bucaclinicos.com",
    "username": "luisv",
    "rol": "vendedor"
  }
}
```

---

### **PUT** `/api/usuarios/:id`
Actualizar usuario

**Permisos:** Autenticado

**Body:**
```json
{
  "nombre": "Juan Pérez Actualizado",
  "telefono": "3009999999",
  "ciudad": "Bogotá",
  "direccion": "Nueva dirección"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Usuario actualizado exitosamente"
}
```

---

### **PUT** `/api/usuarios/:id/fcm-token`
Actualizar token FCM para notificaciones

**Permisos:** Propio usuario

**Body:**
```json
{
  "token_fcm": "fcm_token_string_aqui"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Token FCM actualizado"
}
```

---

### **DELETE** `/api/usuarios/:id`
Eliminar usuario (soft delete)

**Permisos:** Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Usuario desactivado exitosamente"
}
```

---

## 📦 Pedidos

### **GET** `/api/pedidos`
Listar pedidos (filtrado por rol)

**Permisos:** Autenticado
- Admin: ve todos
- Vendedor: ve sus pedidos
- Cliente: ve solo sus pedidos

**Response:** `200 OK`
```json
{
  "success": true,
  "pedidos": [
    {
      "id": 1,
      "numero_pedido": "BUC-2025-0001",
      "numero_guia": "9999",
      "cliente_id": 1,
      "cliente_nombre": "Juan Pérez",
      "cliente_email": "juan.perez@mail.com",
      "cliente_telefono": "3001234567",
      "vendedor_id": 4,
      "vendedor_nombre": "Ana Martínez",
      "transportadora_id": 1,
      "transportadora_nombre": "Copetran",
      "ciudad_origen": "Bucaramanga",
      "ciudad_destino": "Bogotá",
      "direccion_entrega": "Calle 100 #15-20",
      "link_pedido": "https://drive.google.com/...",
      "link_factura": "https://drive.google.com/...",
      "estado_actual": "confirmado_qr",
      "codigo_qr": "bucaclinicos_QR_0001",
      "confirmado_qr": 1,
      "fecha_confirmacion_qr": "2025-01-17T19:35:00.000Z",
      "observaciones": "Pedido de prueba completado",
      "fecha_creacion": "2025-11-09T19:07:38.000Z",
      "fecha_actualizacion": "2025-11-09T19:07:39.000Z"
    }
  ]
}
```

---

### **GET** `/api/pedidos/:id`
Obtener pedido por ID con historial completo

**Permisos:** Autenticado (solo si tiene acceso)

**Response:** `200 OK`
```json
{
  "success": true,
  "pedido": {...},
  "estados": [
    {
      "id": 1,
      "pedido_id": 1,
      "estado": "Pendiente",
      "descripcion": "Pedido creado por vendedor",
      "ubicacion": null,
      "es_subpaso_transportadora": 0,
      "usuario_id": 4,
      "origen": "manual",
      "fecha_registro": "2025-01-15T14:00:00.000Z"
    },
    ...
  ]
}
```

---

### **POST** `/api/pedidos`
Crear nuevo pedido

**Permisos:** Vendedor o Admin

**Body:**
```json
{
  "cliente_id": 1,
  "ciudad_destino": "Bogotá",
  "direccion_entrega": "Calle 100 #15-20, Edificio A, Apto 501",
  "link_pedido": "https://drive.google.com/file/d/...",
  "observaciones": "Entregar de 9am a 5pm"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Pedido creado exitosamente",
  "pedido": {
    "id": 6,
    "numero_pedido": "BUC-2025-0006"
  }
}
```

---

### **PUT** `/api/pedidos/:id/estado`
Actualizar estado de pedido

**Permisos:** Vendedor o Admin

**Body:**
```json
{
  "nuevo_estado": "recibido",
  "descripcion": "Pedido confirmado y recibido en bodega",
  "ubicacion": "Bodega Bucaramanga"
}
```

**Para entregar a transportadora:**
```json
{
  "nuevo_estado": "entregado_transportadora",
  "numero_guia": "123456",
  "transportadora_id": 1,
  "descripcion": "Entregado a Copetran",
  "ubicacion": "Terminal Bucaramanga"
}
```

**Para facturar:**
```json
{
  "nuevo_estado": "facturado",
  "link_factura": "https://drive.google.com/file/d/factura123",
  "descripcion": "Factura generada"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Estado actualizado exitosamente",
  "nuevo_estado": "entregado_transportadora",
  "codigo_qr": "bucaclinicos_QR_0003"
}
```

---

## 🔲 Códigos QR

### **GET** `/api/qr`
Listar códigos QR (filtrado por rol)

**Permisos:** Autenticado

**Query Params:**
- `usado` (opcional): `true`, `false`
- `pedido_id` (opcional): ID del pedido

**Response:** `200 OK`
```json
{
  "success": true,
  "codigos": [
    {
      "id": 1,
      "pedido_id": 1,
      "codigo": "bucaclinicos_QR_0001",
      "imagen_path": null,
      "usado": 1,
      "fecha_generacion": "2025-01-16T16:00:00.000Z",
      "fecha_escaneo": "2025-01-17T19:35:00.000Z",
      "numero_pedido": "BUC-2025-0001"
    }
  ],
  "total": 2
}
```

---

### **GET** `/api/qr/:id`
Obtener código QR por ID

**Permisos:** Autenticado (solo si tiene acceso)

**Response:** `200 OK`
```json
{
  "success": true,
  "codigo": {...}
}
```

---

### **GET** `/api/qr/codigo/:codigo`
Obtener código QR por código (ej: bucaclinicos_QR_0001)

**Permisos:** Autenticado (solo si tiene acceso)

**Response:** `200 OK`
```json
{
  "success": true,
  "codigo": {...}
}
```

---

### **POST** `/api/qr/validar`
Validar código QR (confirmar entrega)

**Permisos:** Cliente (dueño del pedido)

**Body:**
```json
{
  "codigo": "bucaclinicos_QR_0001"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Entrega confirmada exitosamente",
  "pedido": {
    "id": 1,
    "numero_pedido": "BUC-2025-0001"
  }
}
```

---

## 📊 Estados de Pedido

### **GET** `/api/estados-pedido`
Listar todos los estados (admin)

**Permisos:** Admin

**Query Params:**
- `pedido_id` (opcional)
- `origen` (opcional): `manual`, `automatico`, `transportadora`
- `es_subpaso_transportadora` (opcional): `true`, `false`

**Response:** `200 OK`
```json
{
  "success": true,
  "estados": [...],
  "total": 26
}
```

---

### **GET** `/api/estados-pedido/pedido/:pedido_id`
Obtener historial completo de un pedido

**Permisos:** Autenticado (solo si tiene acceso al pedido)

**Response:** `200 OK`
```json
{
  "success": true,
  "estados": [
    {
      "id": 1,
      "pedido_id": 1,
      "estado": "Pendiente",
      "descripcion": "Pedido creado por vendedor",
      "ubicacion": null,
      "es_subpaso_transportadora": 0,
      "usuario_id": 4,
      "usuario_nombre": "Ana Martínez",
      "origen": "manual",
      "fecha_registro": "2025-01-15T14:00:00.000Z"
    },
    ...
  ],
  "total": 11
}
```

---

### **GET** `/api/estados-pedido/:id`
Obtener estado por ID

**Permisos:** Autenticado

**Response:** `200 OK`
```json
{
  "success": true,
  "estado": {...}
}
```

---

### **POST** `/api/estados-pedido`
Crear estado manualmente

**Permisos:** Vendedor o Admin

**Body:**
```json
{
  "pedido_id": 1,
  "estado": "En revisión",
  "descripcion": "Revisando calidad del producto",
  "ubicacion": "Bodega Bucaramanga",
  "es_subpaso_transportadora": 0
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Estado registrado exitosamente",
  "estado": {...}
}
```

---

## 🔔 Notificaciones

### **GET** `/api/notificaciones`
Listar todas las notificaciones (admin)

**Permisos:** Admin

**Query Params:**
- `usuario_id` (opcional)
- `pedido_id` (opcional)
- `tipo` (opcional): `pedido_creado`, `cambio_estado`, etc.
- `leida` (opcional): `true`, `false`

**Response:** `200 OK`
```json
{
  "success": true,
  "notificaciones": [...],
  "total": 14
}
```

---

### **GET** `/api/notificaciones/usuario/:usuario_id`
Obtener notificaciones de un usuario

**Permisos:** Propio usuario o Admin

**Query Params:**
- `leida` (opcional): `true`, `false`
- `tipo` (opcional)

**Response:** `200 OK`
```json
{
  "success": true,
  "notificaciones": [
    {
      "id": 1,
      "usuario_id": 1,
      "pedido_id": 1,
      "tipo": "pedido_creado",
      "titulo": "Nuevo Pedido",
      "mensaje": "Tu pedido BUC-2025-0001 ha sido creado",
      "leida": 1,
      "enviada_push": 1,
      "fecha_envio": "2025-01-15T14:00:00.000Z",
      "fecha_lectura": null
    }
  ],
  "total": 8,
  "no_leidas": 2
}
```

---

### **GET** `/api/notificaciones/:id`
Obtener notificación por ID

**Permisos:** Dueño o Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "notificacion": {...}
}
```

---

### **PUT** `/api/notificaciones/:id/leer`
Marcar notificación como leída

**Permisos:** Dueño o Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notificación marcada como leída"
}
```

---

### **PUT** `/api/notificaciones/usuario/:usuario_id/marcar-todas-leidas`
Marcar todas las notificaciones como leídas

**Permisos:** Propio usuario o Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Todas las notificaciones marcadas como leídas",
  "actualizadas": 5
}
```

---

### **DELETE** `/api/notificaciones/:id`
Eliminar notificación

**Permisos:** Dueño o Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notificación eliminada exitosamente"
}
```

---

### **DELETE** `/api/notificaciones/usuario/:usuario_id/eliminar-leidas`
Eliminar todas las notificaciones leídas de un usuario

**Permisos:** Propio usuario o Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Notificaciones leídas eliminadas",
  "eliminadas": 8
}
```

---

## 📈 Estadísticas

### **GET** `/api/stats/admin`
Obtener estadísticas generales del sistema

**Permisos:** Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "estadisticas": {
    "total_pedidos": 5,
    "pendientes": 0,
    "en_proceso": 2,
    "en_camino": 1,
    "entregados": 2,
    "confirmados_qr": 1
  }
}
```

---

### **GET** `/api/stats/vendedor/:id`
Obtener estadísticas de un vendedor

**Permisos:** Propio vendedor o Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "estadisticas": {
    "vendedor_id": 4,
    "vendedor_nombre": "Ana Martínez",
    "total_pedidos": 4,
    "pedidos_pendientes": 0,
    "pedidos_en_proceso": 2,
    "pedidos_en_camino": 1,
    "pedidos_entregados": 1,
    "pedidos_confirmados_qr": 1
  }
}
```

---

## 🚚 Transportadoras

### **GET** `/api/transportadoras`
Listar transportadoras

**Permisos:** Autenticado

**Query Params:**
- `activa` (opcional): `true`, `false`

**Response:** `200 OK`
```json
{
  "success": true,
  "transportadoras": [
    {
      "id": 1,
      "nombre": "Copetran",
      "url_rastreo": "https://autogestion.copetran.com.co/rastrearcarga.aspx?codigo={guia}",
      "tipo_scraping": "html",
      "activa": 1,
      "fecha_creacion": "2025-11-09T19:07:38.000Z"
    }
  ],
  "total": 1
}
```

---

### **GET** `/api/transportadoras/:id`
Obtener transportadora por ID

**Permisos:** Autenticado

**Response:** `200 OK`
```json
{
  "success": true,
  "transportadora": {...}
}
```

---

### **POST** `/api/transportadoras`
Crear transportadora

**Permisos:** Admin

**Body:**
```json
{
  "nombre": "Envía",
  "url_rastreo": "https://www.envia.co/rastreo?guia={guia}",
  "tipo_scraping": "html"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Transportadora creada exitosamente",
  "transportadora": {
    "id": 2,
    "nombre": "Envía",
    "url_rastreo": "https://www.envia.co/rastreo?guia={guia}",
    "tipo_scraping": "html"
  }
}
```

---

### **PUT** `/api/transportadoras/:id`
Actualizar transportadora

**Permisos:** Admin

**Body:**
```json
{
  "nombre": "Copetran S.A.",
  "url_rastreo": "https://nueva-url.com",
  "tipo_scraping": "api",
  "activa": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Transportadora actualizada exitosamente"
}
```

---

### **DELETE** `/api/transportadoras/:id`
Eliminar transportadora (soft delete)

**Permisos:** Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Transportadora desactivada exitosamente"
}
```

---

## ⚙️ Configuración

### **GET** `/api/configuracion`
Listar todas las configuraciones

**Permisos:** Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "configuraciones": [
    {
      "id": 1,
      "clave": "contador_qr",
      "valor": "2",
      "descripcion": "Contador para generar códigos QR únicos",
      "fecha_actualizacion": "2025-11-09T19:07:39.000Z"
    },
    ...
  ],
  "total": 5
}
```

---

### **GET** `/api/configuracion/:id`
Obtener configuración por ID

**Permisos:** Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "configuracion": {...}
}
```

---

### **GET** `/api/configuracion/clave/:clave`
Obtener configuración por clave (ej: contador_qr)

**Permisos:** Admin

**Response:** `200 OK`
```json
{
  "success": true,
  "configuracion": {
    "id": 1,
    "clave": "contador_qr",
    "valor": "2",
    "descripcion": "Contador para generar códigos QR únicos",
    "fecha_actualizacion": "2025-11-09T19:07:39.000Z"
  }
}
```

---

### **POST** `/api/configuracion`
Crear configuración

**Permisos:** Admin

**Body:**
```json
{
  "clave": "tiempo_espera_confirmacion",
  "valor": "7200",
  "descripcion": "Tiempo en segundos para confirmar entrega"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Configuración creada exitosamente",
  "configuracion": {...}
}
```

---

### **PUT** `/api/configuracion/:id`
Actualizar configuración

**Permisos:** Admin

**Body:**
```json
{
  "valor": "10",
  "descripcion": "Descripción actualizada"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Configuración actualizada exitosamente"
}
```

---

### **DELETE** `/api/configuracion/:id`
Eliminar configuración

**Permisos:** Admin

**Nota:** No se pueden eliminar configuraciones críticas (contador_qr, contador_pedido)

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Configuración eliminada exitosamente"
}
```

---

## 📍 Rastreo

### **POST** `/api/rastrear-guia`
Rastrear guía de Copetran

**Permisos:** Público

**Body:**
```json
{
  "numeroGuia": "123456"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "html": "<html>...</html>",
  "numeroGuia": "123456"
}
```

**Response:** `404 Not Found` (cuando no existe)
```json
{
  "success": false,
  "error": "No se encontraron datos para esta guía",
  "numeroGuia": "123456"
}
```

---

### **GET** `/api/rastrear-guia/:numero`
Rastrear guía (método GET)

**Permisos:** Público

**Response:** `200 OK` (igual que POST)

---

## 📝 Estados de Pedido

Los estados siguen una jerarquía que **NO puede retroceder**:

1. `pendiente` - Pedido creado por vendedor
2. `recibido` - Confirmado por administrador
3. `en_proceso` - Preparando mercancía
4. `facturado` - Factura generada
5. `entregado_transportadora` - Entregado a transportadora (se genera QR)
6. `en_transito` - En camino
7. `entregado_cliente` - Entregado al cliente
8. `confirmado_qr` - Cliente confirmó con QR

---

## 🔒 Roles y Permisos

### Cliente
- ✅ Ver sus propios pedidos
- ✅ Ver sus notificaciones
- ✅ Escanear QR para confirmar entrega
- ❌ No puede crear pedidos
- ❌ No puede cambiar estados

### Vendedor
- ✅ Ver pedidos de sus clientes
- ✅ Crear pedidos
- ✅ Actualizar estados de pedidos
- ✅ Ver sus estadísticas
- ❌ No puede ver todos los usuarios

### Admin
- ✅ Acceso completo a todo
- ✅ Ver todas las estadísticas
- ✅ Gestionar usuarios
- ✅ Gestionar transportadoras
- ✅ Gestionar configuraciones

---

## 🔗 Códigos de Respuesta HTTP

- `200 OK` - Solicitud exitosa
- `201 Created` - Recurso creado
- `400 Bad Request` - Datos inválidos
- `401 Unauthorized` - No autenticado
- `403 Forbidden` - Sin permisos
- `404 Not Found` - Recurso no encontrado
- `500 Internal Server Error` - Error del servidor

---

## 📌 Notas Importantes

1. **Contraseñas**: En desarrollo están en texto plano. En producción usar bcrypt.
2. **JWT Token**: Expira en 7 días por defecto.
3. **Firebase**: Configurar `firebase-service-account.json` para notificaciones push.
4. **Base de datos**: Importar `appbucaclinicos.sql` antes de usar la API.
5. **CORS**: Por defecto acepta todas las peticiones (`*`).

---

**Desarrollado por:** Bucaclínicos En Ruta
**Contacto:** admin@bucaclinicos.com
