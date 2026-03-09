# Types Directory

This directory contains all centralized TypeScript type definitions for the AVA MC Booking System.

## Structure

```
types/
├── bankid.ts      # BankID authentication and signing types
├── roaring.ts     # Roaring.io API types
├── lead.ts        # Lead/Sales management types
├── demo.ts        # Demo page types
└── index.ts       # Central export file
```

## Usage

### Import from central types file (recommended)

```typescript
import type { BankIDResult, Demo, IdentificationMethod } from '@/types';
```

### Import from specific type file

```typescript
import type { BankIDResult } from '@/types/bankid';
import type { PersonData } from '@/types/roaring';
```

## Type Categories

### BankID Types (`bankid.ts`)
- `BankIDUser` - User information from BankID
- `BankIDResult` - Complete BankID authentication result
- `BankIDAuthResponse` - Response from auth/sign initiation
- `BankIDCollectResponse` - Response from collect endpoint
- `BankIDError` - Error response from BankID
- `BankIDStatus` - Status states for BankID flow
- `BankIDModalProps` - Props for BankIDModal component

### Roaring.io Types (`roaring.ts`)
- `RoaringConfig` - API client configuration
- `OAuthTokenResponse` - OAuth token response
- `CachedToken` - Cached authentication token
- `PersonData` - Person information from population register
- `RoaringPersonResponse` - Person lookup API response
- `RoaringCompanyResponse` - Company lookup API response

### Lead Types (`lead.ts`)
- `IdentificationMethod` - Customer identification methods
- `LeadFormData` - Lead form data structure

### Demo Types (`demo.ts`)
- `Demo` - Demo page states

## Migration

All existing files have been updated to import from this centralized types directory. The original type definitions have been removed or replaced with re-exports for backward compatibility.

## Best Practices

1. **Add new types here** - Don't define types inline in components
2. **Organize by domain** - Group related types in the same file
3. **Export from index.ts** - Make types available from `@/types`
4. **Document complex types** - Add JSDoc comments for clarity
5. **Keep types DRY** - Reuse common patterns across types
