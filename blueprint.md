# Blueprint de la Aplicación CrediNica

## Descripción General

CrediNica es una aplicación de gestión de créditos diseñada para administrar clientes, solicitudes de crédito, planes de pago e interacciones. El sistema está construido sobre una base de datos MySQL y una aplicación que interactúa con ella.

Un problema crítico identificado en el sistema fue el manejo inconsistente de las fechas, lo que causaba que las fechas se corrieran un día debido a conversiones automáticas de zona horaria. Para solucionar esto, se ha creado un script de migración consolidado.

## Diseño y Características

### Base de Datos

La base de datos utiliza MySQL. Las tablas principales incluyen:

*   `users`: Gestiona los usuarios del sistema.
*   `clients`: Almacena la información de los clientes.
*   `credits`: Contiene los detalles de los créditos, como montos, fechas de aplicación y aprobación.
*   `payments_registered`: Registra los pagos realizados por los clientes.
*   `payment_plan`: Almacena el cronograma de pagos para cada crédito.
*   `interactions`: Registra las interacciones con los clientes.
*   `audit_logs`: Guarda un registro de auditoría de las acciones en el sistema.
*   `closures`: Gestiona los cierres de caja o de operaciones.

### Manejo de Fechas

Para asegurar la consistencia y evitar problemas de zona horaria, todos los campos de fecha y hora en la base de datos deben usar el tipo de dato `DATETIME`. Esto asegura que los valores de fecha se almacenen y recuperen sin conversiones automáticas de zona horaria, reflejando la hora local de Nicaragua.

## Migración de Base de Datos

Se ha creado un script de migración único y consolidado para corregir todos los problemas de fechas en la base de datos. **Este script está diseñado para no borrar datos, solo modifica la estructura de las tablas.**

### Script de Migración Consolidado

*   **Archivo:** `docs/migration_archive/MIGRACION_CONSOLIDADA_FECHAS.sql`
*   **Propósito:** Unificar todas las columnas de fecha y hora a `DATETIME`.
*   **Problemas que resuelve:**
    1.  **`TIMESTAMP` a `DATETIME`:** Campos como `createdAt`, `approvalDate`, etc., se cambian de `TIMESTAMP` a `DATETIME` para evitar que la zona horaria del servidor los afecte.
    2.  **`DATE` a `DATETIME`:** Campos como `firstPaymentDate`, `deliveryDate`, etc., se cambian de `DATE` a `DATETIME` para asegurar un manejo uniforme y prevenir errores de cálculo en la aplicación.
*   **Seguridad:** El script sigue un proceso seguro que **garantiza que no se pierdan datos existentes**. Para los cambios de `DATE` a `DATETIME`, utiliza un método de copia-y-reemplazo (crea una columna nueva, copia los datos transformados, elimina la vieja y renombra la nueva) para asegurar que la información se preserve intacta.
*   **Instrucciones de Uso:** Se deben seguir las instrucciones dentro del propio archivo SQL, que incluyen la **realización obligatoria de un backup** antes de la ejecución.

### Historial de Archivos Archivados

Los siguientes archivos fueron la base para el script consolidado y ahora se mantienen como archivo histórico:

*   `docs/migration_archive/INSTRUCCIONES_MIGRACION.md`
*   `docs/migration_archive/INSTRUCCIONES_MIGRACION_DATETIME.md`
*   `docs/migration_archive/EJECUTAR_MIGRACION_FECHAS.sql` (Contenido ahora en el script consolidado)
*   `docs/migration_archive/MIGRACION_CAMPOS_FECHA.sql` (Contenido ahora en el script consolidado)

## Plan Actual

*   **Tarea:** Consolidar los scripts de migración de fechas.
*   **Acción:** Se han combinado los dos scripts de migración (`EJECUTAR_MIGRACION_FECHAS.sql` y `MIGRACION_CAMPOS_FECHA.sql`) en un único archivo: `MIGRACION_CONSOLIDADA_FECHAS.sql`.
*   **Resultado:** El proceso de migración es ahora más simple y menos propenso a errores. La documentación se ha actualizado en este `blueprint.md` para reflejar el nuevo procedimiento, manteniendo un único punto de verdad.
