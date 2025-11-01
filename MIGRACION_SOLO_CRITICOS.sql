-- =====================================================
-- MIGRACIÓN OPTIMIZADA - SOLO CAMPOS CRÍTICOS DE FECHAS
-- Base de datos: harrue9_credinica
-- =====================================================

-- IMPORTANTE: Solo cambiamos los campos que causan el problema
-- de fechas corridas (fechas que selecciona el usuario)

-- =====================================================
-- VERIFICAR ESTRUCTURA ACTUAL DE CAMPOS CRÍTICOS
-- =====================================================

DESCRIBE credits;
DESCRIBE payments_registered;

-- =====================================================
-- MIGRAR SOLO CAMPOS CRÍTICOS
-- =====================================================

-- 1. TABLA CREDITS - Fechas de créditos (MUY IMPORTANTE)
ALTER TABLE `credits` 
MODIFY COLUMN `applicationDate` DATETIME NOT NULL COMMENT 'Fecha de solicitud del crédito',
MODIFY COLUMN `approvalDate` DATETIME NULL COMMENT 'Fecha de aprobación del crédito';

-- 2. TABLA PAYMENTS_REGISTERED - Fechas de pagos (CRÍTICO)
ALTER TABLE `payments_registered` 
MODIFY COLUMN `paymentDate` DATETIME NOT NULL COMMENT 'Fecha del pago registrado';

-- =====================================================
-- VERIFICAR QUE LOS CAMBIOS SE APLICARON
-- =====================================================

-- Verificar que los campos críticos ahora son DATETIME
DESCRIBE credits;
DESCRIBE payments_registered;

-- Verificar algunos datos para asegurar que se mantuvieron
SELECT id, applicationDate, approvalDate FROM credits LIMIT 3;
SELECT id, paymentDate FROM payments_registered LIMIT 3;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- credits.applicationDate: DATETIME ✅
-- credits.approvalDate: DATETIME ✅  
-- payments_registered.paymentDate: DATETIME ✅
--
-- Los demás campos (createdAt, updatedAt, etc.) pueden 
-- quedarse como TIMESTAMP sin problema porque son 
-- fechas automáticas del sistema.
-- =====================================================