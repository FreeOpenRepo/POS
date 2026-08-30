-- =============================================================================
-- POS & KDS Engine Initial Database Schema & Seed Data (pos_db)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean tables if exist
DROP TABLE IF EXISTS "Receipts" CASCADE;
DROP TABLE IF EXISTS "BillOfMaterials" CASCADE;
DROP TABLE IF EXISTS "InventoryItems" CASCADE;
DROP TABLE IF EXISTS "Products" CASCADE;

-- 1. Products
CREATE TABLE "Products" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(200) NOT NULL,
    "Price" NUMERIC(10, 2) NOT NULL,
    "Category" VARCHAR(100) NOT NULL,
    "Sku" VARCHAR(50) NOT NULL UNIQUE
);

-- 2. Inventory Items (Raw Materials)
CREATE TABLE "InventoryItems" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(200) NOT NULL,
    "StockQuantity" NUMERIC(10, 2) NOT NULL,
    "Unit" VARCHAR(50) NOT NULL
);

-- 3. Bill of Materials (BOM)
CREATE TABLE "BillOfMaterials" (
    "Id" SERIAL PRIMARY KEY,
    "ProductId" INT NOT NULL REFERENCES "Products"("Id") ON DELETE CASCADE,
    "InventoryItemId" INT NOT NULL REFERENCES "InventoryItems"("Id") ON DELETE CASCADE,
    "RequiredQuantity" NUMERIC(10, 2) NOT NULL
);

-- 4. Receipts
CREATE TABLE "Receipts" (
    "Id" SERIAL PRIMARY KEY,
    "OrderNumber" VARCHAR(50) NOT NULL,
    "SubTotal" NUMERIC(10, 2) NOT NULL,
    "Tax" NUMERIC(10, 2) NOT NULL,
    "GrandTotal" NUMERIC(10, 2) NOT NULL,
    "EscPosRawBase64" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Data
INSERT INTO "Products" ("Id", "Name", "Price", "Category", "Sku") VALUES
(1, 'Espresso Special Blend', 75.00, 'Beverage', 'ESP-01'),
(2, 'Iced Matcha Latte', 95.00, 'Beverage', 'MAT-01'),
(3, 'Croissant Pure Butter', 85.00, 'Bakery', 'CRS-01')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "InventoryItems" ("Id", "Name", "StockQuantity", "Unit") VALUES
(1, 'Arabica Coffee Beans', 5000.00, 'g'),
(2, 'Fresh Whole Milk', 10000.00, 'ml'),
(3, 'Ceremonial Matcha Powder', 1500.00, 'g'),
(4, 'Frozen French Butter Dough', 120.00, 'pcs')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "BillOfMaterials" ("Id", "ProductId", "InventoryItemId", "RequiredQuantity") VALUES
(1, 1, 1, 18.00), -- 18g espresso beans
(2, 2, 2, 200.00), -- 200ml milk
(3, 2, 3, 10.00),  -- 10g matcha
(4, 3, 4, 1.00)    -- 1 dough
ON CONFLICT ("Id") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"Products"', 'Id'), COALESCE(max("Id"), 1)) FROM "Products";
SELECT setval(pg_get_serial_sequence('"InventoryItems"', 'Id'), COALESCE(max("Id"), 1)) FROM "InventoryItems";
SELECT setval(pg_get_serial_sequence('"BillOfMaterials"', 'Id'), COALESCE(max("Id"), 1)) FROM "BillOfMaterials";
