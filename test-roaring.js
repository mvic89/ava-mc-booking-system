/**
 * Test script to verify Roaring.io API connection
 * Run with: ROARING_CLIENT_ID=xxx ROARING_CLIENT_SECRET=yyy node test-roaring.js
 * Or: source .env && node test-roaring.js
 */

const clientId = process.env.ROARING_CLIENT_ID;
const clientSecret = process.env.ROARING_CLIENT_SECRET;
const baseUrl = process.env.ROARING_API_BASE_URL || 'https://api.roaring.io';

console.log('🔍 Testing Roaring.io API Connection\n');
console.log('Configuration:');
console.log('  Base URL:', baseUrl);
console.log('  Client ID:', clientId ? `${clientId.slice(0, 8)}...` : 'NOT SET');
console.log('  Client Secret:', clientSecret ? `${clientSecret.slice(0, 8)}...` : 'NOT SET');
console.log('');

if (!clientId || !clientSecret) {
  console.error('❌ Missing ROARING_CLIENT_ID or ROARING_CLIENT_SECRET');
  console.error('   Please add them to your .env file');
  process.exit(1);
}

async function testOAuthToken() {
  try {
    const tokenUrl = `${baseUrl}/oauth/token`;
    console.log(`📡 Requesting OAuth token from: ${tokenUrl}\n`);

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response Headers:`, Object.fromEntries(response.headers.entries()));
    console.log('');

    const responseText = await response.text();

    if (!response.ok) {
      console.error('❌ OAuth token request failed\n');
      console.error('Response Body:');
      console.error(responseText);
      console.error('\n');

      // Check if it's HTML error
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<HTML>')) {
        console.error('🚨 Received HTML error page instead of JSON response');
        console.error('   This indicates a server-side infrastructure issue on Roaring.io');
        console.error('   Common causes:');
        console.error('     - CloudFront/Lambda misconfiguration');
        console.error('     - Service outage or maintenance');
        console.error('     - Invalid base URL (check if sandbox URL is different)');
        console.error('\n   Recommended actions:');
        console.error('     1. Contact Roaring.io support: customer@roaring.io');
        console.error('     2. Check their status page or developer portal for outages');
        console.error('     3. Try using sandbox environment if available');
      }

      return false;
    }

    const tokenData = JSON.parse(responseText);
    console.log('✅ OAuth token obtained successfully!\n');
    console.log('Token Data:');
    console.log('  Access Token:', tokenData.access_token ? `${tokenData.access_token.slice(0, 20)}...` : 'N/A');
    console.log('  Expires In:', tokenData.expires_in, 'seconds');
    console.log('  Token Type:', tokenData.token_type);

    return true;
  } catch (error) {
    console.error('❌ Error during OAuth token request:\n');
    console.error(error);
    return false;
  }
}

// Run the test
testOAuthToken().then(success => {
  console.log('\n' + '='.repeat(60));
  if (success) {
    console.log('✅ Connection test PASSED');
    console.log('   Your credentials are valid and Roaring.io API is accessible');
  } else {
    console.log('❌ Connection test FAILED');
    console.log('   See error details above');
  }
  console.log('='.repeat(60));
  process.exit(success ? 0 : 1);
});
