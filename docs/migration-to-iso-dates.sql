-- Migración para convertir campos TIMESTAMP a DATETIME
-- Ejecutar este script para actualizar una base de datos existente

-- IMPORTANTE: Hacer backup de la base de datos antes de ejecutar

-- 1. Actualizar tabla users
ALTER TABLE `users` 
MODIFY COLUMN `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
MODIFY COLUMN `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 2. Actualizar tabla clients
ALTER TABLE `clients` 
MODIFY COLUMN `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
MODIFY COLUMN `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 3. Actualizar tabla credits
ALTER TABLE `credits` 
MODIFY COLUMN `applicationDate` DATETIME NOT NULL,
MODIFY COLUMN `approvalDate` DATETIME NULL,
MODIFY COLUMN `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
MODIFY COLUMN `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 4. Actualizar tabla payments_registered
ALTER TABLE `payments_registered` 
MODIFY COLUMN `paymentDate` DATETIME NOT NULL;

-- 5. Actualizar tabla interactions
ALTER TABLE `interactions` 
MODIFY COLUMN `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 6. Actualizar tabla audit_logs
ALTER TABLE `audit_logs` 
MODIFY COLUMN `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 7. Actualizar tabla closures
ALTER TABLE `closures` 
MODIFY COLUMN `closureDate` DATETIME NOT NULL,
MODIFY COLUMN `reviewedAt` DATETIME NULL;

-- Verificar que los cambios se aplicaron correctamente
SHOW CREATE TABLE users;
SHOW CREATE TABLE clients;
SHOW CREATE TABLE credits;
SHOW CREATE TABLE payments_registered;
SHOW CREATE TABLE interactions;
SHOW CREATE TABLE audit_logs;
SHOW CREATE TABLE closures;