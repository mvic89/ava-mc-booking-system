# Quick Start Checklist - BankID Integration

Use this checklist to get the BankID integration running locally.

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and running
- [ ] BankID app installed on phone (for testing)

## Step-by-Step Setup

### 1. Dependencies

```bash
# Install all packages
npm install
```

**Expected packages installed:**
- qrcode
- crypto-js
- @types/qrcode
- @prisma/client
- All Next.js dependencies

### 2. BankID Test Certificate

- [ ] Visit https://www.bankid.com/en/utvecklare/test
- [ ] Download `FPTestcert4_20230629.p12`
- [ ] Create `certs/` directory in project root
- [ ] Place certificate in `certs/FPTestcert4_20230629.p12`

```bash
mkdir certs
# Move downloaded certificate to certs/FPTestcert4_20230629.p12
```

### 3. Environment Configuration

- [ ] Copy `.env.example` to `.env.local`
- [ ] Update `DATABASE_URL` with your PostgreSQL credentials

```bash
cp .env.example .env.local
```

**Edit `.env.local`:**
```env
BANKID_ENV=test
BANKID_PFX_PATH=./certs/FPTestcert4_20230629.p12
BANKID_PFX_PASSPHRASE=qwerty123
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_DOMAIN=localhost:3000
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/ava_mc_booking
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

**Expected database tables:**
- Customer
- Booking
- AuditLog

### 5. Start Development Server

```bash
npm run dev
```

- [ ] Server starts without errors
- [ ] Navigate to http://localhost:3000
- [ ] See "AVA Motorcyklar Booking System" page
- [ ] Click "Ny kund (med BankID)" button

### 6. Test BankID Authentication

#### Option A: QR Code (Recommended for first test)

1. [ ] Click "Starta BankID"
2. [ ] Animated QR code appears
3. [ ] Open BankID app on phone
4. [ ] Switch to test environment in app
5. [ ] Scan QR code
6. [ ] Enter test PIN (from BankID test account)
7. [ ] Authentication completes
8. [ ] Form auto-fills with test data

#### Option B: Same Device

1. [ ] Click "Starta BankID"
2. [ ] Click "Öppna BankID på denna enhet"
3. [ ] BankID app opens automatically
4. [ ] Confirm identity
5. [ ] Return to browser
6. [ ] Form auto-fills with test data

### 7. Verify Integration

- [ ] QR code animates (changes every second)
- [ ] Status messages appear in Swedish
- [ ] No console errors in browser
- [ ] No errors in server terminal
- [ ] Customer form auto-fills with:
  -  Förnamn (first name)
  -  Efternamn (last name)
  -  Personnummer (12 digits)
- [ ] Remaining fields (email, phone, address) are editable

## Test Personnummer

Create test accounts at https://demo.bankid.com or use these examples:
- `199003152385` - Test person 1
- `198706282391` - Test person 2
- `196911292032` - Test person 3

## Troubleshooting

### Certificate errors
- Check that `FPTestcert4_20230629.p12` is in `certs/` directory
- Verify passphrase is `qwerty123` in `.env.local`

### Database connection errors
- Ensure PostgreSQL is running
- Check `DATABASE_URL` is correct
- Try: `psql -U your_user -d ava_mc_booking` to test connection

### "BankID app not found"
- Install BankID app on phone
- Switch to test environment in app settings
- Create test account at https://demo.bankid.com

### QR code not animating
- Check browser console for errors
- Verify crypto-js is installed
- Clear browser cache and reload

### "User cancel" immediately
- Ensure using test environment in BankID app
- Verify test personnummer is created
- Try different test account

## What Happens Next?

Once the integration is working:

1. **Database Integration**:
   - Currently returns mock data
   - Need to implement Prisma queries in `/api/bankid/collect/route.ts`
   - Check if customer exists, create or load profile

2. **Customer API**:
   - Create `/api/customers/route.ts` for CRUD operations
   - Implement customer saving logic

3. **Customer Profile Page**:
   - Create `/app/customers/[id]/page.tsx`
   - Display customer details and booking history

4. **Production Deployment**:
   - Obtain production certificate from bank
   - Update environment to production
   - Enable HTTPS
   - Register with Datainspektionen

## Files to Review

- `BANKID_SETUP.md` - Complete setup guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `README.md` - Project overview
- `.env.example` - Environment variables template

## Need Help?

1. Check `BANKID_SETUP.md` troubleshooting section
2. Review browser console and server logs
3. Verify all environment variables are set
4. Check BankID test environment is active in app

## Success Criteria

 You're ready to develop when:
- Server starts without errors
- QR code displays and animates
- BankID app connects successfully
- Form auto-fills after authentication
- No console or server errors

---

**Time estimate**: 15-30 minutes for first-time setup
