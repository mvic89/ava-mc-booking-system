/**
 * Roaring.io API Client
 *
 * This client provides methods to interact with the Roaring.io API
 * for retrieving person and company information in the Nordic countries.
 *
 * Uses OAuth 2.0 Client Credentials flow for authentication.
 *
 * Documentation: https://developer.roaring.io/
 */

import type {
  RoaringConfig,
  OAuthTokenResponse,
  CachedToken,
  PersonData,
  RoaringPersonResponse,
  RoaringCompanyResponse,
} from '@/types/roaring';

class RoaringAPIClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private tokenCache: CachedToken | null = null;

  constructor(config: RoaringConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error(
        'Roaring.io Client ID and Client Secret are required. ' +
        'Please set ROARING_CLIENT_ID and ROARING_CLIENT_SECRET in your environment variables.'
      );
    }
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = config.baseUrl || 'https://api.roaring.io';
  }

  /**
   * Get OAuth access token using Client Credentials flow
   * Tokens are cached and reused until they expire
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60 second buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.accessToken;
    }

    try {
      // Request new token using OAuth 2.0 Client Credentials flow
      const tokenUrl = `${this.baseUrl}/token`;

      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OAuth token request failed (${response.status}): ${errorText}`);
      }

      const tokenData: OAuthTokenResponse = await response.json();

      // Cache the token
      this.tokenCache = {
        accessToken: tokenData.access_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
      };

      return tokenData.access_token;
    } catch (error) {
      throw new Error(
        `Failed to obtain OAuth access token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get person information by Swedish personnummer
   *
   * @param personnummer - Swedish social security number (format: YYYYMMDD-XXXX or YYYYMMDDXXXX)
   * @param country - Country code (default: 'SE' for Sweden)
   * @returns Person data from population register
   */
  async getPersonBySSN(
    personnummer: string,
    country: 'SE' | 'NO' | 'DK' | 'FI' = 'SE'
  ): Promise<RoaringPersonResponse> {
    try {
      // Get OAuth access token
      const accessToken = await this.getAccessToken();

      // Normalize personnummer format (remove dash if present)
      const normalizedSSN = personnummer.replace(/[-\s]/g, '');

      const url = `${this.baseUrl}/person/2.0/current/${normalizedSSN}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorData.message || `API request failed with status ${response.status}`,
          },
        };
      }

      const data = await response.json();

      // Roaring returns HTTP 200 even when no record is found.
      // Detect this via the status object: code 0 = found, code 1 = not found.
      if (!data.records || data.records.length === 0 || data.status?.code !== 0) {
        return {
          success: false,
          error: {
            code: `ROARING_${data.status?.code ?? 'NO_RECORDS'}`,
            message: data.status?.text || 'No person record found for this SSN',
          },
        };
      }

      return {
        success: true,
        data: this.transformPersonData(data),
        metadata: {
          requestId: data.requestId || '',
          timestamp: new Date().toISOString(),
          creditsUsed: data.creditsUsed || 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Get company information by organization number
   *
   * @param orgNumber - Company organization number
   * @param country - Country code (default: 'SE' for Sweden)
   * @returns Company data
   */
  async getCompanyByOrgNumber(
    orgNumber: string,
    country: 'SE' | 'NO' | 'DK' | 'FI' | 'ES' = 'SE'
  ): Promise<RoaringCompanyResponse> {
    try {
      // Get OAuth access token
      const accessToken = await this.getAccessToken();

      const endpoint = `/v2/company/${country.toLowerCase()}/${orgNumber}`;
      const url = `${this.baseUrl}${endpoint}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorData.message || `API request failed with status ${response.status}`,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
        metadata: {
          requestId: data.requestId || '',
          timestamp: new Date().toISOString(),
          creditsUsed: data.creditsUsed || 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Check if a person is a PEP (Politically Exposed Person)
   *
   * @param personnummer - Swedish social security number
   * @param country - Country code (default: 'SE' for Sweden)
   * @returns PEP status information
   */
  async checkPEP(
    personnummer: string,
    country: 'SE' | 'NO' | 'DK' | 'FI' = 'SE'
  ): Promise<RoaringPersonResponse> {
    try {
      // Get OAuth access token
      const accessToken = await this.getAccessToken();

      const normalizedSSN = personnummer.replace(/[-\s]/g, '');
      const endpoint = `/v2/pep/${country.toLowerCase()}`;
      const url = `${this.baseUrl}${endpoint}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ssn: normalizedSSN,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: errorData.message || `API request failed with status ${response.status}`,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
        metadata: {
          requestId: data.requestId || '',
          timestamp: new Date().toISOString(),
          creditsUsed: data.creditsUsed || 1,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      };
    }
  }

  /**
   * Transform raw API response to standardized PersonData format.
   * Roaring v2.0 response shape: { records: [{ ... }], status: { ... } }
   */
  private transformPersonData(rawData: any): PersonData {
    // v2.0 uses "records", v1.0 used "posts" — support both
    const post = rawData.records?.[0] ?? rawData.posts?.[0] ?? rawData;

    // Name: may be nested object or flat fields
    const nameObj = post.name ?? post;
    const firstName = nameObj.givenName || nameObj.firstName || post.firstName || '';
    const lastName = nameObj.surName || nameObj.surname || nameObj.lastName || post.surName || post.lastName || '';

    // Address: may be a direct object or wrapped in nationalRegistrationAddress
    const addrWrapper =
      post.address?.nationalRegistrationAddress?.[0] ??
      post.address ??
      null;

    // Gender: may be on the record directly or in a details sub-array
    const detail = post.details?.[0] ?? post;
    const genderRaw = post.gender || detail.gender;

    return {
      ssn: post.personalNumber || '',
      name: {
        first: firstName,
        last: lastName,
        full: `${firstName} ${lastName}`.trim(),
      },
      address: addrWrapper ? {
        street: addrWrapper.deliveryAddress2 || addrWrapper.street || addrWrapper.careOf || '',
        postalCode: addrWrapper.postalNumber || addrWrapper.postalCode || '',
        city: addrWrapper.city || '',
        country: 'SE',
      } : undefined,
      birthDate: (post.birthDate || detail.birthDate || '').split('T')[0],
      gender: genderRaw === 'M' || genderRaw === 'F' ? genderRaw : undefined,
      status: post.secrecyMarked ? 'protected' : 'active',
      protectedIdentity: post.secrecyMarked || false,
      deceased: post.deceased || false,
    };
  }

  /**
   * Verify OAuth credentials are valid by attempting to get an access token
   */
  async verifyConnection(): Promise<boolean> {
    try {
      // Try to get an access token - if this succeeds, credentials are valid
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
let roaringClient: RoaringAPIClient | null = null;

export function getRoaringClient(): RoaringAPIClient {
  if (!roaringClient) {
    const clientId = process.env.ROARING_CLIENT_ID;
    const clientSecret = process.env.ROARING_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'ROARING_CLIENT_ID and ROARING_CLIENT_SECRET environment variables are not set. ' +
        'Please add them to your .env file. See ROARING_API_SETUP.md for instructions.'
      );
    }

    // Support optional custom base URL (e.g., for sandbox environments)
    const baseUrl = process.env.ROARING_API_BASE_URL;
    const config: RoaringConfig = { clientId, clientSecret };
    if (baseUrl) {
      config.baseUrl = baseUrl;
    }

    roaringClient = new RoaringAPIClient(config);
  }
  return roaringClient;
}

// Re-export for backward compatibility
export type {
  RoaringConfig,
  PersonData,
  RoaringPersonResponse,
  RoaringCompanyResponse,
} from '@/types/roaring';

export { RoaringAPIClient };
