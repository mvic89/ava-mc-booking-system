-- ============================================
-- AVA MC Booking System - Supabase SQL Setup
-- ============================================
-- This file creates all tables and populates them with realistic dummy data
-- Just copy and paste this entire file into Supabase SQL Editor and run it!

-- ============================================
-- DROP EXISTING TABLES (if re-running)
-- ============================================
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Booking" CASCADE;
DROP TABLE IF EXISTS "Customer" CASCADE;

-- ============================================
-- CREATE TABLES
-- ============================================

-- Customers Table (with BankID integration)
CREATE TABLE "Customer" (
    "id" TEXT PRIMARY KEY,
    "personalNumber" TEXT UNIQUE NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'SE' NOT NULL,

    -- BankID metadata
    "source" TEXT DEFAULT 'MANUAL' NOT NULL,
    "lastBankIdAuth" TIMESTAMP,
    "bankIdIssueDate" TEXT,
    "bankIdSignature" TEXT,
    "bankIdOcspResponse" TEXT,

    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Bookings Table
CREATE TABLE "Booking" (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "motorcycleModel" TEXT NOT NULL,
    "bookingDate" TIMESTAMP NOT NULL,
    "testRideDate" TIMESTAMP,
    "status" TEXT DEFAULT 'PENDING' NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,

    CONSTRAINT "Booking_customerId_fkey"
        FOREIGN KEY ("customerId")
        REFERENCES "Customer"("id")
        ON DELETE CASCADE
);

-- Audit Log Table
CREATE TABLE "AuditLog" (
    "id" TEXT PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ============================================
-- CREATE INDEXES
-- ============================================

-- Customer indexes
CREATE INDEX "Customer_personalNumber_idx" ON "Customer"("personalNumber");
CREATE INDEX "Customer_lastName_firstName_idx" ON "Customer"("lastName", "firstName");

-- Booking indexes
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");
CREATE INDEX "Booking_bookingDate_idx" ON "Booking"("bookingDate");

-- AuditLog indexes
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ============================================
-- INSERT DUMMY DATA
-- ============================================

-- Customers (mix of BankID-verified and manual entries)
INSERT INTO "Customer" VALUES
    -- BankID verified customers
    (
        'cust_001',
        '199003152385',
        'Erik',
        'Lindgren',
        '1990-03-15',
        'erik.lindgren@gmail.com',
        '+46701234567',
        'Storgatan 12',
        'Stockholm',
        '11422',
        'SE',
        'BANKID',
        '2025-02-15 10:30:00',
        '2023-06-29',
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        'MIIFfzCCA2egAwIBAgIQBN...',
        '2025-02-10 14:22:00',
        NOW()
    ),
    (
        'cust_002',
        '198706282391',
        'Anna',
        'Svensson',
        '1987-06-28',
        'anna.svensson@outlook.com',
        '+46702345678',
        'Vasagatan 45',
        'Göteborg',
        '41124',
        'SE',
        'BANKID',
        '2025-02-16 09:15:00',
        '2023-06-29',
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ8...',
        'MIIFfzCCA2egAwIBAgIQBP...',
        '2025-02-12 11:05:00',
        NOW()
    ),
    (
        'cust_003',
        '196911292032',
        'Lars',
        'Andersson',
        '1969-11-29',
        'lars.andersson@yahoo.se',
        '+46703456789',
        'Kungsgatan 88',
        'Malmö',
        '21134',
        'SE',
        'BANKID',
        '2025-02-14 16:45:00',
        '2023-06-29',
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ7...',
        'MIIFfzCCA2egAwIBAgIQBQ...',
        '2025-01-28 13:20:00',
        NOW()
    ),
    (
        'cust_004',
        '199512108734',
        'Sofia',
        'Karlsson',
        '1995-12-10',
        'sofia.karlsson@hotmail.com',
        '+46704567890',
        'Drottninggatan 22',
        'Uppsala',
        '75320',
        'SE',
        'BANKID',
        '2025-02-17 08:00:00',
        '2023-06-29',
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ6...',
        'MIIFfzCCA2egAwIBAgIQBR...',
        '2025-02-17 08:00:00',
        NOW()
    ),

    -- Manual entry customers (no BankID verification yet)
    (
        'cust_005',
        '198503159876',
        'Johan',
        'Bergström',
        '1985-03-15',
        'johan.bergstrom@gmail.com',
        '+46705678901',
        'Åsgatan 5',
        'Stockholm',
        '11634',
        'SE',
        'MANUAL',
        NULL,
        NULL,
        NULL,
        NULL,
        '2025-02-05 12:30:00',
        NOW()
    ),
    (
        'cust_006',
        '199208247654',
        'Emma',
        'Johansson',
        '1992-08-24',
        'emma.j@live.se',
        '+46706789012',
        'Linnégatan 67',
        'Göteborg',
        '41308',
        'SE',
        'MANUAL',
        NULL,
        NULL,
        NULL,
        NULL,
        '2025-02-08 15:45:00',
        NOW()
    ),
    (
        'cust_007',
        '197701055432',
        'Mikael',
        'Nilsson',
        '1977-01-05',
        'mikael.nilsson@telia.com',
        '+46707890123',
        'Strandvägen 14',
        'Stockholm',
        '11456',
        'SE',
        'LEAD',
        NULL,
        NULL,
        NULL,
        NULL,
        '2025-02-11 10:15:00',
        NOW()
    ),
    (
        'cust_008',
        '198909123210',
        'Maria',
        'Pettersson',
        '1989-09-12',
        'maria.p@gmail.com',
        '+46708901234',
        'Hamngatan 33',
        'Malmö',
        '21144',
        'SE',
        'MANUAL',
        NULL,
        NULL,
        NULL,
        NULL,
        '2025-02-13 14:00:00',
        NOW()
    );

-- Bookings
INSERT INTO "Booking" VALUES
    -- Confirmed bookings
    (
        'book_001',
        'cust_001',
        'Yamaha MT-09',
        '2025-02-10 14:22:00',
        '2025-02-22 10:00:00',
        'CONFIRMED',
        'Customer interested in sport touring. Requested test ride on MT-09.',
        '2025-02-10 14:25:00',
        NOW()
    ),
    (
        'book_002',
        'cust_002',
        'Honda CB650R',
        '2025-02-12 11:10:00',
        '2025-02-20 14:30:00',
        'CONFIRMED',
        'First-time buyer. Needs A2 license compatible bike.',
        '2025-02-12 11:15:00',
        NOW()
    ),
    (
        'book_003',
        'cust_003',
        'BMW R1250GS',
        '2025-01-28 13:25:00',
        '2025-02-18 11:00:00',
        'CONFIRMED',
        'Upgrading from R1200GS. Interested in premium package.',
        '2025-01-28 13:30:00',
        NOW()
    ),

    -- Completed bookings
    (
        'book_004',
        'cust_005',
        'Kawasaki Ninja 650',
        '2025-02-05 12:35:00',
        '2025-02-15 13:00:00',
        'COMPLETED',
        'Test ride completed. Customer purchased the bike!',
        '2025-02-05 12:40:00',
        NOW()
    ),
    (
        'book_005',
        'cust_006',
        'Suzuki V-Strom 650',
        '2025-02-08 15:50:00',
        '2025-02-16 10:30:00',
        'COMPLETED',
        'Adventure touring interest. Test ride went well.',
        '2025-02-08 15:55:00',
        NOW()
    ),

    -- Pending bookings
    (
        'book_006',
        'cust_004',
        'Ducati Scrambler Icon',
        '2025-02-17 08:05:00',
        NULL,
        'PENDING',
        'Just verified with BankID. Waiting to schedule test ride.',
        '2025-02-17 08:10:00',
        NOW()
    ),
    (
        'book_007',
        'cust_007',
        'Triumph Street Triple',
        '2025-02-11 10:20:00',
        NULL,
        'PENDING',
        'Lead from website contact form. Follow-up needed.',
        '2025-02-11 10:25:00',
        NOW()
    ),

    -- Cancelled booking
    (
        'book_008',
        'cust_008',
        'KTM 390 Duke',
        '2025-02-13 14:05:00',
        '2025-02-19 15:00:00',
        'CANCELLED',
        'Customer cancelled - found bike at another dealer.',
        '2025-02-13 14:10:00',
        NOW()
    ),

    -- Multiple bookings for same customer
    (
        'book_009',
        'cust_001',
        'Yamaha XSR900',
        '2025-02-16 11:00:00',
        '2025-02-23 13:00:00',
        'CONFIRMED',
        'Customer wants to compare XSR900 with MT-09 before deciding.',
        '2025-02-16 11:05:00',
        NOW()
    );

-- Audit Logs
INSERT INTO "AuditLog" VALUES
    (
        'audit_001',
        'BANKID_AUTH',
        'Customer',
        'cust_001',
        '{"status":"complete","risk":"low","personnummer":"199003152385"}',
        '192.168.1.100',
        NULL,
        '2025-02-10 14:22:00'
    ),
    (
        'audit_002',
        'CUSTOMER_CREATED',
        'Customer',
        'cust_001',
        '{"source":"BANKID","method":"QR"}',
        '192.168.1.100',
        NULL,
        '2025-02-10 14:22:15'
    ),
    (
        'audit_003',
        'BOOKING_CREATED',
        'Booking',
        'book_001',
        '{"motorcycleModel":"Yamaha MT-09","status":"CONFIRMED"}',
        '192.168.1.100',
        NULL,
        '2025-02-10 14:25:00'
    ),
    (
        'audit_004',
        'BANKID_AUTH',
        'Customer',
        'cust_002',
        '{"status":"complete","risk":"low","personnummer":"198706282391"}',
        '192.168.1.105',
        NULL,
        '2025-02-12 11:10:00'
    ),
    (
        'audit_005',
        'CUSTOMER_CREATED',
        'Customer',
        'cust_002',
        '{"source":"BANKID","method":"QR"}',
        '192.168.1.105',
        NULL,
        '2025-02-12 11:10:30'
    ),
    (
        'audit_006',
        'BOOKING_CREATED',
        'Booking',
        'book_002',
        '{"motorcycleModel":"Honda CB650R","status":"CONFIRMED"}',
        '192.168.1.105',
        NULL,
        '2025-02-12 11:15:00'
    ),
    (
        'audit_007',
        'BANKID_AUTH',
        'Customer',
        'cust_004',
        '{"status":"complete","risk":"low","personnummer":"199512108734"}',
        '192.168.1.110',
        NULL,
        '2025-02-17 08:00:00'
    ),
    (
        'audit_008',
        'BOOKING_STATUS_CHANGED',
        'Booking',
        'book_004',
        '{"oldStatus":"CONFIRMED","newStatus":"COMPLETED"}',
        '192.168.1.103',
        NULL,
        '2025-02-15 14:30:00'
    ),
    (
        'audit_009',
        'BOOKING_STATUS_CHANGED',
        'Booking',
        'book_008',
        '{"oldStatus":"CONFIRMED","newStatus":"CANCELLED"}',
        '192.168.1.108',
        NULL,
        '2025-02-18 09:00:00'
    );

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Uncomment these to verify your data after running the script:

-- SELECT COUNT(*) as total_customers FROM "Customer";
-- SELECT COUNT(*) as bankid_customers FROM "Customer" WHERE "source" = 'BANKID';
-- SELECT COUNT(*) as total_bookings FROM "Booking";
-- SELECT "status", COUNT(*) as count FROM "Booking" GROUP BY "status";
-- SELECT * FROM "Customer" ORDER BY "createdAt" DESC LIMIT 5;
-- SELECT * FROM "Booking" ORDER BY "bookingDate" DESC LIMIT 5;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ Database setup complete!';
    RAISE NOTICE '📊 Created 8 customers (4 BankID-verified, 3 manual, 1 lead)';
    RAISE NOTICE '📅 Created 9 bookings (various statuses)';
    RAISE NOTICE '📝 Created 9 audit log entries';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '1. Update your .env.local with Supabase DATABASE_URL';
    RAISE NOTICE '2. Run: npx prisma generate';
    RAISE NOTICE '3. Start your app: npm run dev';
END $$;
