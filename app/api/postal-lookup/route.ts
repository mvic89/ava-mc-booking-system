import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/postal-lookup?code=13230
 *
 * Server-side Swedish postal code → city lookup.
 * Tries three sources in order; returns { city } or { city: null }.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.replace(/\D/g, '') ?? '';
  if (code.length !== 5) {
    return NextResponse.json({ city: null }, { status: 400 });
  }

  // ── 1. zippopotam.us ─────────────────────────────────────────────────────
  try {
    const res = await fetch(`https://api.zippopotam.us/se/${code}`, {
      next: { revalidate: 86400 },          // cache 24 h on the CDN edge
    });
    if (res.ok) {
      const data = await res.json();
      const city: string = data.places?.[0]?.['place name'] ?? '';
      if (city) return NextResponse.json({ city });
    }
  } catch { /* fall through */ }

  // ── 2. Nominatim structured search ───────────────────────────────────────
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${code}&countrycodes=SE&format=json&addressdetails=1&limit=1`,
      {
        headers: {
          'User-Agent': 'BikeMeNow/1.0 (signup postal lookup)',
          'Accept-Language': 'sv',
        },
        next: { revalidate: 86400 },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        const addr = data[0].address ?? {};
        const city: string =
          addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
        if (city) return NextResponse.json({ city });
      }
    }
  } catch { /* fall through */ }

  // ── 3. Nominatim free-text fallback (searches "XXXXX Sweden") ────────────
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${code}+Sverige&format=json&addressdetails=1&limit=1`,
      {
        headers: {
          'User-Agent': 'BikeMeNow/1.0 (signup postal lookup)',
          'Accept-Language': 'sv',
        },
        next: { revalidate: 86400 },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        const addr = data[0].address ?? {};
        const city: string =
          addr.city ?? addr.town ?? addr.village ?? addr.municipality ??
          addr.county ?? '';
        if (city) return NextResponse.json({ city });
      }
    }
  } catch { /* fall through */ }

  return NextResponse.json({ city: null });
}
