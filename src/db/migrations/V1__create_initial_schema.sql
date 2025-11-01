
-- Habilitar la extensión para funciones de normalización de texto si no existe.
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Función para normalizar y quitar acentos de cadenas de texto para búsquedas insensibles a mayúsculas y acentos.
CREATE OR REPLACE FUNCTION normalize_string(text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT lower(unaccent($1))
$$;

-- Definición de tipos ENUM para roles, estados, etc., para mantener la consistencia de los datos.
CREATE TYPE user_role AS ENUM ('ADMINISTRADOR', 'GERENTE', 'SUPERVISOR', 'FINANZAS', 'OPERATIVO', 'GESTOR');
CREATE TYPE credit_status AS ENUM ('Pending', 'Approved', 'Active', 'Paid', 'Rejected', 'Expired', 'Fallecido');
CREATE TYPE payment_frequency AS ENUM ('Diario', 'Semanal', 'Catorcenal', 'Quincenal');
CREATE TYPE currency_type AS ENUM ('CÓRDOBAS', 'DÓLARES');
CREATE TYPE payment_status AS ENUM ('VALIDO', 'ANULACION_PENDIENTE', 'ANULADO');

-- Creación de la tabla de sucursales.
CREATE TABLE IF NOT EXISTS sucursales (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    "managerId" VARCHAR(100),
    "managerName" VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Creación de la tabla de usuarios.
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY, -- Coincide con el UID de Firebase
    "fullName" VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    role user_role NOT NULL,
    sucursal_id VARCHAR(50) REFERENCES sucursales(id) ON DELETE SET NULL,
    sucursal_name VARCHAR(100),
    supervisor_id VARCHAR(100) REFERENCES users(id) ON DELETE SET NULL,
    supervisor_name VARCHAR(150),
    active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Creación de la tabla de clientes.
CREATE TABLE IF NOT EXISTS clients (
    id VARCHAR(50) PRIMARY KEY,
    "clientNumber" VARCHAR(20) UNIQUE,
    name VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    cedula VARCHAR(100) NOT NULL UNIQUE, -- Se almacena codificada en Base64
    phone VARCHAR(20),
    sex VARCHAR(10),
    "civilStatus" VARCHAR(20),
    "employmentType" VARCHAR(20),
    sucursal_id VARCHAR(50) REFERENCES sucursales(id),
    sucursal_name VARCHAR(100),
    department VARCHAR(100),
    municipality VARCHAR(100),
    neighborhood VARCHAR(150),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by_id VARCHAR(100) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_clients_name_normalized ON clients (normalize_string(name));

-- Creación de tablas de información adicional para clientes.
CREATE TABLE IF NOT EXISTS asalariado_info (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
    "companyName" VARCHAR(150),
    "jobAntiquity" VARCHAR(100),
    "companyAddress" TEXT,
    "companyPhone" VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS comerciante_info (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
    "businessAntiquity" VARCHAR(100),
    "businessAddress" TEXT,
    "economicActivity" VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS personal_references (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(150),
    phone VARCHAR(20),
    address TEXT,
    relationship VARCHAR(50)
);

-- Creación de la tabla de créditos.
CREATE TABLE IF NOT EXISTS credits (
    id VARCHAR(50) PRIMARY KEY,
    "creditNumber" VARCHAR(20) UNIQUE,
    "clientId" VARCHAR(50) REFERENCES clients(id),
    "clientName" VARCHAR(255),
    status credit_status DEFAULT 'Pending',
    "applicationDate" TIMESTAMP WITH TIME ZONE,
    "approvalDate" TIMESTAMP WITH TIME ZONE,
    "deliveryDate" TIMESTAMP WITH TIME ZONE,
    "dueDate" TIMESTAMP WITH TIME ZONE,
    amount NUMERIC(12, 2),
    "totalAmount" NUMERIC(12, 2),
    "principalAmount" NUMERIC(12, 2),
    "disbursedAmount" NUMERIC(12, 2),
    "netDisbursementAmount" NUMERIC(12, 2),
    "totalInstallmentAmount" NUMERIC(12, 2),
    "totalInterest" NUMERIC(12, 2),
    "interestRate" NUMERIC(5, 2),
    "termMonths" INTEGER,
    "paymentFrequency" payment_frequency,
    "currencyType" currency_type DEFAULT 'CÓRDOBAS',
    "firstPaymentDate" TIMESTAMP WITH TIME ZONE,
    "collectionsManager" VARCHAR(150),
    supervisor VARCHAR(150),
    "createdBy" VARCHAR(150),
    "approvedBy" VARCHAR(150),
    "disbursedBy" VARCHAR(150),
    "rejectedBy" VARCHAR(150),
    "lastModifiedBy" VARCHAR(150),
    "rejectionReason" TEXT,
    "disbursementOrigin" VARCHAR(100),
    branch VARCHAR(100),
    "branchName" VARCHAR(100),
    "creditPromoter" VARCHAR(150)
);
CREATE INDEX IF NOT EXISTS idx_credits_status ON credits (status);

-- Creación de tablas relacionadas a créditos.
CREATE TABLE IF NOT EXISTS payment_plan (
    id SERIAL PRIMARY KEY,
    "creditId" VARCHAR(50) REFERENCES credits(id) ON DELETE CASCADE,
    "paymentNumber" INTEGER,
    "paymentDate" DATE,
    amount NUMERIC(12, 2),
    principal NUMERIC(12, 2),
    interest NUMERIC(12, 2),
    balance NUMERIC(12, 2)
);

CREATE TABLE IF NOT EXISTS registered_payments (
    id VARCHAR(50) PRIMARY KEY,
    "creditId" VARCHAR(50) REFERENCES credits(id) ON DELETE CASCADE,
    "paymentDate" TIMESTAMP WITH TIME ZONE,
    amount NUMERIC(12, 2),
    "managedBy" VARCHAR(150),
    "transactionNumber" VARCHAR(100) UNIQUE,
    status payment_status DEFAULT 'VALIDO',
    "voidReason" TEXT,
    "voidRequestedBy" VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS guarantees (
    id VARCHAR(50) PRIMARY KEY,
    credit_id VARCHAR(50) REFERENCES credits(id) ON DELETE CASCADE,
    article VARCHAR(150),
    brand VARCHAR(100),
    color VARCHAR(50),
    model VARCHAR(100),
    series VARCHAR(100),
    "estimatedValue" NUMERIC(12, 2)
);

CREATE TABLE IF NOT EXISTS guarantors (
    id VARCHAR(50) PRIMARY KEY,
    credit_id VARCHAR(50) REFERENCES credits(id) ON DELETE CASCADE,
    name VARCHAR(150),
    cedula VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    relationship VARCHAR(50)
);

-- Creación de tablas de sistema y auditoría.
CREATE TABLE IF NOT EXISTS counters (
    name VARCHAR(50) PRIMARY KEY,
    value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100),
    date DATE NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS closures (
    id VARCHAR(50) PRIMARY KEY,
    "userId" VARCHAR(100) REFERENCES users(id),
    "userName" VARCHAR(150),
    "sucursalId" VARCHAR(50),
    "closureDate" TIMESTAMP WITH TIME ZONE,
    "systemBalance" NUMERIC(12, 2),
    "physicalBalance" NUMERIC(12, 2),
    difference NUMERIC(12, 2),
    notes TEXT,
    "denominationsNIO" JSONB,
    "denominationsUSD" JSONB,
    "exchangeRate" NUMERIC(10, 4),
    "closedByUserId" VARCHAR(100) REFERENCES users(id),
    "closedByUserName" VARCHAR(150),
    "clientDeposits" NUMERIC(12, 2),
    "manualTransfers" NUMERIC(12, 2)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    "userId" VARCHAR(100),
    "userName" VARCHAR(150),
    action VARCHAR(100),
    details TEXT,
    "entityId" VARCHAR(100),
    "entityType" VARCHAR(50),
    changes JSONB
);

CREATE TABLE IF NOT EXISTS interactions (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) REFERENCES clients(id) ON DELETE CASCADE,
    date TIMESTAMP WITH TIME ZONE,
    user_name VARCHAR(150),
    type VARCHAR(50),
    notes TEXT
);

-- Insertar los contadores iniciales si no existen.
INSERT INTO counters (name, value) VALUES ('clientNumber', 0) ON CONFLICT (name) DO NOTHING;
INSERT INTO counters (name, value) VALUES ('creditNumber', 0) ON CONFLICT (name) DO NOTHING;

