# 📱 CrediNica API Documentation

## 🚀 **API Base URL**
```
https://tu-dominio.com/api
```

## 🔐 **Autenticación**

### Login
```http
POST /api/login
Content-Type: application/json

{
  "email": "usuario@credinica.com",
  "password": "password123"
}
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Inicio de sesión exitoso."
}
```

### Usuario Actual
```http
GET /api/me
Cookie: session=...
```

**Respuesta:**
```json
{
  "id": "user_123",
  "fullName": "Juan Pérez",
  "email": "juan@credinica.com",
  "role": "GESTOR",
  "sucursal": "suc_main",
  "sucursalName": "Sucursal Principal"
}
```

### Logout
```http
POST /api/logout
```

## 💰 **Créditos**

### Listar Créditos
```http
GET /api/credits?status=Active&search=cliente
```

**Parámetros:**
- `status`: Active, Pending, Paid, Rejected
- `search`: Término de búsqueda

### Crear Crédito
```http
POST /api/credits
Content-Type: application/json

{
  "clientId": "client_123",
  "amount": 50000,
  "interestRate": 3.5,
  "termMonths": 12,
  "paymentFrequency": "Quincenal",
  "firstPaymentDate": "2025-11-15"
}
```

### Obtener Crédito Específico
```http
GET /api/credits/credit_123
```

## 👥 **Clientes**

### Listar Clientes
```http
GET /api/clients?search=nombre
```

### Crear Cliente
```http
POST /api/clients
Content-Type: application/json

{
  "name": "María González",
  "cedula": "001-010185-0001A",
  "phone": "8888-1234",
  "address": "León, Nicaragua"
}
```

### Obtener Cliente Específico
```http
GET /api/clients/client_123
```

## 📊 **Reportes**

### Estado de Cuenta
```http
GET /api/reports/account-statement?clientId=client_123&creditId=credit_456
```

### Reporte de Pagos
```http
GET /api/reports/payments-detail?dateFrom=2025-01-01&dateTo=2025-01-31
```

## 🔧 **Utilidades**

### Health Check
```http
GET /api/health
```

**Respuesta:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T20:30:00.000Z",
  "version": "1.0.0",
  "service": "CrediNica API",
  "timezone": "America/Managua"
}
```

### Información de Versión
```http
GET /api/version
```

## 📱 **Para Desarrollo Android**

### Headers Recomendados
```http
Content-Type: application/json
Accept: application/json
User-Agent: CrediNica-Android/1.0.0
```

### Manejo de Errores
Todos los endpoints retornan errores en formato consistente:

```json
{
  "success": false,
  "error": "Descripción del error",
  "code": "ERROR_CODE"
}
```

### Códigos de Estado HTTP
- `200` - Éxito
- `201` - Creado
- `400` - Solicitud inválida
- `401` - No autorizado
- `403` - Prohibido
- `404` - No encontrado
- `500` - Error del servidor

### Paginación
Para endpoints que retornan listas:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "hasNext": true
  }
}
```

## 🌐 **CORS**
La API está configurada para aceptar requests desde:
- Apps Android nativas
- Aplicaciones web
- PWA instaladas

## 📅 **Fechas**
Todas las fechas se manejan en formato ISO 8601 con zona horaria de Nicaragua:
```
2025-10-31T20:30:00.000Z
```

## 🔒 **Seguridad**
- Autenticación basada en sesiones
- HTTPS requerido en producción
- Rate limiting implementado
- Validación de datos en todos los endpoints