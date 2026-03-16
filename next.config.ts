import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const securityHeaders = [
  // Block pages from being framed by other sites (clickjacking protection)
  { key: 'X-Frame-Options',           value: 'DENY' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  // Only send origin in Referer header (no full URL)
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // Disable browser features that aren't needed
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Force HTTPS for 2 years in production (browser ignores on localhost)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Content-Security-Policy — restrict resource origins
  // 'unsafe-inline' is kept temporarily for Tailwind/next-intl; tighten when using nonces
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // unsafe-eval needed for Next.js HMR; vercel.live for preview toolbar
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://vercel.live https://www.gstatic.com",
      "img-src 'self' data: blob: https://vercel.live https://*.vercel.com https://www.gstatic.com",
      "font-src 'self' https://vercel.live https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live wss://ws-us3.pusher.com",
      "frame-src https://vercel.live",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
