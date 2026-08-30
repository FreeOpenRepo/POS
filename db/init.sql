-- =============================================================================
-- 01_POS_KDS_ENGINE Database Schema & Seed Data (pos_db)
-- PostgreSQL 18 Schema matching EF Core Model
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean tables if exist
DROP TABLE IF EXISTS "Payments" CASCADE;
DROP TABLE IF EXISTS "OrderItems" CASCADE;
DROP TABLE IF EXISTS "Orders" CASCADE;
DROP TABLE IF EXISTS "Tables" CASCADE;
DROP TABLE IF EXISTS "BillOfMaterials" CASCADE;
DROP TABLE IF EXISTS "Ingredients" CASCADE;
DROP TABLE IF EXISTS "Products" CASCADE;

-- 1. Ingredients
CREATE TABLE "Ingredients" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(200) NOT NULL,
    "CurrentStock" NUMERIC(10, 2) NOT NULL,
    "MinimumThreshold" NUMERIC(10, 2) NOT NULL,
    "Unit" INT NOT NULL DEFAULT 0,
    "CostPerUnit" NUMERIC(10, 2) NOT NULL DEFAULT 0.00
);

-- 2. Products
CREATE TABLE "Products" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(200) NOT NULL,
    "Description" TEXT,
    "Category" INT NOT NULL DEFAULT 0,
    "Price" NUMERIC(10, 2) NOT NULL,
    "ImageUrl" TEXT,
    "IsAvailable" BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. BillOfMaterials
CREATE TABLE "BillOfMaterials" (
    "Id" SERIAL PRIMARY KEY,
    "ProductId" INT NOT NULL REFERENCES "Products"("Id") ON DELETE CASCADE,
    "IngredientId" INT NOT NULL REFERENCES "Ingredients"("Id") ON DELETE CASCADE,
    "QuantityRequired" NUMERIC(10, 2) NOT NULL
);

-- 4. Tables
CREATE TABLE "Tables" (
    "Id" SERIAL PRIMARY KEY,
    "TableNumber" VARCHAR(50) NOT NULL,
    "Seats" INT NOT NULL,
    "Status" INT NOT NULL DEFAULT 0
);

-- 5. Orders
CREATE TABLE "Orders" (
    "Id" SERIAL PRIMARY KEY,
    "OrderNumber" VARCHAR(50) NOT NULL,
    "TableId" INT NOT NULL REFERENCES "Tables"("Id"),
    "Actor" INT NOT NULL DEFAULT 0,
    "Status" INT NOT NULL DEFAULT 0,
    "SubTotal" NUMERIC(10, 2) NOT NULL,
    "Tax" NUMERIC(10, 2) NOT NULL,
    "GrandTotal" NUMERIC(10, 2) NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "AcceptedAt" TIMESTAMP WITH TIME ZONE,
    "CompletedAt" TIMESTAMP WITH TIME ZONE,
    "PaidAt" TIMESTAMP WITH TIME ZONE
);

-- 6. OrderItems
CREATE TABLE "OrderItems" (
    "Id" SERIAL PRIMARY KEY,
    "OrderId" INT NOT NULL REFERENCES "Orders"("Id") ON DELETE CASCADE,
    "ProductId" INT NOT NULL,
    "ProductName" VARCHAR(200) NOT NULL,
    "UnitPrice" NUMERIC(10, 2) NOT NULL,
    "Quantity" INT NOT NULL,
    "TotalPrice" NUMERIC(10, 2) NOT NULL,
    "SpecialInstructions" TEXT
);

-- 7. Payments
CREATE TABLE "Payments" (
    "Id" SERIAL PRIMARY KEY,
    "OrderId" INT NOT NULL REFERENCES "Orders"("Id") ON DELETE CASCADE,
    "Method" INT NOT NULL DEFAULT 0,
    "AmountPaid" NUMERIC(10, 2) NOT NULL,
    "ChangeGiven" NUMERIC(10, 2) NOT NULL,
    "ReceiptData" TEXT,
    "CreatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Ingredients
INSERT INTO "Ingredients" ("Id", "Name", "CurrentStock", "MinimumThreshold", "Unit", "CostPerUnit") VALUES
(1, 'Wagyu Beef Patty (150g)', 85.00, 15.00, 0, 95.00),
(2, 'Brioche Bun', 120.00, 20.00, 0, 12.00),
(3, 'Cheddar Cheese Slice', 200.00, 30.00, 0, 8.50),
(4, 'Truffle Mayo (50g)', 60.00, 10.00, 3, 18.00),
(5, 'Potato Strips (200g)', 150.00, 25.00, 3, 14.00),
(6, 'Arabica Coffee Beans (20g)', 300.00, 40.00, 3, 10.00),
(7, 'Fresh Whole Milk (180ml)', 250.00, 30.00, 3, 7.00),
(8, 'Matcha Green Tea Powder (15g)', 90.00, 15.00, 3, 22.00),
(9, 'Belgian Chocolate Lava Cake Mix', 45.00, 10.00, 0, 35.00),
(10, 'Vanilla Gelato Scoop', 110.00, 20.00, 0, 15.00)
ON CONFLICT ("Id") DO NOTHING;

-- Seed Products
INSERT INTO "Products" ("Id", "Name", "Description", "Category", "Price", "ImageUrl", "IsAvailable") VALUES
(1, 'Signature Truffle Wagyu Burger', '150g Australian Wagyu, melted mature cheddar, caramelized onions, house truffle mayo on toasted brioche.', 0, 320.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', TRUE),
(2, 'Double Smoked Bacon Cheeseburger', 'Double Wagyu patties, smoked crispy bacon, American cheese, secret sauce, pickles.', 0, 390.00, 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80', TRUE),
(3, 'Crispy Truffle Parmesan Fries', 'Golden fried skin-on potatoes tossed in white truffle oil, grated aged parmesan, and fresh parsley.', 0, 160.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80', TRUE),
(4, 'Iced Velvet Caramel Latte', 'Double shot specialty Arabica espresso, velvety cold milk, artisanal salted caramel drizzle.', 1, 135.00, 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80', TRUE),
(5, 'Ceremonial Uji Matcha Latte', 'Authentic stone-ground Kyoto matcha whisked fresh with organic fresh milk.', 1, 145.00, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', TRUE),
(6, 'Warm Molten Lava Cake & Gelato', 'Rich 70% dark Belgian chocolate molten cake served with Madagascar vanilla bean gelato.', 2, 195.00, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80', TRUE)
ON CONFLICT ("Id") DO NOTHING;

-- Seed BillOfMaterials
INSERT INTO "BillOfMaterials" ("Id", "ProductId", "IngredientId", "QuantityRequired") VALUES
(1, 1, 1, 1.00),
(2, 1, 2, 1.00),
(3, 1, 3, 1.00),
(4, 1, 4, 1.00),
(5, 2, 1, 2.00),
(6, 2, 2, 1.00),
(7, 2, 3, 2.00),
(8, 3, 5, 1.00),
(9, 3, 4, 1.00),
(10, 4, 6, 1.00),
(11, 4, 7, 1.00),
(12, 5, 8, 1.00),
(13, 5, 7, 1.00),
(14, 6, 9, 1.00),
(15, 6, 10, 1.00)
ON CONFLICT ("Id") DO NOTHING;

-- Seed Tables
INSERT INTO "Tables" ("Id", "TableNumber", "Seats", "Status") VALUES
(1, 'T-01', 2, 0),
(2, 'T-02', 2, 0),
(3, 'T-03', 4, 0),
(4, 'T-04', 4, 0),
(5, 'T-05', 6, 0),
(6, 'T-06', 8, 0),
(7, 'Bar-1', 1, 0),
(8, 'Bar-2', 1, 0)
ON CONFLICT ("Id") DO NOTHING;

-- Reset Sequences
SELECT setval(pg_get_serial_sequence('"Ingredients"', 'Id'), COALESCE(max("Id"), 1)) FROM "Ingredients";
SELECT setval(pg_get_serial_sequence('"Products"', 'Id'), COALESCE(max("Id"), 1)) FROM "Products";
SELECT setval(pg_get_serial_sequence('"BillOfMaterials"', 'Id'), COALESCE(max("Id"), 1)) FROM "BillOfMaterials";
SELECT setval(pg_get_serial_sequence('"Tables"', 'Id'), COALESCE(max("Id"), 1)) FROM "Tables";
SELECT setval(pg_get_serial_sequence('"Orders"', 'Id'), COALESCE(max("Id"), 1)) FROM "Orders";
SELECT setval(pg_get_serial_sequence('"OrderItems"', 'Id'), COALESCE(max("Id"), 1)) FROM "OrderItems";
SELECT setval(pg_get_serial_sequence('"Payments"', 'Id'), COALESCE(max("Id"), 1)) FROM "Payments";
