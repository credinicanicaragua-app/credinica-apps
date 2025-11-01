
-- Este script SQL inicializa la base de datos con las tablas necesarias
-- y crea el primer usuario administrador y la primera sucursal.

-- Tabla de Sucursales
CREATE TABLE IF NOT EXISTS `sucursales` (
  `id` VARCHAR(255) PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `managerId` VARCHAR(255),
  `managerName` VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(255) PRIMARY KEY,
  `fullName` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `hashed_password` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(20),
  `role` VARCHAR(50) NOT NULL,
  `sucursal_id` VARCHAR(255),
  `sucursal_name` VARCHAR(255),
  `supervisor_id` VARCHAR(255),
  `supervisor_name` VARCHAR(255),
  `active` BOOLEAN DEFAULT TRUE,
  `mustChangePassword` BOOLEAN DEFAULT FALSE,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS `clients` (
  `id` VARCHAR(255) PRIMARY KEY,
  `clientNumber` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `firstName` VARCHAR(255) NOT NULL,
  `lastName` VARCHAR(255) NOT NULL,
  `cedula` VARCHAR(255) NOT NULL UNIQUE,
  `phone` VARCHAR(20) NOT NULL,
  `sex` ENUM('masculino', 'femenino') NOT NULL,
  `civilStatus` ENUM('soltero', 'casado', 'divorciado', 'viudo', 'union_libre') NOT NULL,
  `employmentType` ENUM('asalariado', 'comerciante') NOT NULL,
  `sucursal_id` VARCHAR(255),
  `sucursal_name` VARCHAR(255),
  `department` VARCHAR(255) NOT NULL,
  `municipality` VARCHAR(255) NOT NULL,
  `neighborhood` VARCHAR(255) NOT NULL,
  `address` TEXT NOT NULL,
  `tags` JSON,
  `createdAt` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_cedula ON clients(cedula);

-- Tablas de información adicional del cliente
CREATE TABLE IF NOT EXISTS `asalariado_info` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `clientId` VARCHAR(255) NOT NULL,
    `companyName` VARCHAR(255),
    `jobAntiquity` VARCHAR(255),
    `companyAddress` TEXT,
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `comerciante_info` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `clientId` VARCHAR(255) NOT NULL,
    `businessAntiquity` VARCHAR(255),
    `businessAddress` TEXT,
    `economicActivity` VARCHAR(255),
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `personal_references` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `clientId` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255),
    `phone` VARCHAR(20),
    `address` TEXT,
    `relationship` VARCHAR(100),
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `interactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `clientId` VARCHAR(255) NOT NULL,
    `date` DATETIME NOT NULL,
    `user` VARCHAR(255) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `notes` TEXT,
    FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Créditos
CREATE TABLE IF NOT EXISTS `credits` (
  `id` VARCHAR(255) PRIMARY KEY,
  `creditNumber` VARCHAR(255) NOT NULL UNIQUE,
  `clientId` VARCHAR(255) NOT NULL,
  `clientName` VARCHAR(255),
  `status` VARCHAR(50) NOT NULL,
  `applicationDate` DATETIME NOT NULL,
  `approvalDate` DATETIME,
  `rejectionReason` TEXT,
  `rejectedBy` VARCHAR(255),
  `amount` DECIMAL(12, 2) NOT NULL,
  `principalAmount` DECIMAL(12, 2),
  `interestRate` DECIMAL(5, 2) NOT NULL,
  `termMonths` INT NOT NULL,
  `paymentFrequency` VARCHAR(50) NOT NULL,
  `currencyType` VARCHAR(50) DEFAULT 'CÓRDOBAS',
  `totalAmount` DECIMAL(12, 2),
  `totalInterest` DECIMAL(12, 2),
  `totalInstallmentAmount` DECIMAL(12, 2),
  `firstPaymentDate` DATE NOT NULL,
  `deliveryDate` DATE,
  `dueDate` DATE,
  `disbursedAmount` DECIMAL(12, 2),
  `disbursedBy` VARCHAR(255),
  `disbursementOrigin` VARCHAR(255),
  `collectionsManager` VARCHAR(255),
  `supervisor` VARCHAR(255),
  `branch` VARCHAR(255),
  `branchName` VARCHAR(255),
  `createdBy` VARCHAR(255),
  `approvedBy` VARCHAR(255),
  `lastModifiedBy` VARCHAR(255),
  `creditPromoter` VARCHAR(255),
  `productType` VARCHAR(100),
  `subProduct` VARCHAR(100),
  `productDestination` TEXT,
  FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE INDEX idx_credits_status ON credits(status);
CREATE INDEX idx_credits_manager ON credits(collectionsManager);

-- Tabla para el Plan de Pagos
CREATE TABLE IF NOT EXISTS `payment_plan` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `creditId` VARCHAR(255) NOT NULL,
    `paymentNumber` INT NOT NULL,
    `paymentDate` DATE NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `principal` DECIMAL(10, 2) NOT NULL,
    `interest` DECIMAL(10, 2) NOT NULL,
    `balance` DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (`creditId`) REFERENCES `credits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para Garantías
CREATE TABLE IF NOT EXISTS `guarantees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `creditId` VARCHAR(255) NOT NULL,
    `article` VARCHAR(255),
    `brand` VARCHAR(255),
    `color` VARCHAR(100),
    `model` VARCHAR(255),
    `series` VARCHAR(255),
    `estimatedValue` DECIMAL(10, 2),
    FOREIGN KEY (`creditId`) REFERENCES `credits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para Fiadores
CREATE TABLE IF NOT EXISTS `guarantors` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `creditId` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255),
    `cedula` VARCHAR(100),
    `phone` VARCHAR(20),
    `address` TEXT,
    `relationship` VARCHAR(100),
    FOREIGN KEY (`creditId`) REFERENCES `credits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla para Abonos/Pagos
CREATE TABLE IF NOT EXISTS `payments_registered` (
  `id` VARCHAR(255) PRIMARY KEY,
  `creditId` VARCHAR(255) NOT NULL,
  `paymentDate` DATETIME NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `managedBy` VARCHAR(255) NOT NULL,
  `transactionNumber` VARCHAR(255),
  `status` ENUM('VALIDO', 'ANULACION_PENDIENTE', 'ANULADO') NOT NULL DEFAULT 'VALIDO',
  `voidReason` TEXT,
  `voidRequestedBy` VARCHAR(255),
  FOREIGN KEY (`creditId`) REFERENCES `credits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Auditoría
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `userId` VARCHAR(255) NOT NULL,
  `userName` VARCHAR(255) NOT NULL,
  `action` VARCHAR(255) NOT NULL,
  `details` TEXT,
  `entityId` VARCHAR(255),
  `entityType` VARCHAR(50),
  `changes` JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Feriados
CREATE TABLE IF NOT EXISTS `holidays` (
  `id` VARCHAR(255) PRIMARY KEY,
  `date` DATE NOT NULL,
  `name` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Contadores para secuencias
CREATE TABLE IF NOT EXISTS `counters` (
  `id` VARCHAR(50) PRIMARY KEY,
  `clientNumber` INT DEFAULT 0,
  `creditNumber` INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de Arqueos de Caja
CREATE TABLE IF NOT EXISTS `closures` (
    `id` VARCHAR(255) PRIMARY KEY,
    `userId` VARCHAR(255) NOT NULL,
    `userName` VARCHAR(255) NOT NULL,
    `sucursalId` VARCHAR(255) NOT NULL,
    `closureDate` DATETIME NOT NULL,
    `systemBalance` DECIMAL(12, 2) NOT NULL,
    `physicalBalance` DECIMAL(12, 2) NOT NULL,
    `difference` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT,
    `denominationsNIO` JSON,
    `denominationsUSD` JSON,
    `exchangeRate` DECIMAL(10, 4),
    `clientDeposits` DECIMAL(12, 2) DEFAULT 0,
    `manualTransfers` DECIMAL(12, 2) DEFAULT 0,
    `closedByUserId` VARCHAR(255) NOT NULL,
    `closedByUserName` VARCHAR(255) NOT NULL,
    `reviewedAt` DATETIME,
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`closedByUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insertar la primera sucursal
INSERT INTO `sucursales` (`id`, `name`) VALUES ('suc_main', 'SUCURSAL PRINCIPAL');

-- Insertar el primer usuario administrador con contraseña 'password'
INSERT INTO `users` (`id`, `fullName`, `email`, `hashed_password`, `role`, `sucursal_id`, `sucursal_name`, `active`, `mustChangePassword`)
VALUES
('user_admin_01', 'ADMINISTRADOR DEL SISTEMA', 'admin@credinica.com', '$2a$10$fP8G.qJd5Vf.V9T8/yB2/.vJg1zJg8/N0.J.G2/0H9jG2hJg2hJg.', 'ADMINISTRADOR', 'suc_main', 'SUCURSAL PRINCIPAL', 1, 0);

-- Insertar contador inicial
INSERT INTO `counters` (`id`, `clientNumber`, `creditNumber`) VALUES ('main', 0, 0);
