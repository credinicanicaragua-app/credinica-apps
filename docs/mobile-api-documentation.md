# 📱 CrediNica Mobile API - Documentación para App Android

## 🎯 **APIs Específicas para Funcionalidad Offline**

Estos endpoints están diseñados específicamente para soportar la app Android con funcionalidad offline completa.

---

## 🔄 **1. SINCRONIZACIÓN COMPLETA**

### **GET /api/mobile/sync**
Descarga TODA la cartera del gestor para trabajo offline.

```http
GET /api/mobile/sync?lastSync=2025-10-31T10:00:00Z
Authorization: Bearer {token}
```

**Respuesta:**
```json
{
  "timestamp": "2025-10-31T20:30:00.000Z",
  "gestor": {
    "id": "user_123",
    "name": "Juan Pérez",
    "sucursal": "Sucursal León"
  },
  "credits": [
    {
      "id": "credit_456",
      "creditNumber": "CRE-00123",
      "clientId": "client_789",
      "clientName": "María González",
      "amount": 50000,
      "totalAmount": 65000,
      "status": "Active",
      "paymentFrequency": "Quincenal"
    }
  ],
  "clients": [
    {
      "id": "client_789",
      "name": "María González",
      "cedula": "001-010185-0001A",
      "phone": "8888-1234",
      "address": "León, Nicaragua"
    }
  ],
  "paymentPlans": [
    {
      "creditId": "credit_456",
      "paymentNumber": 1,
      "paymentDate": "2025-11-15",
      "amount": 2708.33,
      "principal": 2083.33,
      "interest": 625.00,
      "balance": 62291.67
    }
  ],
  "payments": [
    {
      "id": "pay_123",
      "creditId": "credit_456",
      "paymentDate": "2025-10-30T14:30:00.000Z",
      "amount": 2708.33,
      "managedBy": "Juan Pérez",
      "transactionNumber": "REC-001234"
    }
  ],
  "systemConfig": {
    "companyName": "CrediNica",
    "timezone": "America/Managua",
    "currency": "NIO",
    "receiptFooter": "Gracias por su pago"
  },
  "stats": {
    "totalCredits": 25,
    "totalClients": 20,
    "totalPayments": 150
  }
}
```

---

## 💰 **2. APLICAR PAGOS OFFLINE**

### **POST /api/mobile/payments**
Aplica pagos individuales o en lote (batch) desde la app móvil.

#### **Pago Individual:**
```http
POST /api/mobile/payments
Content-Type: application/json

{
  "payments": {
    "creditId": "credit_456",
    "amount": 2708.33,
    "managedBy": "Juan Pérez",
    "transactionNumber": "MOB-1698765432",
    "paymentDate": "2025-10-31T14:30:00.000Z",
    "offlineId": "offline_001"
  },
  "isBatch": false
}
```

#### **Pagos en Lote (Batch):**
```http
POST /api/mobile/payments
Content-Type: application/json

{
  "payments": [
    {
      "creditId": "credit_456",
      "amount": 2708.33,
      "managedBy": "Juan Pérez",
      "transactionNumber": "MOB-1698765432",
      "offlineId": "offline_001"
    },
    {
      "creditId": "credit_789",
      "amount": 1500.00,
      "managedBy": "Juan Pérez",
      "transactionNumber": "MOB-1698765433",
      "offlineId": "offline_002"
    }
  ],
  "isBatch": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "processed": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "success": true,
      "creditId": "credit_456",
      "paymentId": "pay_new_123",
      "offlineId": "offline_001",
      "transactionNumber": "MOB-1698765432",
      "timestamp": "2025-10-31T20:30:00.000Z"
    },
    {
      "success": true,
      "creditId": "credit_789",
      "paymentId": "pay_new_124",
      "offlineId": "offline_002",
      "transactionNumber": "MOB-1698765433",
      "timestamp": "2025-10-31T20:30:00.000Z"
    }
  ],
  "timestamp": "2025-10-31T20:30:00.000Z"
}
```

---

## 🧾 **3. GENERAR RECIBOS**

### **POST /api/mobile/receipt**
Genera recibos optimizados para impresión móvil.

```http
POST /api/mobile/receipt
Content-Type: application/json

{
  "creditId": "credit_456",
  "paymentId": "pay_123",
  "format": "text",
  "isReprint": false
}
```

#### **Formato Texto (para impresoras térmicas):**
```json
{
  "success": true,
  "format": "text",
  "content": "CrediNica\nCOPIA: CLIENTE\n------------------------------------------\nRecibo: MOB-1698765432\nCredito: CRE-00123\nFecha/Hora: 31/10/2025 2:30:00 p. m.\n------------------------------------------\nCliente:\nMARÍA GONZÁLEZ\nCódigo: CLI-00789\n------------------------------------------\nCuota del dia:           C$ 2,708.33\nMonto atrasado:          C$ 0.00\nDias mora:               0\nTotal a pagar:           C$ 2,708.33\n------------------------------------------\nTOTAL COBRADO:           C$ 2,708.33\n------------------------------------------\nSaldo anterior:          C$ 62,291.67\nNuevo saldo:             C$ 59,583.34\n------------------------------------------\nGracias por su pago.\nCONSERVE ESTE RECIBO\n\nLEON\n\nJUAN PÉREZ\nGESTOR DE COBRO\n\n\n",
  "metadata": {
    "creditNumber": "CRE-00123",
    "clientName": "María González",
    "amount": 2708.33,
    "transactionNumber": "MOB-1698765432",
    "timestamp": "31/10/2025 2:30:00 p. m.",
    "gestor": "Juan Pérez"
  }
}
```

#### **Formato HTML (igual que la web):**
```json
{
  "success": true,
  "format": "html",
  "content": "<!DOCTYPE html>\n<html>\n<head>...[HTML completo igual que la web]...</head>\n<body>...[Recibo formateado]...</body>\n</html>",
  "metadata": {
    "creditNumber": "CRE-00123",
    "clientName": "María González",
    "amount": 2708.33,
    "transactionNumber": "MOB-1698765432",
    "timestamp": "31/10/2025 2:30:00 p. m.",
    "gestor": "Juan Pérez"
  }
}
```

---

## 📊 **4. ESTADO Y ESTADÍSTICAS**

### **GET /api/mobile/status**
Obtiene estado del gestor y estadísticas de su cartera.

```http
GET /api/mobile/status?stats=true
```

**Respuesta:**
```json
{
  "success": true,
  "gestor": {
    "id": "user_123",
    "name": "Juan Pérez",
    "role": "GESTOR",
    "sucursal": "Sucursal León",
    "lastActivity": "2025-10-31T20:30:00.000Z"
  },
  "stats": {
    "portfolio": {
      "activeCredits": 25,
      "totalBalance": 1250000.00,
      "uniqueClients": 20
    },
    "today": {
      "payments": 8,
      "amount": 21666.64
    },
    "lastActivity": {
      "lastPayment": {
        "date": "2025-10-31T14:30:00.000Z",
        "amount": 2708.33,
        "client": "María González"
      }
    }
  },
  "timestamp": "2025-10-31T20:30:00.000Z"
}
```

---

## 🔄 **FLUJO RECOMENDADO PARA LA APP**

### **1. Al Iniciar Turno:**
```
1. POST /api/login (autenticación)
2. GET /api/mobile/sync (descargar cartera completa)
3. Guardar en SQLite local
4. GET /api/mobile/status?stats=true (estadísticas iniciales)
```

### **2. Durante Trabajo Offline:**
```
1. Buscar cliente en SQLite local
2. Mostrar estado de cuenta con datos locales
3. Aplicar pago → Guardar en SQLite local
4. POST /api/mobile/receipt (generar recibo)
5. Imprimir recibo vía Bluetooth
6. Marcar pago como "pendiente sincronización"
```

### **3. Al Reconectar:**
```
1. Obtener pagos pendientes de SQLite
2. POST /api/mobile/payments (batch de pagos)
3. Actualizar estados en SQLite
4. GET /api/mobile/sync (actualizar datos)
5. Limpiar pagos sincronizados
```

---

## ⚠️ **CONSIDERACIONES IMPORTANTES**

### **Seguridad:**
- Todos los endpoints requieren autenticación
- Solo gestores pueden acceder a endpoints móviles
- Validación de datos en todos los endpoints

### **Performance:**
- Endpoint de sync optimizado para descargas grandes
- Batch payments para sincronización eficiente
- Compresión automática de respuestas grandes

### **Manejo de Errores:**
- Respuestas consistentes con códigos HTTP apropiados
- Detalles de error para debugging
- Soporte para reintentos automáticos

### **Offline ID:**
- Usar `offlineId` para rastrear pagos antes de sincronizar
- Permite mapear pagos locales con pagos del servidor
- Evita duplicaciones durante sincronización

---

## 🚀 **¡LISTO PARA DESARROLLO ANDROID!**

Estas APIs están optimizadas para:
- ✅ Descarga completa de datos del gestor
- ✅ Aplicación de pagos offline
- ✅ Generación de recibos para impresión
- ✅ Sincronización eficiente
- ✅ Manejo robusto de errores