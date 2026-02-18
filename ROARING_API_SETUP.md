# Roaring.io API Setup Guide

This guide will help you set up and use the Roaring.io API to access person and company information in the Nordic countries (Sweden, Norway, Denmark, Finland).

## Table of Contents

1. [What is Roaring.io?](#what-is-roaringio)
2. [How to Get Your Roaring.io API Key](#how-to-get-your-roaringio-api-key)
3. [Sandbox Environment Setup](#sandbox-environment-setup) ⭐ **Start here for development**
4. [Setting Up the API Key in Your Project](#setting-up-the-api-key-in-your-project)
5. [Available API Endpoints](#available-api-endpoints)
6. [Usage Examples](#usage-examples)
7. [Pricing and Credits](#pricing-and-credits)
8. [Troubleshooting](#troubleshooting)

---

## What is Roaring.io?

Roaring.io is a Nordic data provider that offers APIs for accessing:

- **Person Information**: Population register data, addresses, names, and more
- **Company Information**: Company details, financial data, and organizational information
- **PEP Checks**: Politically Exposed Person verification
- **AML/Sanctions**: Anti-Money Laundering and sanctions list checks
- **Compliance Data**: Business prohibitions, beneficial ownership, and more

### Supported Countries

- 🇸🇪 **Sweden (SE)**
- 🇳🇴 **Norway (NO)**
- 🇩🇰 **Denmark (DK)**
- 🇫🇮 **Finland (FI)**
- 🇪🇸 **Spain (ES)** - Company data only

---

## How to Get Your Roaring.io API Key

### Step 1: Create a Roaring.io Account

1. **Visit the Roaring.io Developer Portal**
   - Go to: [https://developer.roaring.io/](https://developer.roaring.io/)

2. **Sign Up for an Account**
   - Click on **"Get Started"** or **"Sign Up"**
   - Fill in your organization details:
     - Organization name
     - Contact email
     - Business information
   - Accept the terms of service

3. **Verify Your Email**
   - Check your email for a verification link
   - Click the link to activate your account

### Step 2: Access the Developer Portal

1. **Log in to the Developer Portal**
   - Go to: [https://developer.roaring.io/](https://developer.roaring.io/)
   - Enter your credentials

2. **Navigate to the Dashboard**
   - After logging in, you'll see the main dashboard
   - This shows your API usage, credits, and available services

### Step 3: Generate Your API Key

1. **Go to the API Keys Section**
   - In the left sidebar, click on **"Organisation"**
   - Select **"API Keys"** from the menu
   - Alternatively, go directly to: [https://developer.roaring.io/keys](https://developer.roaring.io/keys)

2. **Create a New API Key**
   - Click **"Create API Key"** or **"Generate New Key"**
   - Give your key a descriptive name (e.g., "Ava MC Booking System - Production")
   - Select the appropriate permissions/scopes:
     - Population Register API (for person data)
     - Company API (for company data)
     - PEP API (for PEP checks)
   - Click **"Generate"**

3. **Save Your API Key**
   - ⚠️ **IMPORTANT**: Copy your API key immediately
   - Store it in a secure location (password manager recommended)
   - You may not be able to view the full key again after leaving the page

### Step 4: Set Up Billing (if required)

1. **Add Payment Method**
   - Go to **"Organisation"** → **"Billing"**
   - Add a credit card or set up invoice billing
   - Choose your pricing plan (see [Pricing](#pricing-and-credits) section)

2. **Purchase Credits or Choose a Plan**
   - Select a subscription plan based on your usage needs
   - Or purchase pay-as-you-go credits

### Step 5: Test Your API Key

1. **Use the API Explorer**
   - Roaring.io provides an API explorer in their developer portal
   - Go to **"APIs"** → **"Test Console"**
   - Enter your API key and test a simple request

2. **Try the Sandbox Environment**
   - Roaring.io offers a free sandbox with test data
   - Perfect for development and testing
   - No costs incurred when using sandbox data
   - See [Sandbox Environment Setup](#sandbox-environment-setup) below for detailed instructions

---

## Sandbox Environment Setup

### What is the Sandbox Environment?

The Roaring.io sandbox environment is a **free testing environment** that allows you to:

- Test API integration without consuming real credits
- Use predefined test data for Nordic countries (SE, NO, DK, FI)
- Develop and debug your application risk-free
- Validate your implementation before going to production

### How to Get Started with the Sandbox

#### Step 1: Sign Up for Sandbox Access

1. **Visit the Roaring.io Developer Portal**
   - Go to: [https://developer.roaring.io/](https://developer.roaring.io/)
   - Click **"Get Started"** or **"Sign Up"**

2. **Create a Free Account**
   - Fill in your details (name, email, organization)
   - Select **"Sandbox/Test"** or **"Developer"** account type if prompted
   - Verify your email address

3. **Access the Developer Dashboard**
   - Log in to [https://developer.roaring.io/](https://developer.roaring.io/)
   - Navigate to **Organisation** → **API Keys**

#### Step 2: Get Your OAuth Credentials (Client ID & Secret)

1. **Navigate to API Keys**
   - In the API Keys section, you should see your OAuth credentials
   - Or click **"Create API Key"** if you need to generate new ones
   - Name it: `Sandbox - Ava MC Booking System`
   - Select **"Test/Sandbox"** environment (if available)
   - Choose the APIs you want to test:
     - Population Register API
     - Company API
     - PEP API
   - Click **"Generate"** or **"Save"**

2. **Copy Your OAuth Credentials**
   - **Client ID**: Copy this value (looks like: `client_abc123xyz`)
   - **Client Secret**: Copy this value (looks like: `secret_abc123xyz456`)
   - Save both immediately in a secure location
   - You may not be able to view the Client Secret again after leaving the page

   **Note**: Roaring.io uses OAuth 2.0 Client Credentials flow for authentication, which provides better security than simple API keys.

#### Step 3: Configure Your Local Environment

1. **Create or update your `.env` file**:
   ```bash
   cp .env.example .env
   ```

2. **Add your OAuth credentials**:
   ```env
   # Roaring.io Configuration
   # ======================
   # Use your sandbox OAuth credentials for development and testing
   ROARING_CLIENT_ID=your_actual_client_id_here
   ROARING_CLIENT_SECRET=your_actual_client_secret_here

   # Optional: Specify sandbox base URL (if different)
   # ROARING_API_BASE_URL=https://sandbox.roaring.io
   ```

   **Important**: Replace `your_actual_client_id_here` and `your_actual_client_secret_here` with the actual values from the Roaring.io developer portal.

3. **Restart your development server**:
   ```bash
   npm run dev
   ```

#### Step 4: Use Test Data

The sandbox environment typically provides test data for Nordic countries. Here are some **example test personnummer** (these may vary - check Roaring.io documentation):

**Swedish Test Personnummer (SE):**
```
- 197001011234 (Anna Test Andersson)
- 198501012345 (Erik Test Eriksson)
- 199001013456 (Maria Test Svensson)
```

**Norwegian Test Personnummer (NO):**
```
- 01010100001 (Test Person)
- 15029900001 (Another Test Person)
```

**Danish Test CPR (DK):**
```
- 0101700001 (Test Person)
```

**Finnish Test Personnummer (FI):**
```
- 010170-0001 (Test Person)
```

### Testing Your Sandbox Integration

#### Test 1: Verify API Connection

Create a simple test script or use your browser:

```typescript
// Test the connection (run in a Next.js API route or component)
const testSandbox = async () => {
  try {
    const response = await fetch('/api/roaring/person?ssn=197001011234&country=SE');
    const data = await response.json();

    if (data.success) {
      console.log('✓ Sandbox connection successful!');
      console.log('Person:', data.data.name.full);
      console.log('Credits used:', data.metadata.creditsUsed);
    } else {
      console.error('✗ Sandbox test failed:', data.error.message);
    }
  } catch (error) {
    console.error('✗ Request failed:', error);
  }
};

testSandbox();
```

#### Test 2: Try Different Endpoints

**Test Person Lookup:**
```bash
curl http://localhost:3000/api/roaring/person?ssn=197001011234&country=SE
```

**Test Company Lookup:**
```bash
curl http://localhost:3000/api/roaring/company?orgNumber=5567890123&country=SE
```

**Test PEP Check:**
```bash
curl http://localhost:3000/api/roaring/pep?ssn=197001011234&country=SE
```

### Sandbox vs. Production

| Feature | Sandbox | Production |
|---------|---------|------------|
| **Cost** | Free | Paid (credit-based) |
| **Data** | Test data only | Real data |
| **Rate Limits** | May be limited | Based on your plan |
| **Credits** | Unlimited test credits | Real credits consumed |
| **Purpose** | Development & testing | Live application |
| **API Key** | Sandbox-specific key | Production key |

### Getting Test Data from Roaring.io

1. **Check the Developer Portal**
   - Log in to [https://developer.roaring.io/](https://developer.roaring.io/)
   - Look for **"Test Cases"** or **"Sample Data"** section
   - Each API endpoint usually has a **"Try it out"** button with example data

2. **Use the API Explorer**
   - Navigate to **APIs** → **Population Register** (or other APIs)
   - Click **"Test"** or **"Try it out"**
   - You'll see predefined test personnummer and company numbers

3. **Contact Support for More Test Data**
   - Email: [customer@roaring.io](mailto:customer@roaring.io)
   - Request additional test cases for your specific use case

### Troubleshooting Sandbox Issues

#### Issue 1: "Invalid API Key" Error

**Solution:**
- Verify you're using a sandbox API key (not a production key)
- Check that the key is correctly copied (no extra spaces)
- Ensure your `.env` file is loaded (restart the server)

#### Issue 2: "Not Found" or "No Data" Responses

**Solution:**
- You may be using a production API key with sandbox data
- Or using test personnummer that don't exist in the sandbox
- Check the Roaring.io developer portal for valid test data

#### Issue 3: Rate Limiting in Sandbox

**Solution:**
- Sandbox environments may have stricter rate limits
- Implement delays between requests during testing
- Contact Roaring.io if you need higher rate limits for testing

### Best Practices for Sandbox Testing

1. **Always Test in Sandbox First**
   - Never test directly in production
   - Validate all your API calls with test data
   - Ensure error handling works correctly

2. **Use Descriptive Test Cases**
   - Create test scenarios for different user types
   - Test edge cases (missing data, invalid formats)
   - Simulate error conditions

3. **Monitor Your Sandbox Usage**
   - Even though it's free, track your API calls
   - Ensure you're not making unnecessary requests
   - Optimize before moving to production

4. **Document Your Test Cases**
   - Keep a list of test personnummer that work
   - Document expected responses
   - Share with your team

5. **Transition to Production Smoothly**
   - Once testing is complete, switch to a production API key
   - Update environment variables in your deployment
   - Monitor production usage closely at first

### Switching from Sandbox to Production

When you're ready to go live:

1. **Get a Production API Key**
   - Go to the Roaring.io developer portal
   - Create a new production API key
   - Set up billing and purchase credits

2. **Update Environment Variables**
   ```env
   # Production configuration
   ROARING_API_KEY=your_production_api_key_here
   ```

3. **Update Your Deployment**
   - Set the production API key in your hosting environment (Vercel, AWS, etc.)
   - Do NOT commit production keys to version control

4. **Test with Real Data**
   - Start with a few manual tests
   - Monitor credit usage closely
   - Set up usage alerts

5. **Enable Monitoring**
   - Track API usage in the Roaring.io dashboard
   - Set up alerts for high usage or errors
   - Review logs regularly

---

## Setting Up the API Key in Your Project

### 1. Add Your OAuth Credentials to Environment Variables

1. **Copy the example environment file** (if you haven't already):
   ```bash
   cp .env.example .env
   ```

2. **Open the `.env` file** and add your Roaring.io OAuth credentials:
   ```env
   # Replace with your actual credentials from the developer portal
   ROARING_CLIENT_ID=your_actual_client_id_here
   ROARING_CLIENT_SECRET=your_actual_client_secret_here
   ```

3. **Restart your development server** to load the new environment variables:
   ```bash
   npm run dev
   ```

### 2. How OAuth Authentication Works

The Roaring.io client uses **OAuth 2.0 Client Credentials flow**:

1. Your Client ID and Client Secret are used to request an access token
2. The access token is automatically obtained and cached
3. All API requests use this access token for authentication
4. Tokens are automatically refreshed when they expire

**Benefits**:
- More secure than simple API keys
- Tokens can be revoked without changing credentials
- Automatic token refresh and caching
- Industry-standard authentication method

### 3. Verify the Integration

The Roaring.io client is automatically initialized when you use any of the API endpoints. The client will throw an error if the Client ID or Client Secret is missing.

---

## Available API Endpoints

### 1. Person Information API

**Endpoint**: `/api/roaring/person`

**Methods**: `GET`, `POST`

**Parameters**:
- `ssn` (required): Swedish personnummer (format: YYYYMMDD-XXXX or YYYYMMDDXXXX)
- `country` (optional): Country code (default: `SE`)
  - `SE` - Sweden
  - `NO` - Norway
  - `DK` - Denmark
  - `FI` - Finland

**Response**:
```json
{
  "success": true,
  "data": {
    "ssn": "19900101-1234",
    "name": {
      "first": "Anna",
      "last": "Andersson",
      "full": "Anna Andersson"
    },
    "address": {
      "street": "Storgatan 1",
      "postalCode": "11122",
      "city": "Stockholm",
      "country": "SE"
    },
    "birthDate": "1990-01-01",
    "gender": "F",
    "status": "Active",
    "protectedIdentity": false,
    "deceased": false
  },
  "metadata": {
    "requestId": "req_123456",
    "timestamp": "2026-02-17T12:00:00Z",
    "creditsUsed": 1
  }
}
```

### 2. Company Information API

**Endpoint**: `/api/roaring/company`

**Methods**: `GET`, `POST`

**Parameters**:
- `orgNumber` (required): Company organization number
- `country` (optional): Country code (default: `SE`)
  - `SE` - Sweden
  - `NO` - Norway
  - `DK` - Denmark
  - `FI` - Finland
  - `ES` - Spain

**Response**:
```json
{
  "success": true,
  "data": {
    "orgNumber": "556789-1234",
    "name": "Example AB",
    "address": {
      "street": "Företagsvägen 10",
      "postalCode": "11122",
      "city": "Stockholm"
    },
    "status": "Active",
    "registrationDate": "2020-01-01",
    "industry": "Technology",
    "employees": 50
  },
  "metadata": {
    "requestId": "req_123457",
    "timestamp": "2026-02-17T12:00:00Z",
    "creditsUsed": 1
  }
}
```

### 3. PEP Check API

**Endpoint**: `/api/roaring/pep`

**Methods**: `GET`, `POST`

**Parameters**:
- `ssn` (required): Swedish personnummer
- `country` (optional): Country code (default: `SE`)

**Response**:
```json
{
  "success": true,
  "data": {
    "isPEP": false,
    "matches": [],
    "riskLevel": "Low"
  },
  "metadata": {
    "requestId": "req_123458",
    "timestamp": "2026-02-17T12:00:00Z",
    "creditsUsed": 1
  }
}
```

---

## Usage Examples

### Example 1: Get Person Information by Personnummer

**Using fetch in React/Next.js**:

```typescript
// In a React component or API route
const getPersonInfo = async (personnummer: string) => {
  try {
    const response = await fetch(`/api/roaring/person?ssn=${personnummer}&country=SE`);
    const data = await response.json();

    if (data.success) {
      console.log('Person:', data.data.name.full);
      console.log('Address:', data.data.address?.street);
    } else {
      console.error('Error:', data.error.message);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

// Usage
getPersonInfo('19900101-1234');
```

**Using the Roaring Client directly (server-side only)**:

```typescript
// In an API route or server component
import { getRoaringClient } from '@/lib/roaring/client';

export async function GET(request: Request) {
  const roaringClient = getRoaringClient();
  const result = await roaringClient.getPersonBySSN('19900101-1234', 'SE');

  if (result.success) {
    console.log('Person found:', result.data?.name.full);
  }

  return Response.json(result);
}
```

### Example 2: Get Company Information

```typescript
const getCompanyInfo = async (orgNumber: string) => {
  try {
    const response = await fetch(`/api/roaring/company?orgNumber=${orgNumber}&country=SE`);
    const data = await response.json();

    if (data.success) {
      console.log('Company:', data.data.name);
      console.log('Status:', data.data.status);
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

// Usage
getCompanyInfo('556789-1234');
```

### Example 3: Check PEP Status

```typescript
const checkPEPStatus = async (personnummer: string) => {
  try {
    const response = await fetch(`/api/roaring/pep?ssn=${personnummer}&country=SE`);
    const data = await response.json();

    if (data.success) {
      if (data.data.isPEP) {
        console.warn('⚠️ This person is a PEP!');
        console.log('Risk Level:', data.data.riskLevel);
      } else {
        console.log('✓ No PEP matches found');
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
};

// Usage
checkPEPStatus('19900101-1234');
```

### Example 4: Integrate with BankID Authentication

```typescript
// After successful BankID authentication
import { getRoaringClient } from '@/lib/roaring/client';

export async function POST(request: Request) {
  const { personnummer } = await request.json();

  // User authenticated with BankID
  // Now fetch additional information from Roaring.io
  const roaringClient = getRoaringClient();

  // Get person details
  const personData = await roaringClient.getPersonBySSN(personnummer, 'SE');

  // Check PEP status for compliance
  const pepCheck = await roaringClient.checkPEP(personnummer, 'SE');

  // Store the information in your database
  // ... your database logic here

  return Response.json({
    success: true,
    person: personData.data,
    pep: pepCheck.data,
  });
}
```

---

## Pricing and Credits

### Pricing Model

Roaring.io uses a **credit-based** pricing system:

- Each API request consumes a certain number of credits
- Different endpoints cost different amounts of credits
- You can purchase credits in bulk or subscribe to a monthly plan

### Typical Credit Costs

- **Population Register (Person Data)**: ~1 credit per lookup
- **Company Data**: ~1-2 credits per lookup
- **PEP Check**: ~2-5 credits per check
- **AML/Sanctions**: ~5-10 credits per check

### Pricing Plans (Approximate)

1. **Free Tier / Sandbox**
   - Limited test data
   - Perfect for development
   - No costs

2. **Pay-As-You-Go**
   - Purchase credits as needed
   - Starting from ~500 SEK for 100 credits
   - No monthly commitment

3. **Monthly Subscription**
   - **Starter**: ~2,000 SEK/month (includes X credits)
   - **Professional**: ~5,000 SEK/month (includes more credits)
   - **Enterprise**: Custom pricing

4. **Enterprise**
   - Custom contracts
   - Volume discounts
   - Dedicated support
   - Contact: [customer@roaring.io](mailto:customer@roaring.io)

### Monitoring Your Usage

1. **Check your credit balance**:
   - Log in to [https://developer.roaring.io/](https://developer.roaring.io/)
   - View your dashboard for current credit balance

2. **Set up usage alerts**:
   - Configure email notifications when credits are running low
   - Available in **"Organisation"** → **"Billing"** → **"Alerts"**

3. **Review API usage**:
   - Access detailed usage reports
   - Export usage data for accounting purposes

---

## Troubleshooting

### Common Issues

#### 1. "Client ID and Client Secret are required" Error

**Problem**: Missing OAuth credentials

**Solution**:
- Verify that both `ROARING_CLIENT_ID` and `ROARING_CLIENT_SECRET` are set in your `.env` file
- Check that there are no extra spaces or quotes around the values
- Ensure you copied the full values from the developer portal
- Restart your development server after adding the credentials

```bash
# Check if the variables are set (on Mac/Linux)
echo $ROARING_CLIENT_ID
echo $ROARING_CLIENT_SECRET

# Restart the server
npm run dev
```

#### 2. "HTTP 401 Unauthorized" or "OAuth token request failed" Error

**Problem**: Invalid or expired OAuth credentials

**Solution**:
- Verify your Client ID and Client Secret are correct
- Regenerate your OAuth credentials in the Roaring.io developer portal if needed
- Update your `.env` file with the new credentials
- Ensure you're using the correct credentials (production vs. sandbox)
- Check that you haven't accidentally mixed production and sandbox credentials

#### 3. "HTTP 403 Forbidden" Error

**Problem**: Insufficient permissions or credits

**Solution**:
- Check your credit balance in the developer portal
- Verify that your API key has permission for the endpoint you're trying to access
- Contact Roaring.io support if you need additional permissions

#### 4. "Invalid SSN Format" Error

**Problem**: Personnummer is not in the correct format

**Solution**:
- Swedish personnummer should be in format: `YYYYMMDD-XXXX` or `YYYYMMDDXXXX`
- The client automatically normalizes the format, but ensure it's a valid personnummer
- Example: `19900101-1234` or `199001011234`

#### 5. Rate Limiting

**Problem**: Too many requests in a short time

**Solution**:
- Roaring.io may have rate limits on API requests
- Implement exponential backoff for retries
- Cache responses when possible to reduce API calls
- Contact support to increase rate limits if needed

### Getting Help

#### Official Support Channels

1. **Developer Portal Documentation**
   - [https://developer.roaring.io/](https://developer.roaring.io/)
   - Comprehensive API documentation
   - Code examples and tutorials

2. **Email Support**
   - [customer@roaring.io](mailto:customer@roaring.io)
   - Technical support available
   - Business inquiries welcome

3. **Help Center**
   - [https://help.roaring.io/](https://help.roaring.io/)
   - Knowledge base articles
   - FAQs and common issues

4. **Flow Builder Tool**
   - Visual API flow builder in the developer portal
   - Test API calls without writing code
   - Debug API responses

---

## Additional Resources

### Useful Links

- **Developer Portal**: [https://developer.roaring.io/](https://developer.roaring.io/)
- **API Documentation**: Available in the developer portal after login
- **Status Page**: Check for service outages or maintenance
- **Changelog**: [https://developer.roaring.io/changelog](https://developer.roaring.io/changelog)

### Integration Tips

1. **Use Environment Variables**
   - Never commit your Client ID or Client Secret to version control
   - Always add `.env` to your `.gitignore` file
   - Use `.env.local` for local development
   - Use secure secret management for production (AWS Secrets Manager, Azure Key Vault, etc.)

2. **Implement Error Handling**
   - Always check the `success` field in responses
   - Handle network errors gracefully
   - Provide user-friendly error messages

3. **Cache Responses**
   - Person and company data doesn't change frequently
   - Implement caching to reduce API costs
   - Use appropriate cache expiration times (e.g., 24 hours for person data)

4. **Monitor Usage**
   - Track your API usage and costs
   - Set up alerts for high usage
   - Review usage patterns regularly

5. **Test in Sandbox First**
   - Always test new integrations in the sandbox environment
   - Use test data provided by Roaring.io
   - Move to production only when thoroughly tested

---

## Security Best Practices

1. **Protect Your OAuth Credentials**
   - Store Client ID and Client Secret in environment variables, never in code
   - Use a secrets manager in production (e.g., AWS Secrets Manager, Azure Key Vault)
   - Rotate credentials regularly (regenerate in developer portal)
   - Never expose credentials in client-side code
   - Never commit `.env` files to version control
   - Client Secret is as sensitive as a password - treat it accordingly

2. **Use HTTPS**
   - All API requests should use HTTPS
   - The client automatically uses HTTPS

3. **Comply with GDPR**
   - Only request data you need
   - Inform users about data collection
   - Implement data retention policies
   - Allow users to request data deletion

4. **Audit Logging**
   - Log all API requests (without sensitive data)
   - Monitor for unusual activity
   - Review logs regularly

---

## Next Steps

After setting up your Roaring.io API key:

1. ✅ Test the integration with sample data
2. ✅ Integrate with your BankID authentication flow
3. ✅ Implement error handling and user feedback
4. ✅ Set up monitoring and alerting
5. ✅ Review GDPR compliance requirements
6. ✅ Move to production when ready

For questions or issues, refer to the [Troubleshooting](#troubleshooting) section or contact Roaring.io support.

---

**Last Updated**: February 17, 2026

**Version**: 1.0.0
