import { NextRequest, NextResponse } from 'next/server';
import { initiateOwnershipTransfer, getOwnershipTransferStatus } from '@/lib/transportstyrelsen/client';
import { getCredential } from '@/lib/integrations/config-store';

/**
 * POST /api/transportstyrelsen/register
 *
 * Initiate a digital ownership transfer (ägarbyte) via Transportstyrelsen's e-tjänst.
 * Both seller and buyer must complete BankID signing on the returned signingUrl.
 *
 * Body: {
 *   dealerId:           string
 *   registrationNumber: string   ← vehicle reg plate
 *   sellerPersonNumber: string   ← seller's personnummer (YYYYMMDDXXXX)
 *   buyerPersonNumber:  string   ← buyer's personnummer
 *   purchaseDate:       string   ← ISO date
 *   purchasePrice:      number   ← SEK
 *   odometerReading:    number   ← km at time of sale
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      dealerId:           string;
      registrationNumber: string;
      sellerPersonNumber: string;
      buyerPersonNumber:  string;
      purchaseDate:       string;
      purchasePrice:      number;
      odometerReading:    number;
    };

    const apiKey = await getCredential(
      body.dealerId ?? 'ava-mc',
      'transportstyrelsen',
      'TRANSPORTSTYRELSEN_API_KEY',
    );
    if (!apiKey) {
      return NextResponse.json({ error: 'Transportstyrelsen API key not configured' }, { status: 400 });
    }

    const result = await initiateOwnershipTransfer(apiKey, {
      registrationNumber: body.registrationNumber,
      sellerPersonNumber: body.sellerPersonNumber,
      buyerPersonNumber:  body.buyerPersonNumber,
      purchaseDate:       body.purchaseDate,
      purchasePrice:      body.purchasePrice,
      odometerReading:    body.odometerReading,
    });

    return NextResponse.json({ transfer: result });
  } catch (error: any) {
    console.error('[transportstyrelsen/register POST]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/transportstyrelsen/register?caseId=...&dealerId=...
 *
 * Poll the status of an in-progress ownership transfer.
 */
export async function GET(req: NextRequest) {
  try {
    const dealerId = req.nextUrl.searchParams.get('dealerId') ?? 'ava-mc';
    const caseId   = req.nextUrl.searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json({ error: 'caseId required' }, { status: 400 });
    }

    const apiKey = await getCredential(dealerId, 'transportstyrelsen', 'TRANSPORTSTYRELSEN_API_KEY');
    if (!apiKey) {
      return NextResponse.json({ error: 'Transportstyrelsen API key not configured' }, { status: 400 });
    }

    const status = await getOwnershipTransferStatus(apiKey, caseId);
    return NextResponse.json({ transfer: status });
  } catch (error: any) {
    console.error('[transportstyrelsen/register GET]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
