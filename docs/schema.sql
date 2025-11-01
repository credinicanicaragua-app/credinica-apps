-- -------------------------------------------------------------
-- Schema de Base de Datos para CrediNica
-- Versión: 1.0
-- Descripción: Esquema revisado y corregido con llaves
-- primarias, foráneas e índices. NOTA: REVISAR EL PRIMER USUARIO Y SUCURSAL XFA
-- -------------------------------------------------------------

-- Eliminar tablas si existen para una migración limpia
DROP TABLE IF EXISTS `payments_registered`;
DROP TABLE IF EXISTS `payment_plan`;
DROP TABLE IF EXISTS `guarantees`;
DROP TABLE IF EXISTS `guarantors`;
DROP TABLE IF EXISTS `credits`;
DROP TABLE IF EXISTS `interactions`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `asalariado_info`;
DROP TABLE IF EXISTS `comerciante_info`;
DROP TABLE IF EXISTS `personal_references`;
DROP TABLE IF EXISTS `clients`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `sucursales`;
DROP TABLE IF EXISTS `holidays`;
DROP TABLE IF EXISTS `counters`;
DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `closures`;

-- Tabla de Contadores Globales
CREATE TABLE `counters` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY,
  `clientNumber` INT UNSIGNED NOT NULL DEFAULT 1,
  `creditNumber` INT UNSIGNED NOT NULL DEFAULT 1,
  `reciboNumber` INT UNSIGNED NOT NULL DEFAULT 1
);
INSERT INTO `counters` (id, clientNumber, creditNumber, reciboNumber) VALUES ('main', 1, 1, 1);

-- Tabla de Sucursales
CREATE TABLE `sucursales` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `managerId` VARCHAR(255) NULL,
  `managerName` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
INSERT INTO `sucursales` (`id`, `name`) VALUES ('suc_main', 'SUCURSAL PRINCIPAL');

-- Tabla de Usuarios
CREATE TABLE `users` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `fullName` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `hashed_password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `role` VARCHAR(50) NOT NULL,
  `sucursal_id` VARCHAR(255) NULL,
  `sucursal_name` VARCHAR(255) NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `mustChangePassword` BOOLEAN NOT NULL DEFAULT FALSE,
  `supervisor_id` VARCHAR(255) NULL,
  `supervisor_name` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_role` (`role`),
  INDEX `idx_user_sucursal_id` (`sucursal_id`),
  CONSTRAINT `fk_user_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON DELETE SET NULL
);
INSERT INTO `users` (`id`, `fullName`, `email`, `hashed_password`, `role`, `active`, `sucursal_id`, `sucursal_name`) VALUES ('user_admin_01', 'ADMINISTRADOR DEL SISTEMA', 'admin@credinica.com', '$2a$10$fWz.80.M4i36.g.RBk23v.Kj2u8b3J4/hJ.8iX9fX.Vz0eB4a.5aO', 'ADMINISTRADOR', TRUE, 'suc_main', 'SUCURSAL PRINCIPAL');

-- Tabla de Clientes
CREATE TABLE `clients` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `clientNumber` VARCHAR(50) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `firstName` VARCHAR(255) NOT NULL,
  `lastName` VARCHAR(255) NOT NULL,
  `cedula` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NULL,
  `sex` VARCHAR(20) NULL,
  `civilStatus` VARCHAR(50) NULL,
  `employmentType` VARCHAR(50) NULL,
  `sucursal_id` VARCHAR(255) NULL,
  `sucursal_name` VARCHAR(255) NULL,
  `department` VARCHAR(100) NULL,
  `municipality` VARCHAR(100) NULL,
  `neighborhood` VARCHAR(255) NULL,
  `address` TEXT NULL,
  `tags` JSON NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_client_name` (`name`),
  INDEX `idx_client_sucursal_id` (`sucursal_id`),
  CONSTRAINT `fk_client_sucursal` FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales` (`id`) ON DELETE SET NULL
);

-- Tablas de Información Adicional del Cliente
CREATE TABLE `asalariado_info` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` VARCHAR(255) NOT NULL,
  `companyName` VARCHAR(255) NULL,
  `jobAntiquity` VARCHAR(255) NULL,
  `companyAddress` TEXT NULL,
  `companyPhone` VARCHAR(20) NULL,
  CONSTRAINT `fk_asalariado_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE
);

CREATE TABLE `comerciante_info` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` VARCHAR(255) NOT NULL,
  `businessAntiquity` VARCHAR(255) NULL,
  `businessAddress` TEXT NULL,
  `economicActivity` VARCHAR(255) NULL,
  CONSTRAINT `fk_comerciante_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE
);

CREATE TABLE `personal_references` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `clientId` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `relationship` VARCHAR(100) NULL,
  CONSTRAINT `fk_reference_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE
);

-- Tabla de Créditos
CREATE TABLE `credits` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `creditNumber` VARCHAR(50) NOT NULL UNIQUE,
  `clientId` VARCHAR(255) NOT NULL,
  `clientName` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `applicationDate` DATETIME NOT NULL,
  `approvalDate` DATETIME NULL,
  `approvedBy` VARCHAR(255) NULL,
  `rejectionReason` TEXT NULL,
  `rejectedBy` VARCHAR(255) NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `principalAmount` DECIMAL(15, 2) NOT NULL,
  `netDisbursementAmount` DECIMAL(15, 2) NULL,
  `disbursedAmount` DECIMAL(15, 2) NULL,
  `interestRate` DECIMAL(5, 2) NOT NULL,
  `termMonths` DECIMAL(5, 1) NOT NULL,
  `paymentFrequency` VARCHAR(50) NOT NULL,
  `currencyType` VARCHAR(50) NOT NULL,
  `totalAmount` DECIMAL(15, 2) NOT NULL,
  `totalInterest` DECIMAL(15, 2) NOT NULL,
  `totalInstallmentAmount` DECIMAL(15, 2) NOT NULL,
  `firstPaymentDate` DATE NOT NULL,
  `deliveryDate` DATE NULL,
  `dueDate` DATE NOT NULL,
  `disbursedBy` VARCHAR(255) NULL,
  `collectionsManager` VARCHAR(255) NULL,
  `supervisor` VARCHAR(255) NULL,
  `createdBy` VARCHAR(255) NULL,
  `lastModifiedBy` VARCHAR(255) NULL,
  `branch` VARCHAR(255) NULL,
  `branchName` VARCHAR(255) NULL,
  `productType` VARCHAR(100) NULL,
  `subProduct` VARCHAR(100) NULL,
  `productDestination` VARCHAR(255) NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_credit_status` (`status`),
  INDEX `idx_credit_manager` (`collectionsManager`),
  INDEX `idx_credit_branch` (`branch`),
  CONSTRAINT `fk_credit_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE
);

-- Tabla de Plan de Pagos
CREATE TABLE `payment_plan` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `creditId` VARCHAR(255) NOT NULL,
  `paymentNumber` INT NOT NULL,
  `paymentDate` DATE NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `principal` DECIMAL(15, 2) NOT NULL,
  `interest` DECIMAL(15, 2) NOT NULL,
  `balance` DECIMAL(15, 2) NOT NULL,
  INDEX `idx_plan_creditId` (`creditId`),
  CONSTRAINT `fk_plan_credit` FOREIGN KEY (`creditId`) REFERENCES `credits` (`id`) ON DELETE CASCADE
);

-- Tabla de Pagos Registrados (Abonos)
CREATE TABLE `payments_registered` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `creditId` VARCHAR(255) NOT NULL,
  `paymentDate` DATETIME NOT NULL,
  `amount` DECIMAL(15, 2) NOT NULL,
  `managedBy` VARCHAR(255) NOT NULL,
  `transactionNumber` VARCHAR(100) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'VALIDO',
  `voidReason` TEXT NULL,
  `voidRequestedBy` VARCHAR(255) NULL,
  INDEX `idx_payment_creditId` (`creditId`),
  CONSTRAINT `fk_payment_credit` FOREIGN KEY (`creditId`) REFERENCES `credits` (`id`) ON DELETE CASCADE
);

-- Tabla de Garantías
CREATE TABLE `guarantees` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `creditId` VARCHAR(255) NOT NULL,
  `article` VARCHAR(255) NOT NULL,
  `brand` VARCHAR(255) NULL,
  `color` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `series` VARCHAR(100) NULL,
  `estimatedValue` DECIMAL(15, 2) NOT NULL,
  CONSTRAINT `fk_guarantee_credit` FOREIGN KEY (`creditId`) REFERENCES `credits` (`id`) ON DELETE CASCADE
);

-- Tabla de Fiadores
CREATE TABLE `guarantors` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `creditId` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `cedula` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NULL,
  `address` TEXT NULL,
  `relationship` VARCHAR(100) NULL,
  CONSTRAINT `fk_guarantor_credit` FOREIGN KEY (`creditId`) REFERENCES `credits` (`id`) ON DELETE CASCADE
);

-- Tabla de Interacciones con el cliente (CRM)
CREATE TABLE `interactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `clientId` VARCHAR(255) NOT NULL,
  `date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user` VARCHAR(255) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `notes` TEXT NOT NULL,
  INDEX `idx_interaction_clientId` (`clientId`),
  CONSTRAINT `fk_interaction_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE CASCADE
);

-- Tabla de Feriados
CREATE TABLE `holidays` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `date` DATE NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL
);

-- Tabla de Auditoría
CREATE TABLE `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `userId` VARCHAR(255) NOT NULL,
  `userName` VARCHAR(255) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT,
  `entityId` VARCHAR(255),
  `entityType` VARCHAR(50),
  `changes` JSON,
  INDEX `idx_audit_user` (`userId`),
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_entity` (`entityId`, `entityType`)
);

-- Tabla de Arqueos (Cierres de Caja)
CREATE TABLE `closures` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `userId` VARCHAR(255) NOT NULL,
  `userName` VARCHAR(255) NOT NULL,
  `sucursalId` VARCHAR(255) NOT NULL,
  `closureDate` DATETIME NOT NULL,
  `systemBalance` DECIMAL(15, 2) NOT NULL,
  `physicalBalance` DECIMAL(15, 2) NOT NULL,
  `difference` DECIMAL(15, 2) NOT NULL,
  `notes` TEXT NULL,
  `denominationsNIO` JSON NULL,
  `denominationsUSD` JSON NULL,
  `exchangeRate` DECIMAL(10, 4) NULL,
  `clientDeposits` DECIMAL(15, 2) NULL,
  `manualTransfers` DECIMAL(15, 2) NULL,
  `closedByUserId` VARCHAR(255) NOT NULL,
  `closedByUserName` VARCHAR(255) NOT NULL,
  `reviewedAt` DATETIME NULL,
  INDEX `idx_closure_user` (`userId`),
  INDEX `idx_closure_sucursal` (`sucursalId`),
  CONSTRAINT `fk_closure_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_closure_sucursal` FOREIGN KEY (`sucursalId`) REFERENCES `sucursales` (`id`) ON DELETE CASCADE
);