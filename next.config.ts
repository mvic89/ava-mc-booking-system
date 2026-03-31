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
  // Note: payment=() is intentionally NOT set — removing it allows Klarna's
  // pay_now widget to use the browser's Payment Request API.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
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
      // x.klarnacdn.net — Klarna Payments JS SDK
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://x.klarnacdn.net",
      "style-src 'self' 'unsafe-inline' https://vercel.live https://www.gstatic.com https://*.klarnacdn.net",
      "img-src 'self' data: blob: https://vercel.live https://*.vercel.com https://www.gstatic.com https://*.klarnacdn.net https://*.klarna.com",
      "font-src 'self' https://vercel.live https://fonts.gstatic.com https://*.klarnacdn.net",
      // *.klarna.com — Klarna SDK makes direct API calls to Klarna from the browser
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://vercel.live wss://ws-us3.pusher.com https://*.klarna.com https://*.klarnacdn.net",
      // *.klarnacdn.net + *.klarna.com — Klarna widget iframe origins
      "frame-src https://vercel.live https://*.klarnacdn.net https://*.klarna.com",
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
