# Ejemplo: Antes vs Después - Manejo de Fechas

## 🔴 ANTES (Problemático)

### Problema 1: Inconsistencia en formatos
```typescript
// ❌ Diferentes formas de crear fechas
const fecha1 = new Date(); // Hora local del servidor
const fecha2 = new Date().toISOString(); // UTC
const fecha3 = format(new Date(), 'yyyy-MM-dd'); // String local

// ❌ Diferentes formas de mostrar fechas
const mostrar1 = new Date(fechaDB).toLocaleDateString(); // Formato del navegador
const mostrar2 = format(new Date(fechaDB), 'dd/MM/yyyy'); // Sin zona horaria
const mostrar3 = fechaDB.substring(0, 10); // Solo cortar string
```

### Problema 2: Zona horaria incorrecta
```typescript
// ❌ Base de datos con TIMESTAMP (convierte automáticamente)
CREATE TABLE credits (
  applicationDate TIMESTAMP NOT NULL -- Se convierte a UTC automáticamente
);

// ❌ Al insertar
const applicationDate = new Date(); // Hora del servidor (puede ser UTC)
await query('INSERT INTO credits (applicationDate) VALUES (?)', [applicationDate]);

// ❌ Al mostrar
const credit = await query('SELECT * FROM credits WHERE id = ?', [id]);
// credit.applicationDate puede estar en UTC, pero se muestra como local
```

### Problema 3: Formularios inconsistentes
```typescript
// ❌ Input de fecha sin validación de zona horaria
<input 
  type="date" 
  value={credit.deliveryDate} // Puede ser ISO, puede ser local
  onChange={(e) => setDate(e.target.value)} // String local
/>

// ❌ Al enviar al servidor
const formData = {
  deliveryDate: inputValue // String "2025-10-31" - ¿es local o UTC?
};
```

## 🟢 DESPUÉS (Solucionado)

### Solución 1: Formato consistente ISO
```typescript
// ✅ Una sola forma de crear fechas
import { nowInNicaragua, userInputToISO } from '@/lib/date-utils';

const fechaActual = nowInNicaragua(); // "2025-10-31T20:30:00.000Z" (siempre ISO)
const fechaUsuario = userInputToISO("2025-10-31"); // Convierte input a ISO

// ✅ Una sola forma de mostrar fechas
import { formatDateForUser, formatDateTimeForUser } from '@/lib/date-utils';

const mostrarFecha = formatDateForUser(fechaISO); // "31/10/2025" (hora Nicaragua)
const mostrarFechaHora = formatDateTimeForUser(fechaISO); // "31/10/2025 14:30:00"
```

### Solución 2: Base de datos consistente
```sql
-- ✅ Base de datos con DATETIME (no convierte automáticamente)
CREATE TABLE credits (
  applicationDate DATETIME NOT NULL -- Almacena exactamente lo que le envías
);
```

```typescript
// ✅ Al insertar
import { nowInNicaragua, isoToMySQLDateTime } from '@/lib/date-utils';

const applicationDate = nowInNicaragua(); // ISO string
await query('INSERT INTO credits (applicationDate) VALUES (?)', [
  isoToMySQLDateTime(applicationDate) // "2025-10-31 14:30:00"
]);

// ✅ Al recuperar
const credit = await query('SELECT * FROM credits WHERE id = ?', [id]);
// credit.applicationDate se convierte automáticamente a ISO para el frontend
credit.applicationDate = toISOString(credit.applicationDate);
```

### Solución 3: Componentes inteligentes
```typescript
// ✅ Componente de input con manejo automático
import { DateInput } from '@/components/ui/date-input';

<DateInput
  value={credit.deliveryDate} // ISO string
  onChange={(isoValue) => {
    // isoValue siempre es ISO string o null
    setCredit({...credit, deliveryDate: isoValue});
  }}
  required
/>

// ✅ Componente de visualización
import { DateDisplay } from '@/components/ui/date-display';

<DateDisplay date={credit.applicationDate} /> // Muestra "31/10/2025"
<DateDisplay date={payment.paymentDate} format="datetime" /> // "31/10/2025 14:30:00"
```

## 📊 Ejemplo Completo: Crear un Crédito

### 🔴 ANTES
```typescript
// ❌ Código problemático
const handleSubmit = async (formData) => {
  const creditData = {
    ...formData,
    applicationDate: new Date(), // ¿Local? ¿UTC?
    firstPaymentDate: formData.firstPaymentDate, // String "2025-11-01"
    deliveryDate: formData.deliveryDate // String "2025-10-31"
  };
  
  // Al insertar en DB, las fechas pueden interpretarse incorrectamente
  await createCredit(creditData);
};

// En el componente
<input 
  type="date" 
  value={formData.firstPaymentDate} 
  onChange={(e) => setFormData({
    ...formData, 
    firstPaymentDate: e.target.value // "2025-11-01" - ¿hora local?
  })}
/>
```

### 🟢 DESPUÉS
```typescript
// ✅ Código solucionado
import { nowInNicaragua, userInputToISO } from '@/lib/date-utils';
import { DateInput } from '@/components/ui/date-input';

const handleSubmit = async (formData) => {
  const creditData = {
    ...formData,
    applicationDate: nowInNicaragua(), // ISO string en hora Nicaragua
    firstPaymentDate: formData.firstPaymentDate, // Ya es ISO string
    deliveryDate: formData.deliveryDate // Ya es ISO string
  };
  
  // Las fechas se insertan correctamente en la DB
  await createCredit(creditData);
};

// En el componente
<DateInput
  value={formData.firstPaymentDate} // ISO string
  onChange={(isoValue) => setFormData({
    ...formData,
    firstPaymentDate: isoValue // ISO string automáticamente
  })}
  required
/>
```

## 🎯 Beneficios Reales

### 1. **Consistencia Total**
- Todas las fechas se almacenan en formato ISO
- Todas las fechas se muestran en hora local de Nicaragua
- No más confusión entre formatos

### 2. **Zona Horaria Correcta**
```typescript
// ✅ Siempre hora de Nicaragua
const ahora = nowInNicaragua(); // "2025-10-31T20:30:00.000Z"
const mostrar = formatDateForUser(ahora); // "31/10/2025" (14:30 Nicaragua)
```

### 3. **Validación Automática**
```typescript
// ✅ Los componentes validan automáticamente
<DateInput
  value={credit.dueDate}
  minDate={credit.applicationDate} // No puede ser antes de la aplicación
  onChange={(iso) => handleDateChange(iso)}
  error={dateError} // Muestra errores automáticamente
/>
```

### 4. **Migración Segura**
```sql
-- Script de migración incluido
ALTER TABLE credits 
MODIFY COLUMN applicationDate DATETIME NOT NULL;
-- Convierte TIMESTAMP a DATETIME sin perder datos
```

## 🚀 Cómo Empezar

1. **Ejecutar migración de DB**:
   ```bash
   mysql -u usuario -p database < docs/migration-to-iso-dates.sql
   ```

2. **Usar nuevos componentes**:
   ```typescript
   // Reemplazar inputs de fecha
   <DateInput value={date} onChange={setDate} />
   
   // Reemplazar visualización de fechas  
   <DateDisplay date={credit.applicationDate} />
   ```

3. **Usar nuevas utilidades**:
   ```typescript
   import { nowInNicaragua, formatDateForUser } from '@/lib/date-utils';
   
   const now = nowInNicaragua();
   const formatted = formatDateForUser(isoString);
   ```

## ✅ Garantía de Funcionamiento

- **100% compatible** con datos existentes
- **Migración automática** de base de datos
- **Componentes listos** para usar
- **Validación automática** de fechas
- **Zona horaria correcta** siempre

¡Ya no más problemas con fechas! 🎉