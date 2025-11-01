# Guía de Manejo de Fechas - CrediNica

## Resumen de Cambios

Este proyecto ha sido actualizado para manejar fechas de manera consistente usando formato ISO 8601 con conversión automática a la zona horaria de Managua, Nicaragua.

## Problemas Solucionados

### 1. **Base de Datos**
- ✅ Cambio de `TIMESTAMP` a `DATETIME` para evitar conversiones automáticas de zona horaria
- ✅ Almacenamiento consistente en formato ISO
- ✅ Campos de fecha unificados

### 2. **Backend (Server-Side)**
- ✅ Funciones utilitarias centralizadas en `src/lib/date-utils.ts`
- ✅ Conversión automática entre ISO y formatos de MySQL
- ✅ Manejo consistente de zona horaria de Nicaragua

### 3. **Frontend (Client-Side)**
- ✅ Componentes de fecha que muestran automáticamente en hora local
- ✅ Inputs de fecha con validación y conversión automática
- ✅ Hook personalizado para manejo de fechas en formularios

## Nuevas Utilidades

### `src/lib/date-utils.ts`

```typescript
// Obtener fecha actual en Nicaragua
const now = nowInNicaragua(); // ISO string

// Formatear para mostrar al usuario
const formatted = formatDateForUser(isoString); // "31/10/2025"
const withTime = formatDateTimeForUser(isoString); // "31/10/2025 14:30:00"

// Convertir input del usuario a ISO
const iso = userInputToISO("2025-10-31"); // ISO string

// Para base de datos MySQL
const mysqlDate = isoToMySQLDate(isoString); // "2025-10-31"
const mysqlDateTime = isoToMySQLDateTime(isoString); // "2025-10-31 14:30:00"
```

### Componentes de UI

```tsx
// Mostrar fechas
<DateDisplay date={credit.applicationDate} />
<DateTime date={payment.paymentDate} />

// Input de fechas
<DateInput 
  value={formData.date} 
  onChange={(iso) => setFormData({...formData, date: iso})}
  required
/>
```

### Hook para formularios

```tsx
const {
  displayValue,
  isoValue,
  error,
  handleChange,
  setToday
} = useDateInput({
  initialValue: credit.deliveryDate,
  required: true
});
```

## Migración de Base de Datos

1. **Hacer backup** de la base de datos actual
2. Ejecutar el script `docs/migration-to-iso-dates.sql`
3. Verificar que todos los campos se actualizaron correctamente

## Mejores Prácticas

### ✅ Hacer

1. **Usar las utilidades centralizadas**:
   ```typescript
   import { formatDateForUser, nowInNicaragua } from '@/lib/date-utils';
   ```

2. **Almacenar fechas en formato ISO**:
   ```typescript
   const applicationDate = nowInNicaragua(); // "2025-10-31T20:30:00.000Z"
   ```

3. **Mostrar fechas con componentes**:
   ```tsx
   <DateDisplay date={credit.applicationDate} />
   ```

4. **Usar el hook para inputs**:
   ```tsx
   const dateInput = useDateInput({ required: true });
   ```

### ❌ Evitar

1. **No usar `new Date()` directamente**:
   ```typescript
   // ❌ Malo
   const now = new Date();
   
   // ✅ Bueno
   const now = nowInNicaragua();
   ```

2. **No formatear fechas manualmente**:
   ```typescript
   // ❌ Malo
   const formatted = date.toLocaleDateString();
   
   // ✅ Bueno
   const formatted = formatDateForUser(date);
   ```

3. **No mezclar formatos**:
   ```typescript
   // ❌ Malo - mezcla de formatos
   const date1 = "2025-10-31";
   const date2 = new Date().toISOString();
   
   // ✅ Bueno - formato consistente
   const date1 = nowInNicaragua();
   const date2 = userInputToISO("2025-10-31");
   ```

## Zona Horaria

- **Zona horaria del sistema**: America/Managua (UTC-6)
- **Almacenamiento**: ISO 8601 strings
- **Visualización**: Automáticamente convertida a hora local de Nicaragua
- **Inputs**: Asumidos como hora local de Nicaragua

## Validación

Todas las fechas se validan automáticamente:
- Formato ISO válido
- Rangos de fechas (min/max)
- Campos requeridos
- Conversión segura entre formatos

## Testing

Para probar el manejo de fechas:

```typescript
// Verificar que las fechas se almacenan en ISO
expect(credit.applicationDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

// Verificar que se muestran en formato local
expect(formatDateForUser(isoString)).toBe("31/10/2025");
```

## Soporte

Si encuentras problemas con fechas:
1. Verificar que estás usando las utilidades de `date-utils.ts`
2. Comprobar que la base de datos usa campos `DATETIME`
3. Asegurar que los componentes usan `DateDisplay` o `DateInput`
4. Revisar que los formularios usan el hook `useDateInput`