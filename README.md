# AVA Motorcyklar Booking System

A Next.js-based motorcycle booking and customer management system with Swedish BankID v6.0 integration for secure customer identification and auto-fill functionality.

## Features

- **BankID Authentication**: Secure customer identification using Swedish BankID
- **Auto-Fill Customer Data**: Automatically populate forms with verified identity from BankID
- **QR Code & Same-Device Login**: Support for both QR code scanning and same-device authentication
- **Customer Management**: Track customer information, bookings, and history
- **Risk Assessment**: Built-in risk evaluation from BankID
- **GDPR Compliant**: Audit logging and secure data storage

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up BankID Test Environment

Download the test certificate from [BankID Developer Portal](https://www.bankid.com/en/utvecklare/test):

```bash
mkdir certs
# Place FPTestcert4_20230629.p12 in certs/ directory
```

### 3. Configure Environment

Create `.env.local` file (copy from `.env.example`):

```env
BANKID_ENV=test
BANKID_PFX_PATH=./certs/FPTestcert4_20230629.p12
BANKID_PFX_PASSPHRASE=qwerty123
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_DOMAIN=localhost:3000
DATABASE_URL=postgresql://user:password@localhost:5432/ava_mc_booking
```

### 4. Set Up Database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click "Ny kund (med BankID)" to test the BankID integration.

## Documentation

- **[BANKID_SETUP.md](./BANKID_SETUP.md)** - Complete setup and deployment guide
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Technical implementation details
- **[.env.example](./.env.example)** - Environment variables template

## Project Structure

```
ava-mc-booking-system/
├── app/
│   ├── api/bankid/          # BankID API endpoints
│   ├── customers/           # Customer management pages
│   └── page.tsx             # Home page
├── components/
│   └── BankIDIdentify.tsx   # BankID authentication component
├── lib/bankid/              # BankID client library
├── prisma/
│   └── schema.prisma        # Database schema
└── certs/                   # BankID certificates (not in git)
```

## Testing with BankID

1. Install BankID app on your phone
2. Switch to test environment in the app
3. Create a test person at [demo.bankid.com](https://demo.bankid.com)
4. Use test personnummer: `199003152385`
5. Navigate to `/customers/new` and scan the QR code

## Technology Stack

- **Framework**: Next.js 16.1.6 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Authentication**: BankID v6.0 API
- **QR Codes**: qrcode library
- **Security**: Mutual TLS with BankID servers

## BankID Integration

This system implements the complete BankID v6.0 Relying Party API:

- ✅ `/auth` - Initiate authentication
- ✅ `/collect` - Poll for authentication status
- ✅ `/cancel` - Cancel authentication
- ✅ Animated QR code generation
- ✅ Same-device authentication
- ✅ Risk assessment
- ✅ Swedish language UI

## Production Deployment

For production deployment:

1. Obtain production BankID certificate from your bank
2. Update environment variables to production
3. Enable HTTPS (required by BankID)
4. Register with Datainspektionen (Swedish DPA)
5. Update privacy policy

See [BANKID_SETUP.md](./BANKID_SETUP.md) for detailed production checklist.

## Security

- Mutual TLS authentication with BankID servers
- End-user IP verification
- BankID signature storage for legal compliance
- Audit logging for GDPR compliance
- Secure personnummer handling

## GDPR Compliance

This system stores Swedish personnummer (personal identity numbers), which requires:

- Registration with Datainspektionen
- Privacy policy disclosure
- Audit logging (implemented)
- Right to deletion (implement as needed)
- Secure data storage

## Learn More

- [BankID Developer Documentation](https://www.bankid.com/en/utvecklare)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Swedish Data Protection Authority](https://www.imy.se/)

## License

Private - AVA Motorcyklar Internal Use

## Support

For implementation questions, see:
- `BANKID_SETUP.md` - Setup and troubleshooting
- `IMPLEMENTATION_SUMMARY.md` - Technical details
