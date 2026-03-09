# AVA-MC-BOOKING-SYSTEM - Complete System Architecture & Documentation

**Project**: AVA-MC-BOOKING-SYSTEM (MOTOOS v3.0)
**Version**: 1.0.0
**Last Updated**: February 18, 2026
**Technology**: Next.js 16, TypeScript, BankID v6.0, Roaring.io

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Overall Project Structure](#overall-project-structure)
3. [Technology Stack](#technology-stack)
4. [Features and Functionality](#features-and-functionality)
5. [Database Schema and Models](#database-schema-and-models)
6. [API Endpoints and Routes](#api-endpoints-and-routes)
7. [Authentication and Authorization Flow](#authentication-and-authorization-flow)
8. [Frontend Components and Pages](#frontend-components-and-pages)
9. [Configuration Files and Environment Variables](#configuration-files-and-environment-variables)
10. [Integration Points](#integration-points)
11. [Data Flow Between Components](#data-flow-between-components)
12. [Production Checklist](#production-checklist)
13. [GDPR Compliance](#gdpr-compliance)

---

## Executive Summary

The **AVA-MC-BOOKING-SYSTEM** is a comprehensive motorcycle dealership management system built with Next.js 16, featuring Swedish BankID v6.0 authentication and Roaring.io Nordic data enrichment.

### Key Capabilities:
- **Secure Customer Identification**: Swedish BankID v6.0 integration with mTLS
- **Automated Data Enrichment**: Roaring.io population register integration
- **Lead Management**: Track customer leads with ~80% auto-filled forms
- **Booking System**: Schedule test rides and reservations
- **Compliance**: Audit logging, GDPR-ready architecture
- **Multi-Language**: Swedish UI with BankID localization

### Business Value:
- Reduces manual data entry by ~80%
- Verifies customer identity in seconds
- Prevents fraud with government-backed authentication
- Automates address lookup from official population register
- Provides legal proof of identity (BankID signature)

---

## Overall Project Structure

```
ava-mc-booking-system/
├── app/                          # Next.js App Router (pages & API)
│   ├── api/                      # Backend API endpoints
│   │   ├── bankid/              # BankID authentication
│   │   │   ├── auth/            # POST - Initiate auth/sign
│   │   │   ├── collect/         # POST - Poll for status
│   │   │   ├── cancel/          # POST - Cancel authentication
│   │   │   └── events/          # GET - SSE real-time updates
│   │   └── roaring/             # Roaring.io data enrichment
│   │       ├── person/          # GET/POST - Person lookup
│   │       ├── company/         # GET/POST - Company lookup
│   │       └── pep/             # GET/POST - PEP check
│   ├── sales/                    # Sales and lead management
│   │   └── leads/
│   │       └── new/
│   │           └── page.tsx     # New lead creation form
│   ├── layout.tsx               # Root layout component
│   ├── page.tsx                 # Home/demo page
│   └── globals.css              # Global styles (Tailwind)
│
├── components/                   # Reusable React components
│   ├── bankIdModel.tsx          # BankID modal with QR code
│   ├── Sidebar.tsx              # Navigation sidebar
│   ├── Field.tsx                # Form field with data source badge
│   └── DemoCard.tsx             # Demo use case cards
│
├── lib/                         # Business logic and utilities
│   ├── bankid/                  # BankID integration layer
│   │   ├── client.ts            # API client with mTLS
│   │   ├── qr.ts                # Animated QR generation
│   │   └── mock.ts              # Mock data for testing
│   └── roaring/                 # Roaring.io integration layer
│       └── client.ts            # OAuth 2.0 API client
│
├── types/                       # TypeScript type definitions
│   ├── bankid.ts                # BankID types & interfaces
│   ├── roaring.ts               # Roaring.io types
│   ├── lead.ts                  # Lead management types
│   ├── demo.ts                  # Demo page types
│   └── index.ts                 # Central type exports
│
├── prisma/                      # Database schema & migrations
│   └── schema.prisma            # Prisma ORM schema
│
├── certs/                       # BankID certificates (gitignored)
│   └── FPTestcert4_20230629.p12 # Test certificate
│
├── public/                      # Static assets & images
│
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Environment template
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── next.config.ts               # Next.js configuration
├── supabase-setup.sql           # Database setup with dummy data
│
└── Documentation/               # Project documentation
    ├── README.md                # Quick start guide
    ├── BANKID_SETUP.md          # BankID integration guide
    ├── ROARING_API_SETUP.md     # Roaring.io setup guide
    ├── IMPLEMENTATION_SUMMARY.md # Technical summary
    ├── QUICK_START_CHECKLIST.md # Setup checklist
    └── SYSTEM_ARCHITECTURE.md   # This file
```

---

## Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.1.6 | React framework with App Router |
| **React** | 19.2.3 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.x | Utility-first CSS |
| **qrcode** | 1.5.4 | QR code generation |
| **crypto-js** | 4.2.0 | HMAC-SHA256 for QR animation | :::crypto-js is a library that provides a collection of cryptographic standards implemented in JavaScript. It is used to protect data. 

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime (required for fetch agent) |
| **Next.js API Routes** | 16.1.6 | Backend API endpoints |
| **Prisma** | Latest | Database ORM |
| **PostgreSQL** | 14+ | Database (recommended) |

### External Integrations

| Service | Version/Type | Purpose |
|---------|--------------|---------|
| **BankID** | v6.0 | Swedish eID authentication |
| **Roaring.io** | v2 | Nordic population register data |
| **Mutual TLS** | - | Secure BankID communication |
| **OAuth 2.0** | - | Roaring.io authentication |

### Security & Cryptography

- **HMAC-SHA256**: QR code animation (crypto-js)
- **mTLS**: Mutual TLS authentication with BankID
- **OAuth 2.0**: Client Credentials flow for Roaring.io
- **.p12 Certificates**: BankID authentication certificates

---

## Features and Functionality

### 1. BankID Authentication System

#### Authentication Modes

**1.1 Authentication Mode (`mode: 'auth'`)**
- Customer identification
- Retrieves verified identity data
- Use case: Lead creation, customer onboarding

**1.2 Signing Mode (`mode: 'sign'`)**
- Document signing with legal validity
- Includes custom text to sign
- Use cases: Waivers, purchase agreements, contracts

#### Key Features

✅ **Animated QR Codes**
- HMAC-SHA256 based animation
- Updates every 1 second
- Prevents screenshot attacks

✅ **Same-Device Authentication**
- iOS/Android deep linking
- `bankid:///?autostarttoken=...` URLs
- Fallback to QR code

✅ **Real-Time Status Updates**
- 2-second polling interval
- Server-Sent Events (SSE) support
- Swedish language status messages

✅ **Risk Assessment Integration**
- BankID returns risk level: `low`, `moderate`, `high`
- Risk factors analyzed by BankID servers
- Stored for compliance

✅ **Auto-Timeout**
- 3-minute session timeout
- Automatic cleanup
- User-friendly timeout messages

✅ **Hint Code Localization**

| Hint Code | Swedish Message |
|-----------|-----------------|
| `outstandingTransaction` | Starta BankID-appen |
| `userSign` | Skriv in din säkerhetskod i BankID-appen |
| `started` | Söker efter BankID... |
| `processing` | Behandlar din identifiering |
| `expiredTransaction` | BankID-sessionen har gått ut |
| `userCancel` | Inloggning avbruten |

---

### 2. Roaring.io Data Enrichment

#### Available APIs

**2.1 Person Lookup** (`/api/roaring/person`)
- Population register data
- Address information
- Gender, citizenship
- Protected identity status
- Deceased status

**2.2 Company Lookup** (`/api/roaring/company`)
- Organization information
- Company address
- Registration status
- Industry classification

**2.3 PEP Check** (`/api/roaring/pep`)
- Politically Exposed Person verification
- Risk assessment
- Compliance screening

#### Supported Countries

| Country | Code | Person Data | Company Data |
|---------|------|-------------|--------------|
| Sweden | SE | ✅ | ✅ |
| Norway | NO | ✅ | ✅ |
| Denmark | DK | ✅ | ✅ |
| Finland | FI | ✅ | ✅ |
| Spain | ES | ❌ | ✅ |

#### Data Enrichment Flow

```
1. Customer authenticates with BankID
   └─> Provides: Name, Personnummer

2. System automatically calls Roaring.io
   └─> Input: Personnummer (from BankID)
   └─> Returns: Address, postal code, city, gender, citizenship

3. Combined data auto-fills form
   └─> ~80% form completion automatically
   └─> Dealer only adds: Email, Phone, Notes
```

---

### 3. Lead Management System

#### Lead Creation Flow

```
┌─────────────────────────────────────────┐
│  Step 1: Choose Identification Method   │
├─────────────────────────────────────────┤
│  ○ BankID (rekommenderat) - Auto-fills  │
│  ○ Phone Lookup - Quick search          │
│  ○ Manual Entry - Full form             │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Step 2: Customer Authentication        │
├─────────────────────────────────────────┤
│  • QR code displayed                    │
│  • Customer scans with BankID           │
│  • Customer enters PIN                  │
│  • Identity verified                    │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Step 3: Data Enrichment                │
├─────────────────────────────────────────┤
│  • Roaring.io fetches address           │
│  • Form auto-fills (80%)                │
│  • Data source badges displayed         │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Step 4: Manual Fields                  │
├─────────────────────────────────────────┤
│  Dealer adds:                           │
│  • Email address                        │
│  • Phone number                         │
│  • Lead source                          │
│  • Interest/Notes                       │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Step 5: Vehicle Matching               │
├─────────────────────────────────────────┤
│  • 92% match algorithm                  │
│  • Suggests: Ducati Panigale V4         │
│  • Based on: Age, preferences, history  │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Step 6: Save Lead                      │
├─────────────────────────────────────────┤
│  • Saved to database                    │
│  • Source: BANKID                       │
│  • Audit log created                    │
└─────────────────────────────────────────┘
```

#### Data Source Tracking

Forms display color-coded badges indicating data sources:

| Badge | Color | Meaning |
|-------|-------|---------|
| **BankID** | Blue | Verified by Swedish government |
| **Folkbokföring** | Orange | Roaring.io population register |
| **Personnummer** | Purple | Derived from SSN |
| **Enhet** | Gray | Device information |
| **Manual** | Yellow | Manually entered by dealer |

---

### 4. Booking System

#### Booking Model Features

**Booking Types:**
- Test ride scheduling
- Purchase reservations
- Customer follow-ups
- Service appointments

**Booking Statuses:**
- `PENDING`: Awaiting confirmation
- `CONFIRMED`: Customer confirmed
- `COMPLETED`: Test ride/purchase completed
- `CANCELLED`: Cancelled by customer or dealer

**Fields:**
- Customer association (foreign key)
- Motorcycle model
- Booking date
- Test ride date (optional)
- Status
- Notes (dealer remarks)

---

## Database Schema and Models

### Prisma Schema Overview

**Location**: `/prisma/schema.prisma`

```prisma
// PostgreSQL database
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

---

### Customer Model

**Purpose**: Store customer information with BankID verification metadata

```prisma
model Customer {
  id             String   @id @default(cuid())

  // Identity
  personalNumber String   @unique    // 12-digit personnummer (YYYYMMDDXXXX)
  firstName      String
  lastName       String
  dateOfBirth    String?              // YYYY-MM-DD (extracted from personnummer)

  // Contact
  email          String?
  phone          String?

  // Address (from Roaring.io)
  address        String?
  city           String?
  postalCode     String?
  country        String   @default("SE")

  // BankID Metadata
  source              String    @default("MANUAL")  // BANKID | MANUAL | LEAD
  lastBankIdAuth      DateTime?                      // Last authentication timestamp
  bankIdIssueDate     String?                        // BankID certificate issue date
  bankIdSignature     String?   @db.Text            // Legal proof of signature
  bankIdOcspResponse  String?   @db.Text            // OCSP certificate validation

  // Relations
  bookings      Booking[]

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indexes for performance
  @@index([personalNumber])
  @@index([lastName, firstName])
}
```

**Key Fields Explained:**

- **personalNumber**: Swedish SSN (12 digits, unique)
- **bankIdSignature**: Cryptographic proof of authentication (legal validity)
- **bankIdOcspResponse**: Certificate validation response (proves cert was valid at auth time)
- **source**: Tracks how customer was added (BANKID vs manual entry)

---

### Booking Model

**Purpose**: Manage test rides and purchase reservations

```prisma
model Booking {
  id              String   @id @default(cuid())

  // Customer relationship
  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)

  // Booking details
  motorcycleModel String
  bookingDate     DateTime
  testRideDate    DateTime?
  status          String   @default("PENDING")  // PENDING | CONFIRMED | COMPLETED | CANCELLED
  notes           String?  @db.Text

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indexes for performance
  @@index([customerId])
  @@index([bookingDate])
}
```

---

### AuditLog Model

**Purpose**: GDPR compliance and security auditing

```prisma
model AuditLog {
  id        String   @id @default(cuid())

  // Action details
  action    String   // BANKID_AUTH, CUSTOMER_CREATED, BOOKING_CREATED, etc.
  entity    String   // Customer, Booking, etc.
  entityId  String?  // ID of affected entity
  details   String?  @db.Text  // JSON details

  // Context
  ipAddress String?
  userId    String?  // Future: authenticated dealer ID

  // Timestamp
  createdAt DateTime @default(now())

  // Indexes for querying
  @@index([entity, entityId])
  @@index([createdAt])
}
```

**Audit Log Events:**

| Action | Description |
|--------|-------------|
| `BANKID_AUTH` | Customer authenticated with BankID |
| `BANKID_SIGN` | Customer signed document |
| `CUSTOMER_CREATED` | New customer record created |
| `CUSTOMER_UPDATED` | Customer data modified |
| `BOOKING_CREATED` | New booking created |
| `BOOKING_CANCELLED` | Booking cancelled |
| `ROARING_LOOKUP` | Roaring.io API called |

---

### Database Setup

**SQL Setup File**: `/supabase-setup.sql`

Provides:
- Complete table creation
- 8 dummy customers
- 9 sample bookings
- 9 audit log entries
- Realistic Swedish test data

**Quick Setup:**
```bash
# 1. Create database
createdb ava_mc_booking

# 2. Run Prisma migrations
npx prisma migrate dev

# 3. Populate with dummy data (optional)
psql ava_mc_booking < supabase-setup.sql

# 4. Open Prisma Studio
npx prisma studio
```

---

## API Endpoints and Routes

### BankID Endpoints

#### 1. POST `/api/bankid/auth`

**Purpose**: Initiate BankID authentication or signing

**Request Body:**
```typescript
{
  mode: 'auth' | 'sign',
  userVisibleData?: string  // Required for mode='sign'
}
```

**Example (Authentication):**
```json
{
  "mode": "auth"
}
```

**Example (Signing):**
```json
{
  "mode": "sign",
  "userVisibleData": "Jag godkänner köpeavtalet för Ducati Panigale V4, pris: 250 000 SEK"
}
```

**Response (200 OK):**
```typescript
{
  orderRef: string,           // "a1b2c3d4-..."
  autoStartToken: string,     // For same-device auth
  qrStartToken: string,       // For QR generation
  qrStartSecret: string       // For HMAC QR animation
}
```

**Features:**
- Detects end-user IP from headers (`x-forwarded-for`, `x-real-ip`)
- Supports test and production environments
- Mock mode available (`BANKID_MOCK_MODE=true`)
- mTLS authentication with BankID

**Error Responses:**
```typescript
// 400 Bad Request
{ error: "mode is required" }
{ error: "userVisibleData required for sign mode" }

// 500 Internal Server Error
{ error: "BankID auth failed: ..." }
```

---

#### 2. POST `/api/bankid/collect`

**Purpose**: Poll for authentication status and retrieve user data

**Request Body:**
```typescript
{
  orderRef: string  // From /auth response
}
```

**Response (Pending):**
```typescript
{
  status: 'pending',
  hintCode: 'outstandingTransaction' | 'userSign' | 'started',
  message: 'Starta BankID-appen'  // Localized Swedish
}
```

**Response (Complete):**
```typescript
{
  status: 'complete',
  user: {
    personalNumber: '199001011234',
    givenName: 'Anna',
    surname: 'Andersson',
    name: 'Anna Andersson',
    dateOfBirth: '1990-01-01'  // Extracted from personnummer
  },
  device: {
    ipAddress: '192.168.1.100'
  },
  risk: 'low' | 'moderate' | 'high',
  bankIdIssueDate: '2023-06-15',
  signatureAvailable: true,
  ocspAvailable: true,

  // Roaring.io enrichment (optional)
  roaring?: {
    address?: {
      street: 'Storgatan 1',
      postalCode: '11122',
      city: 'Stockholm',
      country: 'SE'
    },
    gender?: 'M' | 'F',
    citizenship?: 'SE',
    status?: 'Active',
    protectedIdentity?: false,
    deceased?: false
  }
}
```

**Response (Failed):**
```typescript
{
  status: 'failed',
  hintCode: 'expiredTransaction' | 'userCancel' | 'certificateErr',
  message: 'BankID-sessionen har gått ut'
}
```

**Polling Interval:** Every 2 seconds (recommended by BankID)

**Features:**
- Automatic Roaring.io enrichment on completion
- Combines BankID + Roaring.io data in single response
- Handles all BankID hint codes
- Graceful fallback if Roaring.io fails

---

#### 3. POST `/api/bankid/cancel`

**Purpose**: Cancel ongoing authentication

**Request Body:**
```typescript
{
  orderRef: string
}
```

**Response:**
```typescript
{ success: true }
```

**Use Cases:**
- User clicks "Cancel" button
- Timeout reached (3 minutes)
- User wants to restart with different method

---

#### 4. GET `/api/bankid/events/[orderRef]`

**Purpose**: Server-Sent Events (SSE) for real-time updates

**Request:**
```
GET /api/bankid/events/abc123
```

**Response:** Event stream

```
event: status
data: {"status":"pending","hintCode":"outstandingTransaction"}

event: status
data: {"status":"complete","user":{...}}
```

**Use Case:** Alternative to polling for real-time updates

---

### Roaring.io Endpoints

#### 1. GET/POST `/api/roaring/person`

**Purpose**: Retrieve person information from population register

**Query Parameters (GET):**
```
?ssn=199001011234&country=SE
```

**Request Body (POST):**
```typescript
{
  ssn: string,              // Personnummer (YYYYMMDDXXXX)
  country?: 'SE' | 'NO' | 'DK' | 'FI'
}
```

**Response (Success):**
```typescript
{
  success: true,
  data: {
    ssn: '199001011234',
    name: {
      first: 'Anna',
      last: 'Andersson',
      full: 'Anna Andersson'
    },
    address: {
      street: 'Storgatan 1',
      postalCode: '11122',
      city: 'Stockholm',
      country: 'SE'
    },
    birthDate: '1990-01-01',
    gender: 'F',
    status: 'Active',
    protectedIdentity: false,
    deceased: false
  },
  metadata: {
    requestId: 'req_abc123',
    timestamp: '2026-02-18T12:00:00Z',
    creditsUsed: 1
  }
}
```

**Response (Error):**
```typescript
{
  success: false,
  error: {
    code: 'HTTP_404' | 'REQUEST_FAILED',
    message: 'Person not found'
  }
}
```

---

#### 2. GET/POST `/api/roaring/company`

**Purpose**: Retrieve company information

**Query Parameters (GET):**
```
?orgNumber=556789-1234&country=SE
```

**Supported Countries:** SE, NO, DK, FI, ES

**Response:** Similar structure to person endpoint

---

#### 3. GET/POST `/api/roaring/pep`

**Purpose**: Check if person is Politically Exposed Person

**Query Parameters (GET):**
```
?ssn=199001011234&country=SE
```

**Response:**
```typescript
{
  success: true,
  data: {
    isPEP: false,
    matches: [],
    riskLevel: 'Low'
  }
}
```

---

## Authentication and Authorization Flow

### Complete BankID Authentication Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌──────────────┐
│   Browser   │         │   Backend    │         │   BankID    │         │  Roaring.io  │
│  (Customer) │         │  API Routes  │         │   Servers   │         │   API        │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘         └──────┬───────┘
       │                       │                        │                        │
       │  1. Click "BankID"    │                        │                        │
       ├──────────────────────>│                        │                        │
       │                       │                        │                        │
       │  2. POST /auth        │                        │                        │
       ├──────────────────────>│                        │                        │
       │                       │                        │                        │
       │                       │  3. Mutual TLS Auth    │                        │
       │                       │  POST /rp/v6.0/auth    │                        │
       │                       ├───────────────────────>│                        │
       │                       │                        │                        │
       │                       │  4. orderRef + tokens  │                        │
       │                       │<───────────────────────┤                        │
       │                       │                        │                        │
       │  5. QR tokens returned│                        │                        │
       │<──────────────────────┤                        │                        │
       │                       │                        │                        │
       │  6. Generate QR code  │                        │                        │
       │  HMAC-SHA256 animation│                        │                        │
       │  (every 1 second)     │                        │                        │
       │                       │                        │                        │
       │  7. Customer scans QR │                        │                        │
       │  with BankID app      │                        │                        │
       │                       │                        │                        │
       │  8. Start polling     │                        │                        │
       │  POST /collect        │                        │                        │
       │  (every 2 seconds)    │                        │                        │
       ├──────────────────────>│                        │                        │
       │                       │                        │                        │
       │                       │  9. Poll BankID        │                        │
       │                       │  POST /rp/v6.0/collect │                        │
       │                       ├───────────────────────>│                        │
       │                       │                        │                        │
       │                       │  10. status: pending   │                        │
       │  11. "Starta BankID"  │<───────────────────────┤                        │
       │<──────────────────────┤                        │                        │
       │                       │                        │                        │
       │  [Customer opens app] │                        │                        │
       │                       │                        │                        │
       │  12. POST /collect    │                        │                        │
       ├──────────────────────>│  13. Poll              │                        │
       │                       ├───────────────────────>│                        │
       │  14. "Skriv säkerhets-│  15. userSign          │                        │
       │  kod"                 │<───────────────────────┤                        │
       │<──────────────────────┤                        │                        │
       │                       │                        │                        │
       │  [Customer enters PIN]│                        │                        │
       │                       │                        │                        │
       │  16. POST /collect    │                        │                        │
       ├──────────────────────>│  17. Poll              │                        │
       │                       ├───────────────────────>│                        │
       │                       │                        │                        │
       │                       │  18. status: complete  │                        │
       │                       │  + user data           │                        │
       │                       │<───────────────────────┤                        │
       │                       │                        │                        │
       │                       │  19. Enrich with Roaring.io                     │
       │                       │  POST /v2/population-register/se/person        │
       │                       ├────────────────────────────────────────────────>│
       │                       │                        │                        │
       │                       │  20. Address + additional data                  │
       │                       │<────────────────────────────────────────────────┤
       │                       │                        │                        │
       │  21. Complete result  │                        │                        │
       │  BankID + Roaring.io  │                        │                        │
       │<──────────────────────┤                        │                        │
       │                       │                        │                        │
       │  22. Auto-fill form   │                        │                        │
       │  with verified data   │                        │                        │
       │                       │                        │                        │
```

### Security Measures

#### 1. Mutual TLS (mTLS)
- Backend uses .p12 certificate to authenticate with BankID
- Prevents impersonation
- Test cert: `FPTestcert4_20230629.p12` (passphrase: qwerty123)
- Production cert: Obtained from bank

#### 2. End-User IP Verification
- Customer's IP address captured from headers
- Sent to BankID for security analysis
- Prevents remote authentication attacks

#### 3. Risk Assessment
- BankID returns risk level: `low`, `moderate`, `high`
- Based on:
  - Device fingerprinting
  - IP geolocation
  - Authentication patterns
  - Certificate age

#### 4. Legal Proof Storage
- **BankID Signature**: Cryptographic proof of authentication
- **OCSP Response**: Certificate was valid at auth time
- Stored in database for legal disputes

#### 5. Audit Logging
- All authentication events logged
- GDPR compliance
- Includes: IP address, timestamp, action, result

#### 6. Session Management
- **Timeout**: 3 minutes
- **Auto-cleanup**: Expired sessions cancelled
- **Nonce**: Prevents session fixation

#### 7. OAuth 2.0 (Roaring.io)
- Client Credentials flow
- Access tokens cached until expiration
- Automatic token refresh
- Credentials stored in environment variables

---

## Frontend Components and Pages

### Pages

#### 1. `/app/page.tsx` - Home/Demo Page

**Purpose**: Interactive demo of BankID functionality

**Features:**
- 3 demo use cases with cards:
  1. **Customer Identification** (mode: auth)
  2. **Sign Waiver** (mode: sign, text: "Jag godkänner...")
  3. **Sign Purchase Agreement** (mode: sign)
- Last authentication result display
- Setup instructions
- Embedded NewLeadPage component

**State:**
```typescript
const [activeDemo, setActiveDemo] = useState<DemoType | null>(null);
const [lastResult, setLastResult] = useState<BankIDResult | null>(null);
```

**Component Structure:**
```tsx
<div className="grid grid-cols-3 gap-4">
  <DemoCard
    title="Customer Identification"
    description="Quick customer ID verification"
    tag="POST /auth"
    onClick={() => setActiveDemo('auth')}
  />
  {/* ... more cards */}
</div>

{activeDemo && (
  <BankIDModal
    mode={activeDemo}
    onComplete={(result) => setLastResult(result)}
    onCancel={() => setActiveDemo(null)}
  />
)}

{lastResult && (
  <div>
    <Field label="Name" value={lastResult.user.name} source="BankID" />
    <Field label="Address" value={lastResult.roaring?.address} source="Roaring.io" />
  </div>
)}
```

**File Location**: `/Users/andrewkalumba/Documents/2026internship/ava-mc-booking-system/app/page.tsx`

---

#### 2. `/app/sales/leads/new/page.tsx` - New Lead Creation

**Purpose**: Lead management with automated data enrichment

**Features:**

**Tab 1: BankID (Recommended)**
- One-click BankID authentication
- Auto-fills ~80% of form
- Data source badges
- Manual fields: Email, Phone, Notes

**Tab 2: Phone Lookup**
- Quick search by phone number
- Checks existing customer database
- Fallback to manual entry

**Tab 3: Manual Entry**
- Full form manual input
- No auto-fill
- For walk-in customers without BankID

**Form Structure:**
```typescript
interface FormData {
  // Auto-filled from BankID
  name: string;
  personnummer: string;
  dateOfBirth: string;

  // Auto-filled from Roaring.io
  address: string;

  // Manual entry
  email: string;
  phone: string;
  source: 'Website' | 'Phone' | 'Walk-in';
  interest: string;
  notes: string;
}
```

**Vehicle Matching Algorithm:**
```typescript
// 92% match based on:
// - Age from personnummer
// - Previous purchase history
// - Interest keywords
// - Price range
const suggestedVehicle = {
  model: 'Ducati Panigale V4',
  matchPercentage: 92,
  reason: 'Based on age group and sportbike interest'
};
```

**File Location**: `/Users/andrewkalumba/Documents/2026internship/ava-mc-booking-system/app/sales/leads/new/page.tsx`

---

### Components

#### 1. `<BankIDModal />` - Core Authentication Component

**File**: `/components/bankIdModel.tsx`

**Props:**
```typescript
interface BankIDModalProps {
  mode: 'auth' | 'sign';
  signText?: string;                    // Required for mode='sign'
  title?: string;                       // Modal title
  subtitle?: string;                    // Modal subtitle
  onComplete: (result: BankIDResult) => void;
  onCancel: () => void;
  autoStart?: boolean;                  // Auto-start on mount
}
```

**States:**
```typescript
type ModalState = 'idle' | 'scanning' | 'complete' | 'failed';

const [state, setState] = useState<ModalState>('idle');
const [orderRef, setOrderRef] = useState<string | null>(null);
const [qrCode, setQRCode] = useState<string>('');
const [statusMessage, setStatusMessage] = useState<string>('');
const [result, setResult] = useState<BankIDResult | null>(null);
```

**QR Code Animation Logic:**

```typescript
// 1. Start authentication
const authResponse = await fetch('/api/bankid/auth', {
  method: 'POST',
  body: JSON.stringify({ mode, userVisibleData: signText })
});
const { qrStartToken, qrStartSecret } = await authResponse.json();

// 2. Generate animated QR (every 1 second)
useEffect(() => {
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    // HMAC-SHA256 generation
    const qrAuthCode = CryptoJS.HmacSHA256(
      elapsed.toString(),
      qrStartSecret
    ).toString(CryptoJS.enc.Hex);

    // QR data format
    const qrData = `bankid.${qrStartToken}.${elapsed}.${qrAuthCode}`;

    // Generate QR code SVG
    QRCode.toString(qrData, { type: 'svg' }, (err, svg) => {
      setQRCode(svg);
    });
  }, 1000);

  return () => clearInterval(interval);
}, [qrStartToken, qrStartSecret]);
```

**Polling Logic:**

```typescript
// Poll every 2 seconds
useEffect(() => {
  if (!orderRef) return;

  const interval = setInterval(async () => {
    const response = await fetch('/api/bankid/collect', {
      method: 'POST',
      body: JSON.stringify({ orderRef })
    });
    const data = await response.json();

    if (data.status === 'pending') {
      setStatusMessage(data.message);
    } else if (data.status === 'complete') {
      setResult(data);
      setState('complete');
      onComplete(data);
      clearInterval(interval);
    } else if (data.status === 'failed') {
      setState('failed');
      setStatusMessage(data.message);
      clearInterval(interval);
    }
  }, 2000);

  // Timeout after 3 minutes
  const timeout = setTimeout(() => {
    clearInterval(interval);
    cancelAuth();
  }, 180000);

  return () => {
    clearInterval(interval);
    clearTimeout(timeout);
  };
}, [orderRef]);
```

**Same-Device Authentication:**

```typescript
const sameDeviceUrl = `bankid:///?autostarttoken=${autoStartToken}&redirect=null`;

<a href={sameDeviceUrl} className="text-blue-600">
  Öppna BankID på den här enheten
</a>
```

**UI States:**

| State | UI Display |
|-------|------------|
| `idle` | "Start BankID" button |
| `scanning` | QR code + status message + Cancel button |
| `complete` | Success checkmark + user data |
| `failed` | Error message + Retry button |

**File Location**: `/Users/andrewkalumba/Documents/2026internship/ava-mc-booking-system/components/bankIdModel.tsx`

---

#### 2. `<Sidebar />` - Navigation Component

**File**: `/components/Sidebar.tsx`

**Menu Items:**

```typescript
const menuItems = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '🏍️', label: 'Inventory', href: '/inventory' },
  { icon: '📦', label: 'Purchase Orders', href: '/orders' },
  { icon: '💼', label: 'Sales Pipeline', href: '/sales' },
  { icon: '👥', label: 'Customers', href: '/customers' },
  { icon: '💰', label: 'Invoices', href: '/invoices' },
  { icon: '📄', label: 'Documents', href: '/documents' },
  { icon: '📈', label: 'Analytics', href: '/analytics' },
  { icon: '⚙️', label: 'Settings', href: '/settings' },
  { icon: '👤', label: 'Users', href: '/users' },
  { icon: '📋', label: 'Audit Log', href: '/audit' },
];
```

**Features:**
- Active route highlighting (blue background)
- User info display (name, role)
- Responsive design
- Icon + label navigation

**File Location**: `/Users/andrewkalumba/Documents/2026internship/ava-mc-booking-system/components/Sidebar.tsx`

---

#### 3. `<Field />` - Data Source Badge Component

**File**: `/components/Field.tsx`

**Props:**
```typescript
interface FieldProps {
  label: string;
  value: string | undefined;
  source: 'BankID' | 'Roaring.io' | 'Personnummer' | 'Device' | 'Manual';
}
```

**Badge Colors:**

| Source | Color | Meaning |
|--------|-------|---------|
| BankID | Blue (`bg-blue-100 text-blue-800`) | Government-verified |
| Roaring.io | Orange (`bg-orange-100 text-orange-800`) | Population register |
| Personnummer | Purple (`bg-purple-100 text-purple-800`) | Derived from SSN |
| Device | Gray (`bg-gray-100 text-gray-800`) | Device info |
| Manual | Yellow (`bg-yellow-100 text-yellow-800`) | Manual entry |

**Usage:**
```tsx
<Field
  label="Name"
  value="Anna Andersson"
  source="BankID"
/>

<Field
  label="Address"
  value="Storgatan 1, 111 22 Stockholm"
  source="Roaring.io"
/>
```

**File Location**: `/Users/andrewkalumba/Documents/2026internship/ava-mc-booking-system/components/Field.tsx`

---

#### 4. `<DemoCard />` - Demo Use Case Card

**File**: `/components/DemoCard.tsx`

**Props:**
```typescript
interface DemoCardProps {
  title: string;
  description: string;
  tag: string;           // e.g., "POST /auth"
  tagColor: string;      // Tailwind color class
  onClick: () => void;
}
```

**Example Usage:**
```tsx
<DemoCard
  title="Customer Identification"
  description="Verify customer identity with BankID"
  tag="POST /auth"
  tagColor="bg-blue-100 text-blue-800"
  onClick={() => setActiveDemo('auth')}
/>
```

**File Location**: `/Users/andrewkalumba/Documents/2026internship/ava-mc-booking-system/components/DemoCard.tsx`

---

## Configuration Files and Environment Variables

### Environment Variables (`.env`)

**File**: `.env` (gitignored)
**Template**: `.env.example` (committed to repo)

```env
# ============================================
# BankID Configuration
# ============================================

# Environment: "test" or "production"
BANKID_ENV=test

# Path to .p12 certificate file
# Test: Download from https://www.bankid.com/en/utvecklare/test
# File: FPTestcert4_20230629.p12
BANKID_PFX_PATH=./certs/FPTestcert4_20230629.p12

# Certificate passphrase
# Test: qwerty123
# Production: From your bank
BANKID_PFX_PASSPHRASE=qwerty123

# Mock mode (no certificate required)
# Use for development without BankID certificate
BANKID_MOCK_MODE=false

# ============================================
# Application URLs
# ============================================

# Base URL (used by NextAuth and BankID redirects)
NEXTAUTH_URL=http://localhost:3000

# Public domain (without protocol)
NEXT_PUBLIC_DOMAIN=localhost:3000

# ============================================
# Database Configuration
# ============================================

# PostgreSQL connection string
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://postgres:password@localhost:5432/ava_mc_booking

# ============================================
# Roaring.io Configuration
# ============================================

# OAuth 2.0 Client Credentials
# Get from: https://developer.roaring.io/
# See: ROARING_API_SETUP.md

# For SANDBOX (development/testing):
ROARING_CLIENT_ID=74a4300f-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ROARING_CLIENT_SECRET=f7efe287-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: Override base URL (e.g., for sandbox)
# ROARING_API_BASE_URL=https://sandbox.roaring.io

# For PRODUCTION:
# 1. Create production credentials in developer portal
# 2. Set up billing and purchase credits
# 3. Replace above with production credentials
```

---

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Key Settings:**

- **`paths: { "@/*": ["./*"] }`**: Import alias (e.g., `import { auth } from '@/lib/bankid/client'`)
- **`strict: true`**: Full TypeScript type checking
- **`module: "esnext"`**: Modern ES modules
- **`jsx: "preserve"`**: Let Next.js handle JSX transformation

---

### Package.json Dependencies

**File**: `/package.json`

```json
{
  "name": "ava-mc-booking-system",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "next": "16.1.6",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "qrcode": "^1.5.4",
    "crypto-js": "^4.2.0",
    "@prisma/client": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/qrcode": "^1.5.6",
    "@types/crypto-js": "^4.2.2",
    "tailwindcss": "^4",
    "postcss": "^8",
    "autoprefixer": "^10",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "prisma": "latest"
  }
}
```

---

### Tailwind CSS Configuration

**File**: `/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom brand colors
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### Next.js Configuration

**File**: `/next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Disable powered by header
  poweredByHeader: false,

  // Enable SWC minification
  swcMinify: true,
};

export default nextConfig;
```

---

## Integration Points

### 1. BankID Integration

**Official Documentation**: https://www.bankid.com/en/utvecklare/guider/teknisk-integrationsguide

#### Endpoints

| Environment | Base URL |
|-------------|----------|
| Test | `https://appapi2.test.bankid.com/rp/v6.0` |
| Production | `https://appapi2.bankid.com/rp/v6.0` |

#### Authentication Method

**Mutual TLS (mTLS)** with .p12 certificate

**Test Certificate:**
- File: `FPTestcert4_20230629.p12`
- Download: https://www.bankid.com/en/utvecklare/test
- Passphrase: `qwerty123`
- Valid until: 2023-06-29 (renewed periodically)

**Production Certificate:**
- Obtained from your bank (Swedbank, SEB, Nordea, etc.)
- Requires business account
- Annual renewal
- Custom passphrase

#### API Methods

**POST `/rp/v6.0/auth`**
```json
{
  "endUserIp": "192.168.1.100",
  "requirement": {
    "cardReader": "class1"
  }
}
```

**POST `/rp/v6.0/sign`**
```json
{
  "endUserIp": "192.168.1.100",
  "userVisibleData": "Base64EncodedText",
  "requirement": {
    "cardReader": "class1"
  }
}
```

**POST `/rp/v6.0/collect`**
```json
{
  "orderRef": "a1b2c3d4-..."
}
```

**POST `/rp/v6.0/cancel`**
```json
{
  "orderRef": "a1b2c3d4-..."
}
```

#### Hint Codes Reference

| Code | Swedish Message | English Meaning |
|------|-----------------|-----------------|
| `outstandingTransaction` | Starta BankID-appen | Open the BankID app |
| `noClient` | Starta BankID-appen | BankID not started |
| `started` | Söker efter BankID | Searching for BankID |
| `userSign` | Skriv in din säkerhetskod | Enter your security code |
| `userMrtd` | Identifiera dig med ID-kort | Identify with ID card |
| `processing` | Behandlar din identifiering | Processing identification |
| `expiredTransaction` | BankID-sessionen har gått ut | Session expired |
| `certificateErr` | BankID-appen är inaktuell | Update BankID app |
| `userCancel` | Inloggning avbruten | Authentication cancelled |
| `cancelled` | Inloggning avbruten | Cancelled by RP |
| `startFailed` | BankID-appen kunde inte startas | Failed to start |

#### Implementation Details

**File**: `/lib/bankid/client.ts`

```typescript
import https from 'https';
import fs from 'fs';

// Load .p12 certificate
const pfxPath = process.env.BANKID_PFX_PATH!;
const pfxPassphrase = process.env.BANKID_PFX_PASSPHRASE!;
const pfxBuffer = fs.readFileSync(pfxPath);

// Create HTTPS agent with mTLS
const agent = new https.Agent({
  pfx: pfxBuffer,
  passphrase: pfxPassphrase,
  rejectUnauthorized: false, // Accept BankID's self-signed cert
});

// Make authenticated request
export async function auth(endUserIp: string) {
  const response = await fetch(`${BASE_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endUserIp }),
    // @ts-ignore - Node 18+ supports agent in fetch
    agent,
  });

  return response.json();
}
```

---

### 2. Roaring.io Integration

**Official Documentation**: https://developer.roaring.io/

#### Authentication

**OAuth 2.0 Client Credentials Flow**

```typescript
// 1. Get access token
POST https://api.roaring.io/oauth/token
Authorization: Basic base64(clientId:clientSecret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials

// Response:
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}

// 2. Use token in API requests
GET https://api.roaring.io/v2/population-register/se/person
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "ssn": "199001011234"
}
```

#### Token Caching

**File**: `/lib/roaring/client.ts`

```typescript
class RoaringAPIClient {
  private tokenCache: CachedToken | null = null;

  private async getAccessToken(): Promise<string> {
    // Return cached token if valid (with 60-second buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.accessToken;
    }

    // Request new token
    const credentials = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await response.json();

    // Cache token
    this.tokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    };

    return tokenData.access_token;
  }
}
```

#### Endpoints

**Person Lookup:**
```
POST /v2/population-register/{country}/person
{
  "ssn": "199001011234"
}
```

**Company Lookup:**
```
GET /v2/company/{country}/{orgNumber}
```

**PEP Check:**
```
POST /v2/pep/{country}
{
  "ssn": "199001011234"
}
```

#### Pricing

| API | Credits | Sandbox |
|-----|---------|---------|
| Person Lookup | 1 | Free |
| Company Lookup | 1-2 | Free |
| PEP Check | 2-5 | Free |
| AML/Sanctions | 5-10 | Free |

**Sandbox:** Free unlimited test data
**Production:** Credit-based pricing, ~500 SEK for 100 credits

#### Error Handling

```typescript
try {
  const result = await roaringClient.getPersonBySSN(personnummer, 'SE');

  if (result.success) {
    console.log('Address:', result.data.address);
  } else {
    console.error('Error:', result.error.message);
  }
} catch (error) {
  // Network error or OAuth failure
  console.error('Request failed:', error);
}
```

**Graceful Fallback:**

If Roaring.io fails, BankID data is still returned without enrichment:

```typescript
// In /api/bankid/collect
let roaringData = null;
try {
  const roaringResult = await roaringClient.getPersonBySSN(ssn, 'SE');
  if (roaringResult.success) {
    roaringData = roaringResult.data;
  }
} catch (error) {
  console.warn('Roaring.io failed, continuing without enrichment');
  // Don't fail the whole request
}

return {
  status: 'complete',
  user: bankIdData,
  roaring: roaringData, // May be null
};
```

---

### 3. Database Integration (Prisma)

#### Setup Commands

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Create database
createdb ava_mc_booking

# 4. Run migrations
npx prisma migrate dev --name init

# 5. (Optional) Populate with dummy data
psql ava_mc_booking < supabase-setup.sql

# 6. Open Prisma Studio (GUI)
npx prisma studio
```

#### Usage Examples

**Create Customer:**
```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const customer = await prisma.customer.create({
  data: {
    personalNumber: '199001011234',
    firstName: 'Anna',
    lastName: 'Andersson',
    email: 'anna@example.com',
    phone: '+46701234567',
    address: 'Storgatan 1',
    city: 'Stockholm',
    postalCode: '11122',
    source: 'BANKID',
    lastBankIdAuth: new Date(),
    bankIdSignature: '...',
  },
});
```

**Find Customer by Personnummer:**
```typescript
const customer = await prisma.customer.findUnique({
  where: { personalNumber: '199001011234' },
  include: { bookings: true },
});
```

**Create Booking:**
```typescript
const booking = await prisma.booking.create({
  data: {
    customerId: customer.id,
    motorcycleModel: 'Ducati Panigale V4',
    bookingDate: new Date('2026-03-01'),
    testRideDate: new Date('2026-03-05'),
    status: 'CONFIRMED',
    notes: 'Interested in red color',
  },
});
```

**Audit Log:**
```typescript
await prisma.auditLog.create({
  data: {
    action: 'BANKID_AUTH',
    entity: 'Customer',
    entityId: customer.id,
    details: JSON.stringify({ risk: 'low', method: 'QR' }),
    ipAddress: '192.168.1.100',
  },
});
```

---

## Data Flow Between Components

### Complete End-to-End Flow

```
┌────────────────────────────────────────────────────────────────┐
│                      1. USER INTERACTION                        │
│  Customer clicks "BankID (rekommenderat)" button                │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│                   2. FRONTEND STATE CHANGE                      │
│  NewLeadPage: setShowBankID(true)                               │
│  Renders: <BankIDModal mode="auth" autoStart={true} />         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              3. BANKID MODAL: AUTO-START                        │
│  useEffect hook detects autoStart prop                          │
│  Calls: handleStart()                                           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              4. API CALL: POST /api/bankid/auth                 │
│  Request body: { mode: "auth" }                                 │
│  Headers: x-forwarded-for, x-real-ip (for endUserIp)           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│           5. BACKEND: /api/bankid/auth/route.ts                 │
│  • Extract endUserIp from headers                               │
│  • Load .p12 certificate                                        │
│  • Create HTTPS agent with mTLS                                 │
│  • Call BankID: POST /rp/v6.0/auth                              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              6. BANKID SERVERS RESPONSE                         │
│  Returns:                                                       │
│  • orderRef: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"            │
│  • autoStartToken: "xyz123..."                                  │
│  • qrStartToken: "abc456..."                                    │
│  • qrStartSecret: "def789..."                                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              7. FRONTEND: QR CODE GENERATION                    │
│  useEffect detects qrStartToken and qrStartSecret               │
│  Starts 1-second interval timer                                 │
│                                                                 │
│  Every second:                                                  │
│  • elapsed = (now - startTime) / 1000                           │
│  • qrAuthCode = HMAC-SHA256(elapsed, qrStartSecret)            │
│  • qrData = "bankid.{token}.{elapsed}.{qrAuthCode}"            │
│  • Generate QR SVG using qrcode library                         │
│  • setQRCode(svg)                                               │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              8. CUSTOMER SCANS QR CODE                          │
│  • Opens BankID app on mobile                                   │
│  • Scans animated QR code                                       │
│  • BankID app connects to BankID servers                        │
│  • BankID servers link scan to orderRef                         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│              9. FRONTEND: START POLLING                         │
│  useEffect detects orderRef                                     │
│  Starts 2-second interval timer                                 │
│  Also starts 3-minute timeout                                   │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          10. API CALL: POST /api/bankid/collect                 │
│  Request body: { orderRef: "a1b2c3d4..." }                      │
│  Called every 2 seconds                                         │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│         11. BACKEND: /api/bankid/collect/route.ts               │
│  • Call BankID: POST /rp/v6.0/collect                           │
│  • Receives status from BankID                                  │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          12. BANKID RESPONSE: status = "pending"                │
│  hintCode: "outstandingTransaction"                             │
│  Returns to frontend: { status: "pending", message: "..." }    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          13. FRONTEND DISPLAYS STATUS                           │
│  setStatusMessage("Starta BankID-appen")                        │
│  UI shows: spinning icon + status message                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          14. CUSTOMER OPENS BANKID APP                          │
│  hintCode changes to: "userSign"                                │
│  Frontend updates: "Skriv in din säkerhetskod"                 │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          15. CUSTOMER ENTERS PIN                                │
│  BankID app processes authentication                            │
│  BankID servers verify identity                                 │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          16. BANKID RESPONSE: status = "complete"               │
│  Returns complete user data:                                    │
│  • user.personalNumber: "199001011234"                          │
│  • user.name: "Anna Andersson"                                  │
│  • user.givenName: "Anna"                                       │
│  • user.surname: "Andersson"                                    │
│  • device.ipAddress: "192.168.1.100"                            │
│  • risk: "low"                                                  │
│  • signature: "..."                                             │
│  • ocspResponse: "..."                                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          17. BACKEND: ROARING.IO ENRICHMENT                     │
│  getRoaringClient().getPersonBySSN("199001011234", "SE")        │
│                                                                 │
│  OAuth flow:                                                    │
│  • Check token cache (valid?)                                   │
│  • If expired: POST /oauth/token with Basic auth               │
│  • Cache new access token                                       │
│  • POST /v2/population-register/se/person with Bearer token    │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          18. ROARING.IO RESPONSE                                │
│  Returns:                                                       │
│  • address: { street: "Storgatan 1", postalCode: "11122",      │
│               city: "Stockholm", country: "SE" }                │
│  • gender: "F"                                                  │
│  • status: "Active"                                             │
│  • protectedIdentity: false                                     │
│  • deceased: false                                              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          19. BACKEND: COMBINE DATA                              │
│  Merge BankID + Roaring.io data:                                │
│  {                                                              │
│    status: "complete",                                          │
│    user: { ...bankIdData },                                     │
│    roaring: { ...roaringData }                                  │
│  }                                                              │
│  Return to frontend                                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          20. FRONTEND: onComplete CALLBACK                      │
│  BankIDModal calls: onComplete(result)                          │
│  NewLeadPage receives complete result                           │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          21. FRONTEND: AUTO-FILL FORM                           │
│  setFormData({                                                  │
│    name: result.user.name,                    // BankID         │
│    personnummer: result.user.personalNumber,  // BankID         │
│    dateOfBirth: result.user.dateOfBirth,      // Derived        │
│    address: `${result.roaring.address.street},                 │
│              ${result.roaring.address.postalCode}               │
│              ${result.roaring.address.city}`, // Roaring.io     │
│    email: '',                                 // Manual          │
│    phone: '',                                 // Manual          │
│  })                                                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          22. UI UPDATES WITH DATA SOURCE BADGES                 │
│  <Field label="Name" value="Anna Andersson" source="BankID" /> │
│  <Field label="Address" value="..." source="Roaring.io" />     │
│  <Field label="Email" value="" source="Manual" />               │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          23. DEALER COMPLETES MANUAL FIELDS                     │
│  • Adds email: anna@example.com                                 │
│  • Adds phone: +46701234567                                     │
│  • Adds notes: "Interested in Ducati Panigale V4"              │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          24. VEHICLE MATCHING ALGORITHM                         │
│  Analyze:                                                       │
│  • Age: 36 (from personnummer)                                  │
│  • Keywords: "sportbike", "performance"                         │
│  • Price range: High                                            │
│                                                                 │
│  Suggests: Ducati Panigale V4 (92% match)                       │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          25. SUBMIT LEAD                                        │
│  Click: "Skapa lead" button                                     │
│  POST /api/customers (to be implemented)                        │
│                                                                 │
│  Database saves:                                                │
│  • Customer record (source: "BANKID")                           │
│  • Audit log (action: "CUSTOMER_CREATED")                       │
│  • BankID metadata (signature, OCSP)                            │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────────┐
│          26. SUCCESS CONFIRMATION                               │
│  UI shows: "Lead skapad framgångsrikt!"                         │
│  Redirect: /sales/leads or /customers/{id}                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Production Checklist

Before deploying to production:

### 1. BankID Production Setup
- [ ] Obtain production .p12 certificate from bank
- [ ] Update `BANKID_ENV=production`
- [ ] Update `BANKID_PFX_PATH` to production cert
- [ ] Update `BANKID_PFX_PASSPHRASE`
- [ ] Enable HTTPS (required by BankID)
- [ ] Test with real personnummer

### 2. Roaring.io Production Setup
- [ ] Create production OAuth credentials
- [ ] Set up billing and purchase credits
- [ ] Update `ROARING_CLIENT_ID` (production)
- [ ] Update `ROARING_CLIENT_SECRET` (production)
- [ ] Set up usage alerts
- [ ] Test with real personnummer

### 3. Database
- [ ] Set up production PostgreSQL
- [ ] Update `DATABASE_URL`
- [ ] Run migrations: `npx prisma migrate deploy`
- [ ] Enable connection pooling
- [ ] Set up automated backups
- [ ] Configure read replicas (optional)

### 4. Security
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Set up firewall rules
- [ ] Configure CORS appropriately
- [ ] Enable rate limiting
- [ ] Set up DDoS protection
- [ ] Implement CSP headers
- [ ] Enable security headers (HSTS, X-Frame-Options, etc.)

### 5. GDPR Compliance
- [ ] Register with Datainspektionen (Swedish DPA)
- [ ] Create privacy policy
- [ ] Implement data retention policies
- [ ] Add cookie consent (if using cookies)
- [ ] Implement right to deletion
- [ ] Set up data export functionality
- [ ] Document data processing agreements

### 6. Monitoring & Logging
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure application monitoring
- [ ] Enable audit logging
- [ ] Set up uptime monitoring
- [ ] Configure alerts for errors
- [ ] Set up log aggregation

### 7. Performance
- [ ] Enable CDN for static assets
- [ ] Configure caching headers
- [ ] Optimize database queries
- [ ] Enable database indexes
- [ ] Set up Redis for sessions (optional)
- [ ] Configure load balancing (if needed)

### 8. Environment Variables
- [ ] Move all secrets to secure vault (AWS Secrets Manager, etc.)
- [ ] Never commit `.env` to version control
- [ ] Use different credentials for each environment
- [ ] Rotate credentials regularly

### 9. Testing
- [ ] Test BankID flow with production cert
- [ ] Test Roaring.io with production credentials
- [ ] Load test with expected traffic
- [ ] Test error scenarios
- [ ] Test timeout scenarios
- [ ] Verify audit logging

### 10. Documentation
- [ ] Update README with production setup
- [ ] Document deployment process
- [ ] Create runbook for common issues
- [ ] Document API endpoints
- [ ] Create user guide for dealers

---

## GDPR Compliance

### Data Protection Requirements

**Swedish Law: GDPR + Dataskyddslagen (2018:218)**

#### 1. Legal Basis for Processing

**BankID Authentication:**
- Legal basis: **Consent** or **Contractual necessity**
- Customer explicitly initiates authentication
- Purpose: Identity verification for purchase/booking

**Roaring.io Enrichment:**
- Legal basis: **Legitimate interest**
- Purpose: Accurate customer records, fraud prevention
- Balance test: Minimal data, official sources, customer benefit

#### 2. Data Categories

| Data Type | Source | Classification | Retention |
|-----------|--------|----------------|-----------|
| Personnummer | BankID | Sensitive | As long as customer relationship |
| Name | BankID | Personal | As long as customer relationship |
| Address | Roaring.io | Personal | As long as customer relationship |
| IP Address | Device | Personal | 12 months (audit) |
| BankID Signature | BankID | Personal | 7 years (legal) |
| Email, Phone | Manual | Personal | As long as customer relationship |

#### 3. Required Disclosures

**Privacy Policy Must Include:**
- What data is collected
- Why it's collected (purpose)
- Legal basis for processing
- How long it's retained
- Who it's shared with (Roaring.io, BankID)
- Customer rights (access, deletion, portability)
- How to exercise rights
- Contact information for DPO (if applicable)

**Example Privacy Notice:**

> "When you authenticate with BankID, we collect your name and personnummer from the Swedish government. We also retrieve your address from the Swedish population register (Folkbokföringen) via Roaring.io to ensure accurate customer records. This data is used to process your motorcycle purchase or booking. You have the right to access, correct, or delete your data at any time."

#### 4. Customer Rights

**Right to Access:**
```typescript
// Implement: GET /api/customers/{id}/data
// Return all data about the customer in JSON format
```

**Right to Deletion:**
```typescript
// Implement: DELETE /api/customers/{id}
// Must delete all personal data unless legal obligation to retain
// Exception: BankID signatures (7-year retention for legal proof)
```

**Right to Portability:**
```typescript
// Implement: GET /api/customers/{id}/export
// Return data in machine-readable format (JSON, CSV)
```

**Right to Rectification:**
```typescript
// Implement: PATCH /api/customers/{id}
// Allow customer to correct inaccurate data
```

#### 5. Data Processor Agreements

**Required Agreements:**
- **BankID**: Standard DPA (provided by BankID)
- **Roaring.io**: Data Processing Agreement (request from Roaring.io)
- **Database Host**: DPA with hosting provider (AWS, Azure, etc.)

#### 6. Data Retention Policies

**Recommended Retention:**

| Data | Retention Period | Reason |
|------|------------------|--------|
| Customer record | 3 years after last interaction | Legal, tax |
| BankID signature | 7 years | Legal proof |
| Audit logs | 12 months | Security |
| Booking history | 3 years | Accounting |
| Inactive customers | Delete after 3 years | GDPR minimization |

#### 7. Security Measures (Article 32)

**Technical Measures:**
- Encryption in transit (HTTPS/TLS)
- Encryption at rest (database encryption)
- Access controls (authentication, authorization)
- Audit logging
- Regular security updates

**Organizational Measures:**
- Staff training on GDPR
- Access on need-to-know basis
- Incident response plan
- Regular security audits

#### 8. Data Breach Notification

**Requirements:**
- Notify Datainspektionen within 72 hours
- Notify affected customers if high risk
- Document all breaches

**Incident Response Plan:**
```
1. Detect breach
2. Contain breach
3. Assess impact
4. Notify DPA (within 72h)
5. Notify customers (if high risk)
6. Document incident
7. Implement corrective measures
```

#### 9. Registration with Datainspektionen

**Required if:**
- Processing personnummer (yes, you are)
- Systematic monitoring (customer tracking)
- Large-scale processing

**How to Register:**
1. Visit: https://www.datainspektionen.se/
2. Complete registration form
3. Pay annual fee (~500-1000 SEK)
4. Maintain updated records

#### 10. Audit Logging (Implemented)

**AuditLog Model covers:**
- Who accessed data (userId)
- What action was performed
- When it happened (timestamp)
- What data was affected (entity, entityId)
- Context (IP address, details)

**Example Queries:**

```typescript
// Who accessed customer data?
await prisma.auditLog.findMany({
  where: {
    entity: 'Customer',
    entityId: customerId,
  },
  orderBy: { createdAt: 'desc' },
});

// All BankID authentications in last month
await prisma.auditLog.findMany({
  where: {
    action: 'BANKID_AUTH',
    createdAt: { gte: new Date('2026-01-18') },
  },
});
```

---

## File Locations Reference

### API Routes
```
/app/api/bankid/auth/route.ts
/app/api/bankid/collect/route.ts
/app/api/bankid/cancel/route.ts
/app/api/bankid/events/[orderRef]/route.ts
/app/api/roaring/person/route.ts
/app/api/roaring/company/route.ts
/app/api/roaring/pep/route.ts
```

### Pages
```
/app/page.tsx
/app/sales/leads/new/page.tsx
/app/layout.tsx
```

### Components
```
/components/bankIdModel.tsx
/components/Sidebar.tsx
/components/Field.tsx
/components/DemoCard.tsx
```

### Libraries
```
/lib/bankid/client.ts
/lib/bankid/qr.ts
/lib/bankid/mock.ts
/lib/roaring/client.ts
```

### Types
```
/types/bankid.ts
/types/roaring.ts
/types/lead.ts
/types/demo.ts
/types/index.ts
```

### Database
```
/prisma/schema.prisma
/supabase-setup.sql
```

### Configuration
```
/.env (gitignored)
/.env.example
/tsconfig.json
/tailwind.config.ts
/next.config.ts
/package.json
```

### Documentation
```
/README.md
/BANKID_SETUP.md
/ROARING_API_SETUP.md
/IMPLEMENTATION_SUMMARY.md
/QUICK_START_CHECKLIST.md
/SYSTEM_ARCHITECTURE.md (this file)
```

---

## Support and Resources

### Official Documentation
- **BankID**: https://www.bankid.com/en/utvecklare
- **Roaring.io**: https://developer.roaring.io/
- **Next.js**: https://nextjs.org/docs
- **Prisma**: https://www.prisma.io/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

### Test Resources
- **BankID Test Cert**: https://www.bankid.com/en/utvecklare/test
- **BankID Test App**: Available on iOS/Android app stores
- **Roaring.io Sandbox**: https://developer.roaring.io/ (free account)

### Compliance
- **Datainspektionen**: https://www.datainspektionen.se/
- **GDPR**: https://gdpr.eu/
- **Dataskyddslagen**: https://www.riksdagen.se/sv/dokument-lagar/dokument/svensk-forfattningssamling/lag-2018218-med-kompletterande-bestammelser_sfs-2018-218

---

**Document Version**: 1.0.0
**Last Updated**: February 18, 2026
**Maintained By**: AVA MC Development Team
