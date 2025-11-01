
-- ===================================================================================
-- SCRIPT DE MIGRACIÓN CONSOLIDADO PARA CORRECCIÓN DE FECHAS
-- OBJETIVO: Unificar todas las columnas de fecha a DATETIME para eliminar
--           errores de zona horaria y fechas "corridas".
--
-- IMPORTANTE:
-- 1. !!HAGA UN BACKUP COMPLETO DE SU BASE DE DATOS ANTES DE EJECUTAR ESTE SCRIPT!!
-- 2. Este script está diseñado para NO BORRAR DATOS. Solo modifica la estructura
--    de las tablas y preserva la información existente en las columnas.
--
-- ===================================================================================

-- ===================================================================================
-- PARTE 1: Migración de TIMESTAMP a DATETIME
-- Problema: Campos TIMESTAMP son afectados por la zona horaria del servidor.
-- Solución: Cambiar a DATETIME para almacenar la fecha/hora sin conversión.
-- ===================================================================================

-- ***** TABLA: users *****
ALTER TABLE `users`
MODIFY COLUMN `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
MODIFY COLUMN `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ***** TABLA: credits *****
ALTER TABLE `credits`
MODIFY COLUMN `applicationDate` DATETIME NOT NULL,
MODIFY COLUMN `approvalDate` DATETIME NULL;

-- ***** TABLA: payments_registered *****
ALTER TABLE `payments_registered`
MODIFY COLUMN `paymentDate` DATETIME NOT NULL;

-- ***** TABLA: interactions *****
ALTER TABLE `interactions`
MODIFY COLUMN `interactionDate` DATETIME NOT NULL;

-- ***** TABLA: audit_logs *****
ALTER TABLE `audit_logs`
MODIFY COLUMN `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ***** TABLA: closures *****
ALTER TABLE `closures`
MODIFY COLUMN `closureDate` DATETIME NOT NULL,
MODIFY COLUMN `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ===================================================================================
-- PARTE 2: Migración de DATE a DATETIME
-- Problema: Campos DATE no tienen hora, causando inconsistencias en la lógica de la app.
-- Solución: Convertir a DATETIME para unificar el manejo de todas las fechas.
-- ===================================================================================

-- ***** TABLA: credits (firstPaymentDate, deliveryDate, dueDate) *****

-- 1. Agregar nuevas columnas DATETIME temporales
ALTER TABLE `credits`
ADD COLUMN `firstPaymentDate_new` DATETIME NULL AFTER `firstPaymentDate`,
ADD COLUMN `deliveryDate_new` DATETIME NULL AFTER `deliveryDate`,
ADD COLUMN `dueDate_new` DATETIME NULL AFTER `dueDate`;

-- 2. Migrar datos existentes (copia segura de DATE a DATETIME con hora 00:00:00)
--    NO se borran datos, solo se copian y transforman.
UPDATE `credits`
SET
    `firstPaymentDate_new` = CASE
        WHEN `firstPaymentDate` IS NOT NULL
        THEN CONCAT(`firstPaymentDate`, ''' 00:00:00''')
        ELSE NULL
    END,
    `deliveryDate_new` = CASE
        WHEN `deliveryDate` IS NOT NULL
        THEN CONCAT(`deliveryDate`, ''' 00:00:00''')
        ELSE NULL
    END,
    `dueDate_new` = CASE
        WHEN `dueDate` IS NOT NULL
        THEN CONCAT(`dueDate`, ''' 00:00:00''')
        ELSE NULL
    END;

-- 3. Eliminar columnas originales (ahora que los datos ya están copiados)
ALTER TABLE `credits`
DROP COLUMN `firstPaymentDate`,
DROP COLUMN `deliveryDate`,
DROP COLUMN `dueDate`;

-- 4. Renombrar columnas nuevas al nombre original
ALTER TABLE `credits`
CHANGE COLUMN `firstPaymentDate_new` `firstPaymentDate` DATETIME NOT NULL,
CHANGE COLUMN `deliveryDate_new` `deliveryDate` DATETIME NULL,
CHANGE COLUMN `dueDate_new` `dueDate` DATETIME NOT NULL;

-- ***** TABLA: payment_plan (paymentDate) *****

-- 1. Agregar nueva columna DATETIME temporal
ALTER TABLE `payment_plan`
ADD COLUMN `paymentDate_new` DATETIME NULL AFTER `paymentDate`;

-- 2. Migrar datos existentes (copia segura de DATE a DATETIME con hora 00:00:00)
UPDATE `payment_plan`
SET `paymentDate_new` = CONCAT(`paymentDate`, ''' 00:00:00''');

-- 3. Eliminar columna original
ALTER TABLE `payment_plan`
DROP COLUMN `paymentDate`;

-- 4. Renombrar columna nueva al nombre original
ALTER TABLE `payment_plan`
CHANGE COLUMN `paymentDate_new` `paymentDate` DATETIME NOT NULL;


-- ===================================================================================
-- VERIFICACIÓN FINAL
-- ===================================================================================
SELECT '¡Migración consolidada completada con éxito!' as mensaje;
SELECT 'Verifique la estructura de las tablas para confirmar los cambios:' as instruccion;

-- Descomente las siguientes líneas en su cliente MySQL para verificar
-- DESCRIBE users;
-- DESCRIBE credits;
-- DESCRIBE payments_registered;
-- DESCRIBE interactions;
-- DESCRIBE audit_logs;
-- DESCRIBE closures;
-- DESCRIBE payment_plan;
-- ===================================================================================
